# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Warehouse Operational Assistant - Planner/Router Graph
Multi-agent orchestration for warehouse operations.

This module implements the main planner/router agent that:
1. Analyzes user intents
2. Routes to appropriate specialized agents
3. Coordinates multi-agent workflows
4. Synthesizes responses from multiple agents
"""

from typing import Dict, List, Optional, TypedDict, Annotated, Any
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from dataclasses import asdict
import logging
import asyncio
import threading

logger = logging.getLogger(__name__)

# Constants for error responses
DEFAULT_ERROR_RESPONSE = {
    "natural_language": "",
    "structured_data": {"error": ""},
    "recommendations": [],
    "confidence": 0.0,
    "response_type": "error",
}


def _extract_message_text(state: WarehouseState) -> Optional[str]:
    """
    Extract text from the latest message in state.
    
    Args:
        state: Warehouse state dictionary
        
    Returns:
        Message text or None if no messages
    """
    if not state.get("messages"):
        return None
    
    latest_message = state["messages"][-1]
    if isinstance(latest_message, HumanMessage):
        return latest_message.content
    else:
        return str(latest_message.content)


def _create_error_response(agent_name: str, error: Exception) -> Dict[str, Any]:
    """
    Create standardized error response for agent failures.
    
    Args:
        agent_name: Name of the agent that failed
        error: Exception that occurred
        
    Returns:
        Standardized error response dictionary
    """
    error_msg = str(error)
    response = DEFAULT_ERROR_RESPONSE.copy()
    response["natural_language"] = f"Error processing {agent_name} request: {error_msg}"
    response["structured_data"] = {"error": error_msg}
    return response


class WarehouseState(TypedDict):
    """State management for warehouse assistant workflow."""

    messages: Annotated[List[BaseMessage], "Chat messages"]
    user_intent: Optional[str]
    routing_decision: Optional[str]
    agent_responses: Dict[str, str]
    final_response: Optional[str]
    context: Dict[str, any]
    session_id: str


class IntentClassifier:
    """Classifies user intents for warehouse operations."""

    EQUIPMENT_KEYWORDS = [
        "equipment",
        "forklift",
        "conveyor",
        "scanner",
        "amr",
        "agv",
        "charger",
        "assignment",
        "utilization",
        "maintenance",
        "availability",
        "telemetry",
        "battery",
        "truck",
        "lane",
        "pm",
        "loto",
        "lockout",
        "tagout",
        "sku",
        "stock",
        "inventory",
        "quantity",
        "available",
        "atp",
        "on_hand",
    ]

    OPERATIONS_KEYWORDS = [
        "shift",
        "task",
        "tasks",
        "workforce",
        "pick",
        "pack",
        "putaway",
        "schedule",
        "assignment",
        "kpi",
        "performance",
        "equipment",
        "main",
        "today",
        "work",
        "job",
        "operation",
        "operations",
        "worker",
        "workers",
        "team",
        "team members",
        "staff",
        "employee",
        "employees",
        "active workers",
        "how many",
        "roles",
        "team members",
        "wave",
        "waves",
        "order",
        "orders",
        "zone",
        "zones",
        "line",
        "lines",
        "create",
        "generating",
        "pick wave",
        "pick waves",
        "order management",
        "zone a",
        "zone b",
        "zone c",
    ]

    SAFETY_KEYWORDS = [
        "safety",
        "incident",
        "compliance",
        "policy",
        "checklist",
        "hazard",
        "accident",
        "protocol",
        "training",
        "audit",
        "over-temp",
        "overtemp",
        "temperature",
        "event",
        "detected",
        "alert",
        "warning",
        "emergency",
        "malfunction",
        "failure",
        "ppe",
        "protective",
        "helmet",
        "gloves",
        "boots",
        "safety harness",
        "procedures",
        "guidelines",
        "standards",
        "regulations",
        "evacuation",
        "fire",
        "chemical",
        "lockout",
        "tagout",
        "loto",
        "injury",
        "report",
        "investigation",
        "corrective",
        "action",
        "issues",
        "problem",
        "concern",
        "violation",
        "breach",
    ]

    DOCUMENT_KEYWORDS = [
        "document",
        "upload",
        "scan",
        "extract",
        "process",
        "pdf",
        "image",
        "invoice",
        "receipt",
        "bol",
        "bill of lading",
        "purchase order",
        "po",
        "quality",
        "validation",
        "approve",
        "review",
        "ocr",
        "text extraction",
        "file",
        "photo",
        "picture",
        "documentation",
        "paperwork",
        "neural",
        "nemo",
        "retriever",
        "parse",
        "vision",
        "multimodal",
        "document processing",
        "document analytics",
        "document search",
        "document status",
    ]

    @classmethod
    def classify_intent(cls, message: str) -> str:
        """Classify a user message into a planner-graph route.

        See ``src/api/graphs/intent_rules.py`` — whole-word matching, scored,
        rather than the substring chain this used to be.
        """
        from src.api.graphs.intent_rules import classify as _classify

        return _classify(message)


def handle_ambiguous_query(state: WarehouseState) -> WarehouseState:
    """Handle ambiguous queries with clarifying questions."""
    try:
        message_text = _extract_message_text(state)
        if not message_text:
            return state

        message_lower = message_text.lower()

        # Define clarifying questions based on ambiguous patterns
        clarifying_responses = {
            "inventory": {
                "question": "I can help with inventory management. Are you looking for:",
                "options": [
                    "Equipment inventory and status",
                    "Product inventory management",
                    "Inventory tracking and reporting",
                ],
            },
            "management": {
                "question": "What type of management do you need help with?",
                "options": [
                    "Equipment management",
                    "Task management",
                    "Safety management",
                ],
            },
            "help": {
                "question": "I'm here to help! What would you like to do?",
                "options": [
                    "Check equipment status",
                    "Create a task",
                    "View safety procedures",
                    "Upload a document",
                ],
            },
            "assistance": {
                "question": "I can assist you with warehouse operations. What do you need?",
                "options": [
                    "Equipment assistance",
                    "Task assistance",
                    "Safety assistance",
                    "Document assistance",
                ],
            },
        }

        # Find matching pattern
        for pattern, response in clarifying_responses.items():
            if pattern in message_lower:
                # Create clarifying question response
                clarifying_message = AIMessage(content=response["question"])
                state["messages"].append(clarifying_message)

                # Store clarifying context
                state["context"]["clarifying"] = {
                    "text": response["question"],
                    "options": response["options"],
                    "original_query": message_text,
                }

                state["agent_responses"]["clarifying"] = response["question"]
                state["final_response"] = response["question"]
                return state

        # Default clarifying question
        default_response = {
            "question": "I can help with warehouse operations. What would you like to do?",
            "options": [
                "Check equipment status",
                "Create a task",
                "View safety procedures",
                "Upload a document",
            ],
        }

        clarifying_message = AIMessage(content=default_response["question"])
        state["messages"].append(clarifying_message)

        state["context"]["clarifying"] = {
            "text": default_response["question"],
            "options": default_response["options"],
            "original_query": message_text,
        }

        state["agent_responses"]["clarifying"] = default_response["question"]
        state["final_response"] = default_response["question"]

    except Exception as e:
        logger.error(f"Error handling ambiguous query: {e}")
        state["final_response"] = (
            "I'm not sure how to help with that. Could you please be more specific?"
        )

    return state


def route_intent(state: WarehouseState) -> WarehouseState:
    """Route user message to appropriate agent based on intent classification."""
    try:
        # Get the latest user message
        message_text = _extract_message_text(state)
        if not message_text:
            state["user_intent"] = "general"
            state["routing_decision"] = "general"
            return state

        # Classify intent
        intent = IntentClassifier.classify_intent(message_text)
        state["user_intent"] = intent
        state["routing_decision"] = intent

        logger.info(
            f"Intent classified as: {intent} for message: {message_text[:100]}..."
        )

        # Handle ambiguous queries with clarifying questions
        if intent == "ambiguous":
            return handle_ambiguous_query(state)

    except Exception as e:
        logger.error(f"Error in intent routing: {e}")
        state["user_intent"] = "general"
        state["routing_decision"] = "general"

    return state


async def equipment_agent(state: WarehouseState) -> WarehouseState:
    """Handle equipment-related queries using the Equipment & Asset Operations Agent."""
    try:
        message_text = _extract_message_text(state)
        if not message_text:
            state["agent_responses"]["equipment"] = "No message to process"
            return state

        # Get session ID from context
        session_id = state.get("session_id", "default")

        # Process with Equipment & Asset Operations Agent
        response = await _process_equipment_query(
            query=message_text, session_id=session_id, context=state.get("context", {})
        )

        # Store the response dict directly
        state["agent_responses"]["equipment"] = response

        logger.info(
            f"Equipment agent processed request with confidence: {response.get('confidence', 0)}"
        )

    except Exception as e:
        logger.error(f"Error in equipment agent: {e}")
        state["agent_responses"]["equipment"] = _create_error_response("equipment", e)

    return state


async def operations_agent(state: WarehouseState) -> WarehouseState:
    """Handle operations-related queries using the Operations Coordination Agent."""
    try:
        message_text = _extract_message_text(state)
        if not message_text:
            state["agent_responses"]["operations"] = "No message to process"
            return state

        # Get session ID from context
        session_id = state.get("session_id", "default")

        # Process with Operations Coordination Agent
        response = await _process_operations_query(
            query=message_text, session_id=session_id, context=state.get("context", {})
        )

        # Store the response dict directly
        state["agent_responses"]["operations"] = response

        logger.info(
            f"Operations agent processed request with confidence: {response.get('confidence', 0)}"
        )

    except Exception as e:
        logger.error(f"Error in operations agent: {e}")
        state["agent_responses"]["operations"] = _create_error_response("operations", e)

    return state


async def safety_agent(state: WarehouseState) -> WarehouseState:
    """Handle safety and compliance queries using the Safety & Compliance Agent."""
    try:
        message_text = _extract_message_text(state)
        if not message_text:
            state["agent_responses"]["safety"] = "No message to process"
            return state

        # Get session ID from context
        session_id = state.get("session_id", "default")

        # Process with Safety & Compliance Agent
        response = await _process_safety_query(
            query=message_text, session_id=session_id, context=state.get("context", {})
        )

        # Store the response dict directly
        state["agent_responses"]["safety"] = response

        logger.info(
            f"Safety agent processed request with confidence: {response.get('confidence', 0)}"
        )

    except Exception as e:
        logger.error(f"Error in safety agent: {e}")
        state["agent_responses"]["safety"] = _create_error_response("safety", e)

    return state


async def document_agent(state: WarehouseState) -> WarehouseState:
    """Handle document-related queries using the Document Extraction Agent."""
    try:
        message_text = _extract_message_text(state)
        if not message_text:
            state["agent_responses"]["document"] = "No message to process"
            return state

        # Get session ID from context
        session_id = state.get("session_id", "default")

        # Process with Document Extraction Agent
        response = await _process_document_query(
            query=message_text, session_id=session_id, context=state.get("context", {})
        )

        # Store the response dict directly
        state["agent_responses"]["document"] = response

        logger.info(
            f"Document agent processed request with confidence: {response.get('confidence', 0)}"
        )

    except Exception as e:
        logger.error(f"Error in document agent: {e}")
        state["agent_responses"]["document"] = _create_error_response("document", e)

    return state


def general_agent(state: WarehouseState) -> WarehouseState:
    """Handle general queries that don't fit specific categories."""
    try:
        # Placeholder for general agent logic
        response = "[GENERAL AGENT] Processing general query... (stub implementation)"

        state["agent_responses"]["general"] = response
        logger.info("General agent processed request")

    except Exception as e:
        logger.error(f"Error in general agent: {e}")
        state["agent_responses"][
            "general"
        ] = f"Error processing general request: {str(e)}"

    return state


