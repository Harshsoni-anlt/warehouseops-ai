#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Initialize the local SQLite database for the Warehouse Operations Assistant.

- Creates data/warehouse.db and applies data/sqlite/schema.sql (idempotent),
  which seeds inventory (16 SKUs) and equipment (12 assets).
- Creates default users (admin, operator) with bcrypt-hashed passwords so the
  web UI login works. Passwords come from env vars (defaults for local dev).

Usage:
    python scripts/setup/init_local_db.py

Env:
    WAREHOUSE_DB_PATH        (default: data/warehouse.db)
    DEFAULT_ADMIN_PASSWORD   (default: changeme)
    DEFAULT_USER_PASSWORD    (default: changeme)
"""

import asyncio
import os
import sys
from pathlib import Path

# Make the repo root importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import bcrypt  # noqa: E402
from src.retrieval.structured.sql_retriever import get_sql_retriever  # noqa: E402


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


DEFAULT_USERS = [
    {
        "username": "admin",
        "email": "admin@warehouseops.ai",
        "full_name": "Local Admin",
        "role": "admin",
        "password_env": "DEFAULT_ADMIN_PASSWORD",
    },
    {
        "username": "operator",
        "email": "operator@warehouseops.ai",
        "full_name": "Local Operator",
        "role": "operator",
        "password_env": "DEFAULT_USER_PASSWORD",
    },
]


async def main() -> None:
    retriever = await get_sql_retriever()  # opens DB + applies schema (seeds included)

    inv = await retriever.execute_scalar("SELECT COUNT(*) FROM inventory_items")
    eqp = await retriever.execute_scalar("SELECT COUNT(*) FROM equipment_assets")
    print(f"Schema ready. inventory_items={inv}, equipment_assets={eqp}")

    created = 0
    for u in DEFAULT_USERS:
        existing = await retriever.fetch_one(
            "SELECT id FROM users WHERE username = $1", u["username"]
        )
        if existing:
            continue
        password = os.getenv(u["password_env"], "changeme")
        await retriever.execute_command(
            """INSERT INTO users (username, email, full_name, role, status, hashed_password)
               VALUES ($1, $2, $3, $4, 'active', $5)""",
            (u["username"], u["email"], u["full_name"], u["role"], _hash(password)),
        )
        created += 1
        print(f"  created user: {u['username']} ({u['role']})")

    total = await retriever.execute_scalar("SELECT COUNT(*) FROM users")
    print(f"Users: {total} total ({created} created this run).")
    await retriever.close()

    # Seed demo data (inventory movements, tasks, safety, telemetry, forecasts)
    # so every page in the UI has content. Idempotent.
    movements = 0
    try:
        import importlib.util
        seed_path = Path(__file__).resolve().parent / "seed_demo_data.py"
        spec = importlib.util.spec_from_file_location("seed_demo_data", seed_path)
        seed = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(seed)
        seed.main()
    except Exception as e:  # pragma: no cover
        print(f"(demo data seeding skipped: {e})")

    print("Local database initialized successfully.")


if __name__ == "__main__":
    asyncio.run(main())
