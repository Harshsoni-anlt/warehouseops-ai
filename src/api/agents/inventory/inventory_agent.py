# SPDX-License-Identifier: Apache-2.0
"""
Inventory agent — answers stock questions from the database.

Why this is a separate agent
----------------------------
Stock questions ("how many Acme Steel Bolts do we have, and where?") used to be
routed to the equipment agent, which only knows about forklifts, scanners and
conveyors. It would answer, confidently, that the item does not exist — while
the row sat in ``inventory_items``. Equipment and inventory are different
domains with different tables; they get different agents.

Design
------
Retrieve first, then phrase. Every number in the answer comes from a SQL row.
The LLM is only allowed to write prose around rows that were actually fetched,
and if nothing was fetched it says so rather than inventing stock levels.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_SKU_RE = re.compile(r"\b([A-Z]{2,4}[- ]?\d{2,5})\b")

_STOPWORDS = {
    "how", "many", "much", "what", "where", "which", "who", "when", "the", "and",
    "are", "for", "you", "our", "was", "have", "has", "had", "with", "there",
    "they", "them", "this", "that", "from", "into", "out", "get", "got", "not",
    "but", "its", "some", "more", "most", "now", "new", "old", "please", "show",
    "tell", "give", "any", "all", "does", "did", "can", "stored", "store",
    "inventory", "stock", "left", "units", "unit", "level", "levels", "warehouse",
    "we", "do", "is", "in", "of", "on", "at", "a", "an", "me", "my",
}


@dataclass
class InventoryResponse:
    """Structured answer returned to the planner graph."""

    natural_language: str
    data: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    confidence: float = 0.0
    response_type: str = "inventory_info"
    actions_taken: List[Dict[str, Any]] = field(default_factory=list)


class InventoryAgent:
    """Answers inventory questions from ``inventory_items``."""

    def __init__(self) -> None:
        self._sql = None
        self._queries = None
        self._llm = None

    async def initialize(self) -> None:
        if self._queries is not None:
            return
        from src.retrieval.structured.sql_retriever import get_sql_retriever
        from src.retrieval.structured.inventory_queries import InventoryQueries

        self._sql = await get_sql_retriever()
        self._queries = InventoryQueries(self._sql)
        logger.info("Inventory agent initialised")

    # ---------------------------------------------------------------- parsing

    @staticmethod
    def parse_intent(query: str) -> str:
        q = query.lower()
        if any(t in q for t in ("low stock", "below reorder", "reorder point",
                                "running low", "stockout", "replenish", "restock")):
            return "low_stock"
        if any(t in q for t in ("summary", "overview", "total inventory",
                                "how much inventory", "how many items")):
            return "summary"
        if any(t in q for t in ("where", "location", "aisle", "zone", "stored")):
            return "locate"
        return "lookup"

    @staticmethod
    def extract_terms(query: str) -> Dict[str, Any]:
        """Pull a SKU and/or product keywords out of the question."""
        sku_match = _SKU_RE.search(query.upper())
        sku = sku_match.group(1).replace(" ", "-") if sku_match else None

        words = re.findall(r"[a-zA-Z][a-zA-Z0-9'&]+", query.lower())
        keywords = [w for w in words if len(w) >= 3 and w not in _STOPWORDS]
        return {"sku": sku, "keywords": keywords}

    # -------------------------------------------------------------- retrieval

    async def _search(self, keywords: List[str], limit: int = 25) -> List[Dict[str, Any]]:
        """Search by name/SKU. Tries the whole phrase, then narrows word by word."""
        if not keywords:
            return []

        attempts = [" ".join(keywords)] + keywords
        seen: set = set()
        rows: List[Dict[str, Any]] = []
        for term in attempts:
            found = await self._sql.execute_query(
                """
                SELECT sku, name, quantity, location, reorder_point, updated_at
                FROM inventory_items
                WHERE LOWER(name) LIKE $1 OR LOWER(sku) LIKE $1
                ORDER BY quantity DESC
                LIMIT $2
                """,
                (f"%{term.lower()}%", limit),
            )
            for r in found:
                d = dict(r)
                if d["sku"] not in seen:
                    seen.add(d["sku"])
                    rows.append(d)
            if rows:
                break
        return rows

    async def _fetch(self, intent: str, terms: Dict[str, Any]) -> Dict[str, Any]:
        if intent == "summary":
            summary = await self._queries.get_inventory_summary()
            return {"kind": "summary", "summary": summary}

        if intent == "low_stock":
            items = await self._sql.execute_query(
                """
                SELECT sku, name, quantity, location, reorder_point
                FROM inventory_items
                WHERE quantity <= reorder_point
                ORDER BY (quantity - reorder_point) ASC
                LIMIT 25
                """
            )
            return {"kind": "low_stock", "items": [dict(r) for r in items]}

        if terms["sku"]:
            exact = await self._sql.execute_query(
                """
                SELECT sku, name, quantity, location, reorder_point, updated_at
                FROM inventory_items WHERE UPPER(sku) = $1
                """,
                (terms["sku"].upper(),),
            )
            if exact:
                return {"kind": "items", "items": [dict(r) for r in exact]}

        return {"kind": "items", "items": await self._search(terms["keywords"])}

    # --------------------------------------------------------------- phrasing

    @staticmethod
    def _format_items(items: List[Dict[str, Any]]) -> str:
        lines = []
        for it in items[:10]:
            low = it.get("reorder_point") is not None and it["quantity"] <= it["reorder_point"]
            flag = "  ⚠ at or below reorder point" if low else ""
            lines.append(
                f"- **{it['name']}** (`{it['sku']}`) — {it['quantity']:,} units"
                f" at {it.get('location') or 'no location recorded'}{flag}"
            )
        return "\n".join(lines)

    async def _phrase(self, query: str, fetched: Dict[str, Any]) -> str:
        """Deterministic phrasing. No LLM call, so no room to invent numbers."""
        kind = fetched["kind"]

        if kind == "summary":
            s = fetched["summary"] or {}
            low = s.get("low_stock_count", 0) or 0
            tail = (
                "Nothing is at or below its reorder point."
                if low == 0
                else f"**{low}** {'is' if low == 1 else 'are'} at or below the reorder point."
            )
            return (
                f"There are **{s.get('total_items', 0):,} SKUs** in inventory totalling "
                f"**{s.get('total_quantity', 0):,} units**. " + tail
            )

        if kind == "low_stock":
            items = fetched["items"]
            if not items:
                return "Nothing is at or below its reorder point right now."
            noun = "item is" if len(items) == 1 else "items are"
            return (
                f"**{len(items)}** {noun} at or below the reorder point:\n\n"
                + InventoryAgent._format_items(items)
            )

        items = fetched["items"]
        if not items:
            return (
                "I couldn't find that item in inventory. I searched `inventory_items` "
                "by name and SKU. If you've just imported data, check the SKU spelling — "
                "or use **Import Data** to load it."
            )
        if len(items) == 1:
            it = items[0]
            body = (
                f"**{it['name']}** (`{it['sku']}`) — **{it['quantity']:,} units** "
                f"at **{it.get('location') or 'no location recorded'}**."
            )
            if it.get("reorder_point") is not None:
                if it["quantity"] <= it["reorder_point"]:
                    body += (
                        f"\n\n⚠ That is at or below the reorder point of "
                        f"{it['reorder_point']:,} — worth replenishing."
                    )
                else:
                    body += (
                        f" Reorder point is {it['reorder_point']:,}, so there is "
                        f"{it['quantity'] - it['reorder_point']:,} units of headroom."
                    )
            return body

        more = f"\n\n_Showing 10 of {len(items)}._" if len(items) > 10 else ""
        return (
            f"Found **{len(items)}** matching items:\n\n"
            + InventoryAgent._format_items(items)
            + more
        )

    # ------------------------------------------------------------------ entry

    async def process_query(
        self,
        query: str,
        session_id: str = "default",
        context: Optional[Dict[str, Any]] = None,
        **_: Any,
    ) -> InventoryResponse:
        try:
            await self.initialize()

            intent = self.parse_intent(query)
            terms = self.extract_terms(query)
            fetched = await self._fetch(intent, terms)
            text = await self._phrase(query, fetched)

            items = fetched.get("items", [])
            recommendations: List[str] = []
            low = [i for i in items if i.get("reorder_point") is not None
                   and i["quantity"] <= i["reorder_point"]]
            if low:
                recommendations.append(
                    f"Raise a replenishment task for {', '.join(i['sku'] for i in low[:3])}"
                )
            if intent == "locate" and len(items) == 1:
                recommendations.append(f"Create a cycle count for {items[0]['sku']}")

            confidence = 0.9 if items or fetched["kind"] != "items" else 0.4

            return InventoryResponse(
                natural_language=text,
                data=fetched,
                recommendations=recommendations,
                confidence=confidence,
                actions_taken=[
                    {
                        "action": "sql_query",
                        "target": "inventory_items",
                        "intent": intent,
                        "rows_returned": len(items) if fetched["kind"] == "items" else None,
                    }
                ],
            )

        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Inventory agent failed: {e}", exc_info=True)
            return InventoryResponse(
                natural_language=(
                    "I couldn't read the inventory table just now. "
                    "The database may still be starting up."
                ),
                confidence=0.0,
                response_type="error",
            )


_agent: Optional[InventoryAgent] = None


async def get_inventory_agent() -> InventoryAgent:
    global _agent
    if _agent is None:
        _agent = InventoryAgent()
        await _agent.initialize()
    return _agent
