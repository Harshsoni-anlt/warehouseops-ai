# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0

"""
SQL Retriever for Warehouse Operations (SQLite backend).

Ported from PostgreSQL/asyncpg to aiosqlite so the assistant runs on a laptop
with zero database infrastructure. The public method surface is unchanged
(execute_query, fetch_all, fetch_one, fetch_scalar, execute_scalar,
execute_command, get_connection, health_check) so all call sites keep working.

Queries throughout the codebase use PostgreSQL-style `$1, $2` placeholders and a
few PG idioms (NOW(), ::casts, ILIKE, TRUE/FALSE). `_translate_query` and
`_convert_params` adapt these to SQLite's `?` placeholders at execution time,
correctly expanding reused placeholders (e.g. `WHERE a=$1 OR b=$1`).
"""

import re
import math
import asyncio
import logging
from datetime import datetime as _datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from contextlib import asynccontextmanager
import os
from pathlib import Path

import aiosqlite
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Default on-disk DB and the schema used to bootstrap it.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DB_PATH = str(_REPO_ROOT / "data" / "warehouse.db")
_SCHEMA_PATH = _REPO_ROOT / "data" / "sqlite" / "schema.sql"


class _StdDev:
    """Sample standard deviation aggregate (SQLite has no built-in STDDEV).
    Matches PostgreSQL STDDEV/STDDEV_SAMP semantics."""

    def __init__(self):
        self._vals = []

    def step(self, value):
        if value is not None:
            try:
                self._vals.append(float(value))
            except (TypeError, ValueError):
                pass

    def finalize(self):
        n = len(self._vals)
        if n < 2:
            return 0.0
        mean = sum(self._vals) / n
        var = sum((x - mean) ** 2 for x in self._vals) / (n - 1)
        return math.sqrt(var)


class _Variance(_StdDev):
    def finalize(self):
        sd = super().finalize()
        return sd * sd


@dataclass
class DatabaseConfig:
    """Database configuration (SQLite)."""

    db_path: str = _DEFAULT_DB_PATH

    @classmethod
    def from_env(cls) -> "DatabaseConfig":
        return cls(db_path=os.getenv("WAREHOUSE_DB_PATH", _DEFAULT_DB_PATH))


_PLACEHOLDER_RE = re.compile(r"\$(\d+)")
_CAST_RE = re.compile(r"::[a-zA-Z_][a-zA-Z0-9_ ]*(\[\])?")

# asyncpg returned datetime objects for TIMESTAMP columns; SQLite returns ISO
# strings. Callers frequently do `row["updated_at"].isoformat()` and pydantic
# models expect datetime, so we coerce timestamp-like string columns back to
# datetime centrally when building result rows.
_TS_KEY_RE = re.compile(
    r"(_at|_date|_time)$|^(ts|timestamp|last_login|last_active|last_activity|"
    r"next_pm_due|next_due|expires_at|start_time|occurred_at|due)$",
    re.IGNORECASE,
)
_TS_VAL_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}")


def _coerce_row(d: Dict[str, Any]) -> Dict[str, Any]:
    """Convert timestamp-like string columns to datetime objects."""
    for k, v in list(d.items()):
        if isinstance(v, str) and _TS_KEY_RE.search(k) and _TS_VAL_RE.match(v):
            try:
                d[k] = _datetime.fromisoformat(v.replace(" ", "T", 1))
            except ValueError:
                pass
    return d


_EXTRACT_MAP = {
    "dow": "%w", "month": "%m", "year": "%Y",
    "day": "%d", "hour": "%H", "minute": "%M", "doy": "%j",
}


