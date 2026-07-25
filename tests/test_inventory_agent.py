# SPDX-License-Identifier: Apache-2.0
"""Inventory agent tests against a real SQLite database.

The agent exists because stock questions used to be answered by the equipment
agent, which reads a different table and therefore reported real items as
missing. These tests pin the behaviour that matters for a demo: the numbers in
the answer come from rows, and a miss is reported as a miss.
"""

import asyncio
import sqlite3

import pytest

from src.api.agents.inventory.inventory_agent import InventoryAgent

def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


ROWS = [
    ("ACM-1001", "Acme Steel Bolts M8x40", 4200, "Zone A-Aisle 3-Rack 1", 800),
    ("ACM-1002", "Acme Steel Nuts M8", 120, "Zone A-Aisle 3-Rack 2", 500),
    ("DOR001", "Doritos Nacho Cheese Tortilla Chips", 1120, "Zone B-Aisle 2", 180),
]



@pytest.fixture()
def db(tmp_path, monkeypatch):
    """A database the app itself bootstrapped, with only our rows in inventory.

    ``SQLRetriever.initialize`` always replays ``data/sqlite/schema.sql``, which
    carries seed rows. Hand-rolling a partial schema here would silently pick up
    those seeds and make the assertions meaningless — so let it bootstrap, then
    clear the table and insert the fixture rows.
    """
    path = tmp_path / "wh.db"
    monkeypatch.setenv("WAREHOUSE_DB_PATH", str(path))

    import src.retrieval.structured.sql_retriever as sr

    # The retriever is a module-level singleton; reset it per test.
    sr._sql_retriever = None
    sr.SQLRetriever._instance = None
    sr.SQLRetriever._initialized = False

    run(sr.get_sql_retriever())          # creates + bootstraps the file
    run(sr.close_sql_retriever())

    con = sqlite3.connect(path)
    con.execute("DELETE FROM inventory_items")
    con.executemany(
        "INSERT INTO inventory_items (sku,name,quantity,location,reorder_point)"
        " VALUES (?,?,?,?,?)",
        ROWS,
    )
    con.commit()
    con.close()

    sr._sql_retriever = None
    sr.SQLRetriever._instance = None
    sr.SQLRetriever._initialized = False
    return path


def answer(query: str) -> str:
    agent = InventoryAgent()
    return run(agent.process_query(query)).natural_language


def test_finds_item_by_name_and_reports_location(db):
    text = answer("How many Acme Steel Bolts do we have and where are they stored?")
    assert "4,200" in text
    assert "Zone A-Aisle 3-Rack 1" in text
    assert "ACM-1001" in text


def test_exact_sku_lookup(db):
    text = answer("Where is ACM-1002 stored?")
    assert "Acme Steel Nuts" in text
    assert "120" in text


def test_flags_item_below_reorder_point(db):
    text = answer("Where is ACM-1002 stored?")
    assert "reorder point" in text.lower()


def test_low_stock_listing(db):
    text = answer("Which items are below reorder point?")
    assert "ACM-1002" in text
    assert "ACM-1001" not in text  # well above its reorder point


def test_summary_totals_come_from_rows(db):
    text = answer("Give me an inventory summary")

    # Read the truth back out of the database rather than hard-coding it:
    # SQLRetriever replays schema.sql (which carries seed rows) on every
    # connect, so the fixture rows are not the only rows present.
    con = sqlite3.connect(db)
    skus, units = con.execute(
        "SELECT COUNT(*), SUM(quantity) FROM inventory_items"
    ).fetchone()
    con.close()

    assert f"{skus:,} SKUs" in text
    assert f"{units:,} units" in text


def test_missing_item_is_reported_as_missing_not_invented(db):
    text = answer("How many Widgets do we have?")
    assert "couldn't find" in text.lower()
    # The critical property: no fabricated quantity.
    assert "units" not in text.split("couldn't find")[1].lower()


def test_partial_match_returns_multiple(db):
    text = answer("How many Acme items are in stock?")
    assert "ACM-1001" in text and "ACM-1002" in text


def test_confidence_drops_when_nothing_found(db):
    agent = InventoryAgent()
    hit = run(agent.process_query("How many Acme Steel Bolts do we have?"))
    miss = run(agent.process_query("How many Widgets do we have?"))
    assert hit.confidence > miss.confidence
