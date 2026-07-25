# SPDX-License-Identifier: Apache-2.0
"""
Rule-based intent classification for the warehouse planner graph.

Why this module exists
----------------------
The original classifiers matched keywords with a plain ``keyword in message``
substring test. That is wrong in a way that is invisible until you demo it:

    "Acme Steel Bolts"      -> matched "bol"  (bill of lading) -> document agent
    "below reorder point"   -> matched "po"   (purchase order) -> document agent
    "utilization report"    -> matched "po"                    -> document agent

Every one of those should have gone to the inventory/equipment agent. The fix is
word-boundary matching plus a score-and-compare step instead of a chain of early
returns, so that a single weak keyword can no longer hijack the route.

Routes returned here must exist as nodes in the planner graph:
``equipment | operations | safety | forecasting | document | general``
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Tuple

# --------------------------------------------------------------------------
# Term tables.  Weight 3 = the term alone is strong evidence for the route.
#               Weight 1 = supporting evidence only.
# --------------------------------------------------------------------------

Terms = List[Tuple[str, int]]

DOCUMENT: Terms = [
    ("document", 3), ("documents", 3), ("paperwork", 3), ("pdf", 3),
    ("invoice", 3), ("invoices", 3), ("receipt", 3), ("receipts", 3),
    ("bill of lading", 3), ("purchase order", 3), ("packing slip", 3),
    ("ocr", 3), ("extraction", 3), ("extract", 2), ("upload", 2),
    ("uploaded", 2), ("scanned", 2), ("attachment", 3), ("attachments", 3),
    ("file", 1), ("files", 1), ("page", 1), ("pages", 1),
    ("po number", 3), ("bol", 3), ("po", 1),
]

FORECASTING: Terms = [
    ("forecast", 3), ("forecasts", 3), ("forecasting", 3), ("predict", 3),
    ("prediction", 3), ("projected", 3), ("projection", 3), ("demand plan", 3),
    ("next week", 2), ("next month", 2), ("next 7 days", 2), ("trend", 2),
    ("seasonality", 3), ("model accuracy", 3), ("mape", 3), ("train a model", 3),
]

SAFETY: Terms = [
    ("safety", 3), ("incident", 3), ("incidents", 3), ("hazard", 3),
    ("hazards", 3), ("injury", 3), ("injuries", 3), ("accident", 3),
    ("near miss", 3), ("ppe", 3), ("compliance", 3), ("audit", 2),
    ("lockout", 3), ("tagout", 3), ("loto", 3), ("evacuation", 3),
    ("spill", 3), ("fire", 3), ("flooding", 3), ("unsafe", 3),
    ("violation", 2), ("osha", 3), ("checklist", 2), ("protocol", 2),
    ("emergency", 3), ("danger", 2),
]

EQUIPMENT: Terms = [
    # assets
    ("forklift", 3), ("forklifts", 3), ("amr", 3), ("agv", 3),
    ("conveyor", 3), ("conveyors", 3), ("scanner", 3), ("scanners", 3),
    ("charger", 3), ("chargers", 3), ("asset", 2), ("assets", 2),
    ("equipment", 3), ("telemetry", 3), ("battery", 3), ("maintenance", 3),
    ("utilization", 2), ("downtime", 2), ("uptime", 2),
    # inventory (served by the same agent)
    ("inventory", 3), ("stock", 3), ("sku", 3), ("skus", 3),
    ("on hand", 3), ("on-hand", 3), ("quantity", 2), ("quantities", 2),
    ("reorder", 3), ("reorder point", 3), ("safety stock", 3),
    ("stored", 2), ("storage", 2), ("location", 2), ("locations", 2),
    ("bin", 2), ("aisle", 3), ("rack", 2), ("pallet", 2), ("pallets", 2),
    ("units", 1), ("available", 1), ("availability", 1), ("count", 1),
    ("stockout", 3), ("shortage", 2), ("replenish", 3), ("replenishment", 3),
]

OPERATIONS: Terms = [
    ("task", 3), ("tasks", 3), ("wave", 3), ("waves", 3), ("pick wave", 3),
    ("order", 2), ("orders", 2), ("shift", 3), ("shifts", 3),
    ("workforce", 3), ("worker", 2), ("workers", 2), ("staff", 2),
    ("labour", 2), ("labor", 2), ("throughput", 3), ("backlog", 3),
    ("putaway", 3), ("picking", 3), ("packing", 3), ("dispatch", 2),
    ("zone", 2), ("zones", 2), ("assign", 2), ("assigned", 2),
    ("schedule", 2), ("kpi", 2), ("kpis", 2), ("performance", 2),
    ("productivity", 3), ("dock", 2), ("inbound", 2), ("outbound", 2),
]

GREETINGS = {
    "hi", "hello", "hey", "thanks", "thank you", "help", "what can you do",
    "who are you", "what is this", "good morning", "good evening",
}

_ROUTES: Dict[str, Terms] = {
    "document": DOCUMENT,
    "forecasting": FORECASTING,
    "safety": SAFETY,
    "equipment": EQUIPMENT,
    "operations": OPERATIONS,
}

# Tie-break order when two routes score identically. Safety first because a
# missed safety query is the most costly error; document last because it is the
# route the old substring matcher over-triggered.
_PRIORITY = ["safety", "forecasting", "operations", "equipment", "document"]

_MIN_SCORE = 2  # below this the message is treated as general chit-chat

_word_re_cache: Dict[str, re.Pattern] = {}


def _pattern(term: str) -> re.Pattern:
    """Whole-word (or whole-phrase) matcher for a term."""
    pat = _word_re_cache.get(term)
    if pat is None:
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])")
        _word_re_cache[term] = pat
    return pat


def score_route(message_lower: str, terms: Iterable[Tuple[str, int]]) -> int:
    return sum(weight for term, weight in terms if _pattern(term).search(message_lower))


def score_all(message: str) -> Dict[str, int]:
    """Return the raw score for every route — useful for debugging and tests."""
    m = message.lower().strip()
    return {route: score_route(m, terms) for route, terms in _ROUTES.items()}


def classify(message: str) -> str:
    """Classify a user message into a planner-graph route."""
    if not message or not message.strip():
        return "general"

    m = message.lower().strip()
    stripped = m.rstrip("?.!")

    # Greetings and meta-questions never belong to a domain agent.
    if stripped in GREETINGS or len(stripped.split()) <= 2 and stripped in GREETINGS:
        return "general"

    scores = score_all(m)

    # Emergencies bypass scoring entirely.
    if _pattern("emergency").search(m) or _pattern("evacuate").search(m) or \
       _pattern("fire").search(m) or _pattern("spill").search(m) or \
       _pattern("injury").search(m):
        return "safety"

    best = max(scores.values())
    if best < _MIN_SCORE:
        return "general"

    winners = [r for r, s in scores.items() if s == best]
    if len(winners) == 1:
        return winners[0]

    for route in _PRIORITY:
        if route in winners:
            return route
    return "general"


def explain(message: str) -> Dict[str, object]:
    """Scores plus the matched terms — surfaced in the UI's reasoning trace."""
    m = message.lower().strip()
    matched = {
        route: [t for t, _ in terms if _pattern(t).search(m)]
        for route, terms in _ROUTES.items()
    }
    return {
        "route": classify(message),
        "scores": score_all(message),
        "matched_terms": {k: v for k, v in matched.items() if v},
    }