def synthesize_response(state: WarehouseState) -> WarehouseState:
    """Synthesize final response from agent outputs."""
    try:
        routing_decision = state.get("routing_decision", "general")
        agent_responses = state.get("agent_responses", {})

        # Get the response from the appropriate agent
        if routing_decision in agent_responses:
            agent_response = agent_responses[routing_decision]

            # Handle new structured response format
            if (
                isinstance(agent_response, dict)
                and "natural_language" in agent_response
            ):
                # Extract natural_language and ensure it's a string
                natural_lang = agent_response.get("natural_language")
                if isinstance(natural_lang, str) and natural_lang.strip():
                    final_response = natural_lang
                else:
                    # If natural_language is missing or invalid, use fallback
                    logger.warning(f"natural_language is missing or invalid in agent_response, using fallback")
                    final_response = "I processed your request, but couldn't generate a detailed response. Please try rephrasing your question."
                # Store structured data in context for API response
                state["context"]["structured_response"] = agent_response
            elif isinstance(agent_response, str):
                # Handle legacy string response format
                final_response = agent_response
            else:
                # For other types (dict without natural_language, objects), use fallback
                logger.warning(f"Unexpected agent_response type: {type(agent_response)}, using fallback")
                final_response = "I processed your request, but couldn't generate a detailed response. Please try rephrasing your question."
        else:
            final_response = "I'm sorry, I couldn't process your request. Please try rephrasing your question."

        state["final_response"] = final_response

        # Add AI message to conversation
        if state["messages"]:
            ai_message = AIMessage(content=final_response)
            state["messages"].append(ai_message)

        logger.info(f"Response synthesized for routing decision: {routing_decision}")

    except Exception as e:
        logger.error(f"Error synthesizing response: {e}")
        state["final_response"] = (
            "I encountered an error processing your request. Please try again."
        )

    return state


