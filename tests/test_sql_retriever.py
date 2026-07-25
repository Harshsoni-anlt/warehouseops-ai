# SPDX-License-Identifier: Apache-2.0
"""Tests for the SQLite-backed SQLRetriever and its PostgreSQL-idiom shim.

Run: pytest tests/test_sql_retriever.py
"""

import asyncio
import os
import tempfile

from src.retrieval.structured.sql_retriever import (
    SQLRetriever,
    DatabaseConfig,
    _adapt,
)


def test_placeholder_translation():
    # $n -> ? and simple positional mapping
    q, p = _adapt("SELECT * FROM t WHERE sku = $1", ("A",))
    assert q == "SELECT * FROM t WHERE sku = ?"
    assert p == ["A"]


def test_reused_placeholder_expands():
    # $1 used twice must expand to two ? with the value duplicated
    q, p = _adapt("SELECT * FROM t WHERE a=$1 OR b=$1", ("v",))
    assert q.count("?") == 2
    assert p == ["v", "v"]


def test_reordered_placeholders():
    q, p = _adapt("UPDATE t SET q=$2 WHERE sku=$1", ("A", 9))
    assert q == "UPDATE t SET q=? WHERE sku=?"
    assert p == [9, "A"]


def test_idiom_translation():
    q, _ = _adapt("INSERT INTO t (a,b) VALUES ($1::jsonb, NOW())", ("{}",))
    assert "::jsonb" not in q
    assert "datetime('now')" in q
    q2, _ = _adapt("SELECT * FROM u WHERE name ILIKE $1", ("x",))
    assert "ILIKE" not in q2 and "LIKE" in q2


def _fresh_retriever():
    SQLRetriever._instance = None
    SQLRetriever._initialized = False
    tmp = os.path.join(tempfile.mkdtemp(), "warehouse_test.db")
    return SQLRetriever(DatabaseConfig(db_path=tmp))


def test_schema_bootstrap_and_seed():
    async def run():
        r = _fresh_retriever()
        await r.initialize()
        inv = await r.execute_scalar("SELECT COUNT(*) FROM inventory_items")
        eqp = await r.execute_scalar("SELECT COUNT(*) FROM equipment_assets")
        await r.close()
        return inv, eqp

    inv, eqp = asyncio.run(run())
    assert inv == 16
    assert eqp == 12


def test_query_and_command_roundtrip():
    async def run():
        r = _fresh_retriever()
        await r.initialize()
        rows = await r.execute_query(
            "SELECT sku, quantity FROM inventory_items WHERE sku = $1", ("LAY001",)
        )
        one = await r.fetch_one(
            "SELECT status FROM equipment_assets WHERE asset_id = $1", "FL-01"
        )
        await r.execute_command(
            "UPDATE inventory_items SET quantity = $2, updated_at = NOW() WHERE sku = $1",
            ("LAY001", 42),
        )
        updated = await r.fetch_one(
            "SELECT quantity FROM inventory_items WHERE sku = $1", "LAY001"
        )
        await r.close()
        return rows, one, updated

    rows, one, updated = asyncio.run(run())
    assert rows and rows[0]["sku"] == "LAY001"
    assert one["status"] in {"available", "assigned", "maintenance", "charging"}
    assert updated["quantity"] == 42
