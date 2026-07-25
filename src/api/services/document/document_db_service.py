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
Document Processing Database Service

Provides database persistence for document processing status, stages, and results.
Replaces in-memory dictionary storage with PostgreSQL/TimescaleDB persistence.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
import json
from dataclasses import asdict

from src.retrieval.structured.sql_retriever import SQLRetriever, get_sql_retriever
from src.api.agents.document.models.document_models import ProcessingStage, ProcessingStatus

logger = logging.getLogger(__name__)


class DocumentDBService:
    """Database service for document processing persistence."""

    def __init__(self):
        self.db: Optional[SQLRetriever] = None

    async def initialize(self) -> None:
        """Initialize database connection."""
        try:
            self.db = await get_sql_retriever()
            logger.info("DocumentDBService initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize DocumentDBService: {e}")
            raise

    async def create_document(
        self,
        document_id: str,
        filename: str,
        file_path: str,
        file_type: str,
        file_size: int,
        user_id: str,
        document_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create a new document record in the database."""
        try:
            query = """
                INSERT INTO documents (
                    id, filename, file_path, file_type, file_size,
                    user_id, status, processing_stage, document_type, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    filename = EXCLUDED.filename,
                    file_path = EXCLUDED.file_path,
                    file_type = EXCLUDED.file_type,
                    file_size = EXCLUDED.file_size,
                    updated_at = NOW()
            """
            await self.db.execute_command(
                query,
                str(document_id),
                filename,
                file_path,
                file_type,
                file_size,
                int(user_id) if user_id.isdigit() else None,
                ProcessingStage.UPLOADED.value,
                ProcessingStage.UPLOADED.value,
                document_type,
                json.dumps(metadata or {}),
            )
            logger.info(f"Created document record: {document_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create document record: {e}")
            return False

    async def update_document_status(
        self,
        document_id: str,
        status: str,
        processing_stage: Optional[str] = None,
        progress: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> bool:
        """Update document status in the database."""
        try:
            query = """
                UPDATE documents
                SET status = $1,
                    processing_stage = COALESCE($2, processing_stage),
                    updated_at = NOW()
                WHERE id = $3
            """
            await self.db.execute_command(
                query,
                status,
                processing_stage,
                str(document_id),
            )
            logger.debug(f"Updated document status: {document_id} -> {status}")
            return True
        except Exception as e:
            logger.error(f"Failed to update document status: {e}")
            return False

    async def create_processing_stage(
        self,
        document_id: str,
        stage_name: str,
        status: str = "pending",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Create a processing stage record."""
        try:
            stage_id = str(uuid.uuid4())
            query = """
                INSERT INTO processing_stages (
                    id, document_id, stage_name, status, started_at, metadata
                ) VALUES ($1, $2, $3, $4, NOW(), $5)
            """
            await self.db.execute_command(
                query,
                str(stage_id),
                str(document_id),
                stage_name,
                status,
                json.dumps(metadata or {}),
            )
            return stage_id
        except Exception as e:
            logger.error(f"Failed to create processing stage: {e}")
            return None

    async def update_processing_stage(
        self,
        document_id: str,
        stage_name: str,
        status: str,
        error_message: Optional[str] = None,
        processing_time_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update a processing stage status."""
        try:
            if status == "completed":
                query = """
                    UPDATE processing_stages
                    SET status = $1,
                        completed_at = NOW(),
                        error_message = $2,
                        processing_time_ms = $3,
                        metadata = COALESCE($4, metadata)
                    WHERE document_id = $5 AND stage_name = $6
                """
            else:
                query = """
                    UPDATE processing_stages
                    SET status = $1,
                        error_message = $2,
                        processing_time_ms = $3,
                        metadata = COALESCE($4, metadata)
                    WHERE document_id = $5 AND stage_name = $6
                """
            
            await self.db.execute_command(
                query,
                status,
                error_message,
                processing_time_ms,
                json.dumps(metadata or {}),
                str(document_id),
                stage_name,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update processing stage: {e}")
            return False

    async def get_document_status(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document status from database."""
        try:
            query = """
                SELECT 
                    id, filename, file_path, file_type, file_size,
                    user_id, status, processing_stage, document_type,
                    metadata, upload_timestamp, created_at, updated_at
                FROM documents
                WHERE id = $1
            """
            results = await self.db.execute_query(query, (str(document_id),))
            if not results:
                logger.debug(f"Document {document_id} not found in database")
                return None
            
            doc = results[0]
            # Get processing stages
            stages_query = """
                SELECT 
                    stage_name, status, started_at, completed_at,
                    error_message, processing_time_ms, metadata
                FROM processing_stages
                WHERE document_id = $1
                ORDER BY created_at
            """
            stages = await self.db.execute_query(stages_query, (str(document_id),))
            
            # Calculate progress.
            #
            # processing_stages rows are only written by the legacy pipeline, so
            # for documents processed by the current one there are none — which
            # made this return 0% for a finished document and left the UI
            # polling forever. Fall back to the document's own status.
            doc_status = str(doc.get("status") or "").lower()
            total_stages = len(stages)
            completed_stages = sum(1 for s in stages if s.get("status") == "completed")

            # The document's own status wins when it is terminal. The
            # processing_stages rows are written once at upload and only
            # advanced by the legacy pipeline, so a finished document still had
            # every stage row sitting at 'pending' — reported as
            # "Preprocessing 0%" for a document that was already complete.
            if doc_status in ("completed", "failed"):
                progress = 100 if doc_status == "completed" else 0
            elif total_stages > 0 and completed_stages > 0:
                progress = int(completed_stages / total_stages * 100)
            else:
                progress = {
                    "uploaded": 5,
                    "preprocessing": 25,
                    "ocr_extraction": 50,
                    "llm_processing": 75,
                    "validation": 90,
                    "routing": 95,
                    "completed": 100,
                    "failed": 0,
                }.get(doc_status, 0)

            # Determine current stage
            current_stage = None
            if doc_status in ("completed", "failed"):
                current_stage = doc_status.title()
            else:
                for stage in stages:
                    if stage.get("status") == "processing":
                        current_stage = stage.get("stage_name", "").replace("_", " ").title()
                        break
            if not current_stage:
                stage_name = doc.get("processing_stage") or doc.get("status") or "preprocessing"
                current_stage = str(stage_name).replace("_", " ").title()
            
            # Parse JSONB metadata fields if they're strings
            def parse_jsonb_field(value):
                """Parse JSONB field if it's a string, otherwise return as-is."""
                if isinstance(value, str):
                    try:
                        return json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        return value
                return value
            
            # Ensure we have at least empty stages if none exist
            if not stages:
                # Create default stages structure
                default_stages = [
                    {"stage_name": "preprocessing", "status": "pending"},
                    {"stage_name": "ocr_extraction", "status": "pending"},
                    {"stage_name": "llm_processing", "status": "pending"},
                    {"stage_name": "validation", "status": "pending"},
                    {"stage_name": "routing", "status": "pending"},
                ]
                stages = default_stages
            
            return {
                "document_id": str(doc["id"]),
                "status": doc.get("status", "uploaded"),
                "current_stage": current_stage,
                "progress": progress,
                "stages": [
                    {
                        "name": s.get("stage_name", ""),
                        "status": s.get("status", "pending"),
                        "started_at": s.get("started_at"),
                        "completed_at": s.get("completed_at"),
                        "processing_time_ms": s.get("processing_time_ms"),
                        "error_message": s.get("error_message"),
                        "metadata": parse_jsonb_field(s.get("metadata", {})),
                    }
                    for s in stages
                ],
                "filename": doc.get("filename", ""),
                "document_type": doc.get("document_type", "invoice"),
                "upload_timestamp": doc.get("upload_timestamp"),
            }
        except Exception as e:
            logger.error(f"Failed to get document status: {e}")
            return None

    async def save_extraction_result(
        self,
        document_id: str,
        stage: str,
        raw_data: Dict[str, Any],
        processed_data: Dict[str, Any],
        confidence_score: float,
        processing_time_ms: int,
        model_used: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Save extraction result for a processing stage."""
        try:
            # Ensure all data is JSON-serializable
            def ensure_serializable(obj):
                """Recursively ensure object is JSON serializable."""
                from PIL import Image
                import datetime
                
                if isinstance(obj, Image.Image):
                    return {
                        "type": "pil_image",
                        "size": obj.size,
                        "mode": obj.mode,
                        "format": getattr(obj, "format", None),
                    }
                elif isinstance(obj, datetime.datetime):
                    return obj.isoformat()
                elif isinstance(obj, (datetime.date, datetime.time)):
                    return obj.isoformat()
                elif isinstance(obj, dict):
                    return {k: ensure_serializable(v) for k, v in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [ensure_serializable(item) for item in obj]
                elif isinstance(obj, (str, int, float, bool, type(None))):
                    return obj
                else:
                    # Try to convert to string for unknown types
                    try:
                        return str(obj)
                    except Exception:
                        return None
            
            serialized_raw = ensure_serializable(raw_data)
            serialized_processed = ensure_serializable(processed_data)
            serialized_metadata = ensure_serializable(metadata or {})
            
            # First, delete existing result for this stage if it exists
            delete_query = """
                DELETE FROM extraction_results
                WHERE document_id = $1 AND stage = $2
            """
            await self.db.execute_command(delete_query, str(document_id), stage)
            
            # Then insert new result
            query = """
                INSERT INTO extraction_results (
                    document_id, stage, raw_data, processed_data,
                    confidence_score, processing_time_ms, model_used, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """
            await self.db.execute_command(
                query,
                str(document_id),
                stage,
                json.dumps(serialized_raw),
                json.dumps(serialized_processed),
                confidence_score,
                processing_time_ms,
                model_used,
                json.dumps(serialized_metadata),
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save extraction result: {e}", exc_info=True)
            return False

    async def save_quality_score(
        self,
        document_id: str,
        overall_score: float,
        completeness_score: float,
        accuracy_score: float,
        compliance_score: float,
        quality_score: float,
        decision: str,
        reasoning: Dict[str, Any],
        issues_found: List[str],
        confidence: float,
        judge_model: str,
    ) -> bool:
        """Save quality score for a document."""
        try:
            # First, delete existing quality score if it exists
            delete_query = """
                DELETE FROM quality_scores WHERE document_id = $1
            """
            await self.db.execute_command(delete_query, str(document_id))
            
            # Then insert new quality score
            query = """
                INSERT INTO quality_scores (
                    document_id, overall_score, completeness_score, accuracy_score,
                    compliance_score, quality_score, decision, reasoning,
                    issues_found, confidence, judge_model
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """
            await self.db.execute_command(
                query,
                str(document_id),
                overall_score,
                completeness_score,
                accuracy_score,
                compliance_score,
                quality_score,
                decision,
                json.dumps(reasoning),
                json.dumps(issues_found),
                confidence,
                judge_model,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save quality score: {e}")
            return False

    async def save_routing_decision(
        self,
        document_id: str,
        routing_action: str,
        routing_reason: str,
        wms_integration_status: str,
        wms_integration_data: Dict[str, Any],
        human_review_required: bool,
    ) -> bool:
        """Save routing decision for a document."""
        try:
            # First, delete existing routing decision if it exists
            delete_query = """
                DELETE FROM routing_decisions WHERE document_id = $1
            """
            await self.db.execute_command(delete_query, str(document_id))
            
            # Then insert new routing decision
            query = """
                INSERT INTO routing_decisions (
                    document_id, routing_action, routing_reason,
                    wms_integration_status, wms_integration_data,
                    human_review_required
                ) VALUES ($1, $2, $3, $4, $5, $6)
            """
            await self.db.execute_command(
                query,
                str(document_id),
                routing_action,
                routing_reason,
                wms_integration_status,
                json.dumps(wms_integration_data),
                human_review_required,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save routing decision: {e}")
            return False

    async def get_extraction_results(self, document_id: str) -> Dict[str, Any]:
        """Get all extraction results for a document."""
        try:
            query = """
                SELECT 
                    stage, raw_data, processed_data, confidence_score,
                    processing_time_ms, model_used, metadata
                FROM extraction_results
                WHERE document_id = $1
                ORDER BY created_at
            """
            results = await self.db.execute_query(query, (str(document_id),))
            
            # Helper to parse JSONB fields
            def parse_jsonb_field(value):
                """Parse JSONB field if it's a string, otherwise return as-is."""
                if isinstance(value, str):
                    try:
                        return json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        return value
                elif value is None:
                    return {}
                return value
            
            extraction_results = {}
            for r in results:
                extraction_results[r["stage"]] = {
                    "raw_data": parse_jsonb_field(r.get("raw_data", {})),
                    "processed_data": parse_jsonb_field(r.get("processed_data", {})),
                    "confidence_score": r.get("confidence_score", 0.0),
                    "processing_time_ms": r.get("processing_time_ms", 0),
                    "model_used": r.get("model_used", ""),
                    "metadata": parse_jsonb_field(r.get("metadata", {})),
                }
            
            # Get quality score
            quality_query = """
                SELECT * FROM quality_scores WHERE document_id = $1
            """
            quality_results = await self.db.execute_query(quality_query, (str(document_id),))
            quality_score = None
            if quality_results:
                q = quality_results[0]
                quality_score = {
                    "overall_score": q.get("overall_score", 0.0),
                    "completeness_score": q.get("completeness_score", 0.0),
                    "accuracy_score": q.get("accuracy_score", 0.0),
                    "compliance_score": q.get("compliance_score", 0.0),
                    "quality_score": q.get("quality_score", 0.0),
                    "decision": q.get("decision", "REVIEW_REQUIRED"),
                    "reasoning": parse_jsonb_field(q.get("reasoning", {})),
                    "issues_found": parse_jsonb_field(q.get("issues_found", [])),
                    "confidence": q.get("confidence", 0.0),
                    "judge_model": q.get("judge_model", ""),
                }
            
            # Get routing decision
            routing_query = """
                SELECT * FROM routing_decisions WHERE document_id = $1
            """
            routing_results = await self.db.execute_query(routing_query, (str(document_id),))
            routing_decision = None
            if routing_results:
                r = routing_results[0]
                routing_decision = {
                    "routing_action": r.get("routing_action", ""),
                    "routing_reason": r.get("routing_reason", ""),
                    "wms_integration_status": r.get("wms_integration_status", ""),
                    "wms_integration_data": parse_jsonb_field(r.get("wms_integration_data", {})),
                    "human_review_required": r.get("human_review_required", False),
                }
            
            return {
                "extraction_results": extraction_results,
                "quality_score": quality_score,
                "routing_decision": routing_decision,
            }
        except Exception as e:
            logger.error(f"Failed to get extraction results: {e}")
            return {}


# Global service instance
_document_db_service: Optional[DocumentDBService] = None


async def get_document_db_service() -> DocumentDBService:
    """Get or create document database service instance."""
    global _document_db_service
    if _document_db_service is None:
        _document_db_service = DocumentDBService()
        await _document_db_service.initialize()
    return _document_db_service

