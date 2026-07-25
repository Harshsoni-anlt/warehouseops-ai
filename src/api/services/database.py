# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0

"""
Database service for the Warehouse Operational Assistant (SQLite backend).

Provides a single entry point, `get_database_connection()`, that returns an
asyncpg-compatible connection facade backed by the shared SQLite connection.
Callers can keep using `await conn.execute(...)`, `await conn.fetch(...)`,
`await conn.fetchrow(...)`, `await conn.fetchval(...)` and `await conn.close()`
(close is a safe no-op — the connection is shared).
"""

import os
import logging

from src.retrieval.structured.sql_retriever import (
    get_sql_retriever,
    _ConnProxy,
    _DEFAULT_DB_PATH,
)

logger = logging.getLogger(__name__)

ENV_DB_PATH = "WAREHOUSE_DB_PATH"


def _get_database_url() -> str:
    """Return a SQLite connection URL (kept for backward compatibility)."""
    return f"sqlite:///{os.getenv(ENV_DB_PATH, _DEFAULT_DB_PATH)}"


async def get_database_connection() -> _ConnProxy:
    """
    Get an asyncpg-compatible connection facade over the shared SQLite DB.

    Returns:
        _ConnProxy: supports async execute/fetch/fetchrow/fetchval/close.
    """
    retriever = await get_sql_retriever()
    return _ConnProxy(retriever._conn, retriever._lock)