def _translate_query(query: str) -> str:
    """Translate common PostgreSQL idioms to SQLite (excluding placeholders)."""
    q = query
    # Postgres type casts:  value::jsonb  ->  value
    q = _CAST_RE.sub("", q)
    # NOW() / now()  ->  SQLite datetime('now')
    q = re.sub(r"\bNOW\s*\(\s*\)", "datetime('now')", q, flags=re.IGNORECASE)

    # Interval arithmetic:  <ts> ± INTERVAL 'N unit'  ->  datetime(<ts>, '±N unit')
    # Handles datetime('now') and CURRENT_TIMESTAMP as the base timestamp.
    def _interval(m):
        base = m.group("base")
        sign = "-" if m.group("op") == "-" else "+"
        n = m.group("n")
        unit = m.group("unit").lower().rstrip("s")  # day/days -> day
        base_expr = "'now'" if base.lower().startswith("datetime") else base
        return f"datetime({base_expr}, '{sign}{n} {unit}s')"

    q = re.sub(
        r"(?P<base>datetime\('now'\)|CURRENT_TIMESTAMP)\s*(?P<op>[+-])\s*INTERVAL\s*'(?P<n>\d+)\s*(?P<unit>\w+)'",
        _interval, q, flags=re.IGNORECASE,
    )

    # EXTRACT(field FROM DATE(expr))  and  EXTRACT(field FROM expr)
    def _extract(m):
        fmt = _EXTRACT_MAP.get(m.group("field").lower())
        expr = m.group("expr").strip()
        if fmt is None:
            return m.group(0)
        return f"CAST(strftime('{fmt}', {expr}) AS INTEGER)"

    # EXTRACT(... FROM DATE(col)) — unwrap the DATE() to its argument
    q = re.sub(
        r"EXTRACT\(\s*(?P<field>\w+)\s+FROM\s+DATE\(\s*(?P<expr>[^)]+)\)\s*\)",
        _extract, q, flags=re.IGNORECASE,
    )
    # EXTRACT(... FROM col)
    q = re.sub(
        r"EXTRACT\(\s*(?P<field>\w+)\s+FROM\s+(?P<expr>[^)]+?)\s*\)",
        _extract, q, flags=re.IGNORECASE,
    )

    # CURRENT_TIMESTAMP is valid in both; leave as-is.
    # Case-insensitive LIKE
    q = re.sub(r"\bILIKE\b", "LIKE", q, flags=re.IGNORECASE)
    # Boolean literals as standalone keywords -> 1/0
    q = re.sub(r"\bTRUE\b", "1", q, flags=re.IGNORECASE)
    q = re.sub(r"\bFALSE\b", "0", q, flags=re.IGNORECASE)
    return q


def _convert_params(query: str, params: Any):
    """Convert `$n` placeholders to `?`, expanding reuse, and reorder params.

    Returns (sqlite_query, ordered_param_list). `params` may be a tuple/list of
    positional values (matching asyncpg $1..$n) or None.
    """
    seq = list(params) if isinstance(params, (list, tuple)) else ([] if params is None else [params])
    ordered: List[Any] = []

    def repl(match: "re.Match") -> str:
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(seq):
            ordered.append(seq[idx])
        else:
            ordered.append(None)
        return "?"

    new_query = _PLACEHOLDER_RE.sub(repl, query)
    # If the query has no $n placeholders, it takes no bindings — ignore any
    # extra params a caller passed (SQLite errors on surplus bindings).
    return new_query, ordered


def _adapt(query: str, params: Any = None):
    """Full adaptation: idiom translation + placeholder conversion."""
    return _convert_params(_translate_query(query), params)


class _ConnProxy:
    """asyncpg-like async facade over an aiosqlite connection for code that
    uses `async with retriever.get_connection() as conn: await conn.fetch(...)`."""

    def __init__(self, conn: "aiosqlite.Connection", lock: asyncio.Lock):
        self._conn = conn
        self._lock = lock

    async def fetch(self, query: str, *params) -> List[Dict[str, Any]]:
        q, p = _adapt(query, params)
        async with self._lock:
            cur = await self._conn.execute(q, p)
            rows = await cur.fetchall()
            await cur.close()
        return [_coerce_row(dict(r)) for r in rows]

    async def fetchrow(self, query: str, *params) -> Optional[Dict[str, Any]]:
        q, p = _adapt(query, params)
        async with self._lock:
            cur = await self._conn.execute(q, p)
            row = await cur.fetchone()
            await cur.close()
        return _coerce_row(dict(row)) if row else None

    async def fetchval(self, query: str, *params) -> Any:
        row = await self.fetchrow(query, *params)
        if not row:
            return None
        return next(iter(row.values()), None)

    async def execute(self, query: str, *params) -> str:
        q, p = _adapt(query, params)
        async with self._lock:
            await self._conn.execute(q, p)
            await self._conn.commit()
        return "OK"

    async def close(self) -> None:
        """No-op: the underlying connection is shared and pooled by the
        retriever, so individual callers must not close it."""
        return None