def route_to_agent(state: WarehouseState) -> str:
    """Route to the appropriate agent based on intent classification."""
    routing_decision = state.get("routing_decision", "general")
    return routing_decision


def create_planner_graph() -> StateGraph:
    """Create the main planner/router graph for warehouse operations."""

    # Initialize the state graph
    workflow = StateGraph(WarehouseState)

    # Add nodes
    workflow.add_node("route_intent", route_intent)
    workflow.add_node("equipment", equipment_agent)
    workflow.add_node("operations", operations_agent)
    workflow.add_node("safety", safety_agent)
    workflow.add_node("document", document_agent)
    workflow.add_node("general", general_agent)
    workflow.add_node("synthesize", synthesize_response)

    # Set entry point
    workflow.set_entry_point("route_intent")

    # Add conditional edges for routing
    workflow.add_conditional_edges(
        "route_intent",
        route_to_agent,
        {
            "equipment": "equipment",
            "operations": "operations",
            "safety": "safety",
            "document": "document",
            "general": "general",
        },
    )

    # Add edges from agents to synthesis
    workflow.add_edge("equipment", "synthesize")
    workflow.add_edge("operations", "synthesize")
    workflow.add_edge("safety", "synthesize")
    workflow.add_edge("document", "synthesize")
    workflow.add_edge("general", "synthesize")

    # Add edge from synthesis to end
    workflow.add_edge("synthesize", END)

    # SECURITY: We intentionally use in-memory state management (no checkpointer)
    # to avoid CVE-2025-8709 (SQL injection in langgraph-checkpoint-sqlite).
    # If persistence is needed, use a secure checkpoint backend (e.g., Postgres).
    return workflow.compile()  # No checkpointer = in-memory state


