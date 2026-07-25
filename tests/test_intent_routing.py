# SPDX-License-Identifier: Apache-2.0
"""Routing regression tests.

These exist because the original classifier matched keywords as substrings:
"Acme Steel Bolts" matched "bol" (bill of lading) and "reorder point" matched
"po" (purchase order), so inventory questions were answered by the document
agent. Every case below is a query a demo visitor would plausibly type.
"""

import pytest

from src.api.graphs.intent_rules import classify, explain

CASES = [
    # inventory (inventory_items)
    ("How many Acme Steel Bolts do we have and where are they stored?", "inventory"),
    ("What is my current inventory level?", "inventory"),
    ("Which items are below reorder point?", "inventory"),
    ("Where is SKU-1042 located?", "inventory"),
    ("Show me low stock items", "inventory"),
    ("How many units of Doritos do we have?", "inventory"),
    # equipment (equipment_assets)
    ("Which forklifts are available right now?", "equipment"),
    ("What is the battery level of AMR-02?", "equipment"),
    ("Is forklift FL-03 due for maintenance?", "equipment"),
    ("What is the equipment utilization report?", "equipment"),
    # operations
    ("Create a pick wave for zone A", "operations"),
    ("How many tasks are open today?", "operations"),
    ("Which workers are on the night shift?", "operations"),
    ("What is the throughput today?", "operations"),
    # safety
    ("Show me open safety incidents", "safety"),
    ("There is a spill in aisle 4", "safety"),
    ("Any PPE violations this week?", "safety"),
    # forecasting
    ("Forecast demand for next 7 days", "forecasting"),
    ("Predict stockouts for next month", "forecasting"),
    # document
    ("Upload an invoice PDF", "document"),
    ("What documents have been processed?", "document"),
    ("Show me the bill of lading for PO-2291", "document"),
    # general
    ("Hello, what can you do?", "general"),
    ("hi", "general"),
]


@pytest.mark.parametrize("message,expected", CASES)
def test_routes(message, expected):
    assert classify(message) == expected, explain(message)


@pytest.mark.parametrize(
    "message",
    [
        "How many bolts are in stock?",       # 'bol' must not match 'bolts'
        "Which items are below reorder point?",  # 'po' must not match 'point'
        "What is the utilization report?",       # 'po' must not match 'report'
        "Show me the profile of aisle 7",        # 'file' must not match 'profile'
    ],
)
def test_substring_traps_do_not_route_to_document(message):
    assert classify(message) != "document", explain(message)


def test_explain_exposes_matched_terms():
    out = explain("Which forklifts need maintenance?")
    assert out["route"] == "equipment"
    assert "forklifts" in out["matched_terms"]["equipment"]