class SQLRetriever:
    """SQLite-backed retriever for warehouse operational data (singleton)."""

    _instance = None
    _initialized = False

    def __new__(cls, config: Optional[DatabaseConfig] = None):
        if cls._instance is None:
            cls._instance = super(SQLRetriever, cls).__new__(cls)
        return cls._instance

    def __init__(self, config: Optional[DatabaseConfig] = None):
        if not self._initialized:
            self.config = config or DatabaseConfig.from_env()
            self._conn: Optional[aiosqlite.Connection] = None
            self._lock = asyncio.Lock()
            self._initialized = True

    async def initialize(self) -> None:
        """Open the SQLite connection and bootstrap the schema if needed."""
        if self._conn is not None:
            return
        db_path = Path(self.config.db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        fresh = not db_path.exists()
        self._conn = await aiosqlite.connect(self.config.db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA foreign_keys=ON")
        await self._conn.execute("PRAGMA journal_mode=WAL")
        # Register aggregates PostgreSQL has but SQLite lacks. aiosqlite doesn't
        # expose create_aggregate directly, so register on the underlying
        # sqlite3 connection inside aiosqlite's worker thread via _execute.
        try:
            raw = getattr(self._conn, "_connection", None) or getattr(self._conn, "_conn", None)

            def _register():
                for name, cls in (("STDDEV", _StdDev), ("STDDEV_SAMP", _StdDev),
                                  ("STDDEV_POP", _StdDev), ("VARIANCE", _Variance),
                                  ("VAR_SAMP", _Variance)):
                    raw.create_aggregate(name, 1, cls)

            await self._conn._execute(_register)
        except Exception as e:  # pragma: no cover
            logger.debug("Could not register SQL aggregates: %s", e)
        # Bootstrap (idempotent — schema uses IF NOT EXISTS / ON CONFLICT).
        if _SCHEMA_PATH.exists():
            await self._conn.executescript(_SCHEMA_PATH.read_text())
            await self._conn.commit()
            logger.info(
                "SQLite DB %s (%s) initialized from schema.",
                self.config.db_path,
                "created" if fresh else "existing",
            )
        else:
            logger.warning("Schema file not found at %s; DB not bootstrapped.", _SCHEMA_PATH)

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None
            logger.info("SQLite connection closed")

    async def _ensure(self) -> "aiosqlite.Connection":
        if self._conn is None:
            await self.initialize()
        return self._conn

    @asynccontextmanager
    async def get_connection(self):
        """Yield an asyncpg-like proxy over the shared SQLite connection."""
        await self._ensure()
        yield _ConnProxy(self._conn, self._lock)

    async def execute_query(
        self, query: str, params: Optional[Union[tuple, dict]] = None
    ) -> List[Dict[str, Any]]:
        try:
            await self._ensure()
            q, p = _adapt(query, params)
            async with self._lock:
                cur = await self._conn.execute(q, p)
                rows = await cur.fetchall()
                await cur.close()
            return [_coerce_row(dict(r)) for r in rows]
        except Exception as e:
            logger.error(f"Query execution failed: {e}\nQuery: {query}\nParams: {params}")
            raise

    async def fetch_all(self, query: str, *params) -> List[Dict[str, Any]]:
        return await self.execute_query(query, params if params else None)

    async def fetch_one(self, query: str, *params) -> Optional[Dict[str, Any]]:
        try:
            await self._ensure()
            q, p = _adapt(query, params if params else None)
            async with self._lock:
                cur = await self._conn.execute(q, p)
                row = await cur.fetchone()
                await cur.close()
                # `INSERT ... RETURNING` is a write, and callers reasonably use
                # fetch_one for it. Without this the row was never committed and
                # silently vanished on the next connection.
                if self._conn.in_transaction:
                    await self._conn.commit()
            return _coerce_row(dict(row)) if row else None
        except Exception as e:
            logger.error(f"Fetch one failed: {e}")
            raise

    async def fetch_scalar(self, query: str, *params) -> Any:
        row = await self.fetch_one(query, *params)
        if not row:
            return None
        return next(iter(row.values()), None)

    async def execute_scalar(
        self, query: str, params: Optional[Union[tuple, dict]] = None
    ) -> Any:
        try:
            await self._ensure()
            q, p = _adapt(query, params)
            async with self._lock:
                cur = await self._conn.execute(q, p)
                row = await cur.fetchone()
                await cur.close()
            if not row:
                return None
            return row[0]
        except Exception as e:
            logger.error(f"Scalar query execution failed: {e}")
            raise

    async def execute_command(self, command: str, *params) -> str:
        try:
            await self._ensure()
            # Support both execute_command(cmd, a, b) and execute_command(cmd, (a, b)).
            if len(params) == 1 and isinstance(params[0], (tuple, list)):
                params = tuple(params[0])
            q, p = _adapt(command, params if params else None)
            async with self._lock:
                cur = await self._conn.execute(q, p)
                await self._conn.commit()
                rowcount = cur.rowcount
                await cur.close()
            return f"OK {rowcount}"
        except Exception as e:
            logger.error(f"Command execution failed: {e}\nCommand: {command}")
            raise

    async def health_check(self) -> bool:
        try:
            result = await self.execute_scalar("SELECT 1")
            return result == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False


# Global retriever instance with thread safety
_sql_retriever: Optional[SQLRetriever] = None
_retriever_lock = asyncio.Lock()


async def get_sql_retriever() -> SQLRetriever:
    """Get or create the global SQL retriever instance."""
    global _sql_retriever
    async with _retriever_lock:
        if _sql_retriever is None:
            _sql_retriever = SQLRetriever()
            await _sql_retriever.initialize()
        return _sql_retriever


async def close_sql_retriever() -> None:
    """Close the global SQL retriever instance."""
    global _sql_retriever
    if _sql_retriever:
        await _sql_retriever.close()
        _sql_retriever = None