# Global graph instance
planner_graph = create_planner_graph()


async def process_warehouse_query(
    message: str, session_id: str = "default", context: Optional[Dict] = None
) -> Dict[str, any]:
    """
    Process a warehouse query through the planner graph.

    Args:
        message: User's message/query
        session_id: Session identifier for context
        context: Additional context for the query

    Returns:
        Dictionary containing the response and metadata
    """
    try:
        # Initialize state
        initial_state = WarehouseState(
            messages=[HumanMessage(content=message)],
            user_intent=None,
            routing_decision=None,
            agent_responses={},
            final_response=None,
            context=context or {},
            session_id=session_id,
        )

        # Run the graph asynchronously
        result = await planner_graph.ainvoke(initial_state)

        return {
            "response": result.get("final_response", "No response generated"),
            "intent": result.get("user_intent", "unknown"),
            "route": result.get("routing_decision", "unknown"),
            "session_id": session_id,
            "context": result.get("context", {}),
        }

    except Exception as e:
        logger.error(f"Error processing warehouse query: {e}")
        return {
            "response": f"I encountered an error processing your request: {str(e)}",
            "intent": "error",
            "route": "error",
            "session_id": session_id,
            "context": {},
        }


async def _process_document_query(query: str, session_id: str, context: Dict) -> Any:
    """Async document agent processing."""
    try:
        from src.api.agents.document.mcp_document_agent import (
            get_mcp_document_agent,
        )

        # Get document agent
        document_agent = await get_mcp_document_agent()

        # Process query
        response = await document_agent.process_query(
            query=query, session_id=session_id, context=context
        )

        # Convert DocumentResponse to dict
        if hasattr(response, "__dict__"):
            return response.__dict__
        else:
            return {
                "response_type": getattr(response, "response_type", "unknown"),
                "data": getattr(response, "data", {}),
                "natural_language": getattr(response, "natural_language", ""),
                "recommendations": getattr(response, "recommendations", []),
                "confidence": getattr(response, "confidence", 0.0),
                "actions_taken": getattr(response, "actions_taken", []),
            }

    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        # Return a fallback response
        from src.api.agents.document.models.document_models import DocumentResponse

        return DocumentResponse(
            response_type="error",
            data={"error": str(e)},
            natural_language=f"Error processing document query: {str(e)}",
            recommendations=[],
            confidence=0.0,
            actions_taken=[],
        )


# Legacy function for backward compatibility
def route_intent(text: str) -> str:
    """Legacy function for simple intent routing."""
    return IntentClassifier.classify_intent(text)


def _create_fallback_response(response_class: type, agent_name: str, error: Exception) -> Any:
    """
    Create fallback response for agent processing failures.
    
    Args:
        response_class: Response class to instantiate
        agent_name: Name of the agent
        error: Exception that occurred
        
    Returns:
        Fallback response instance
    """
    return response_class(
        response_type="error",
        data={"error": str(error)},
        natural_language=f"Error processing {agent_name} query: {str(error)}",
        recommendations=[],
        confidence=0.0,
        actions_taken=[],
    )


async def _process_safety_query(query: str, session_id: str, context: Dict) -> Any:
    """Async safety agent processing."""
    try:
        from src.api.agents.safety.safety_agent import get_safety_agent, SafetyResponse

        # Get safety agent
        safety_agent = await get_safety_agent()

        # Process query
        response = await safety_agent.process_query(
            query=query, session_id=session_id, context=context
        )

        # Convert SafetyResponse to dict
        return asdict(response)

    except Exception as e:
        logger.error(f"Safety processing failed: {e}")
        from src.api.agents.safety.safety_agent import SafetyResponse
        return _create_fallback_response(SafetyResponse, "safety", e)


async def _process_operations_query(query: str, session_id: str, context: Dict) -> Any:
    """Async operations agent processing."""
    try:
        from src.api.agents.operations.operations_agent import get_operations_agent, OperationsResponse

        # Get operations agent
        operations_agent = await get_operations_agent()

        # Process query
        response = await operations_agent.process_query(
            query=query, session_id=session_id, context=context
        )

        # Convert OperationsResponse to dict
        return asdict(response)

    except Exception as e:
        logger.error(f"Operations processing failed: {e}")
        from src.api.agents.operations.operations_agent import OperationsResponse
        return _create_fallback_response(OperationsResponse, "operations", e)


async def _process_equipment_query(query: str, session_id: str, context: Dict) -> Any:
    """Async equipment agent processing."""
    try:
        from src.api.agents.inventory.equipment_agent import get_equipment_agent, EquipmentResponse

        # Get equipment agent
        equipment_agent = await get_equipment_agent()

        # Process query
        response = await equipment_agent.process_query(
            query=query, session_id=session_id, context=context
        )

        # Convert EquipmentResponse to dict
        return asdict(response)

    except Exception as e:
        logger.error(f"Equipment processing failed: {e}")
        from src.api.agents.inventory.equipment_agent import EquipmentResponse
        return _create_fallback_response(EquipmentResponse, "equipment", e)
