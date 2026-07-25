#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Populate the local SQLite database with realistic demo data so every page in the
UI has content: inventory movements (180 days, for forecasting), tasks, safety
incidents, equipment telemetry / assignments / maintenance, and a model registry
(training history + predictions).

Idempotent: clears the demo tables and reseeds. Run after init_local_db.py, or
standalone (it applies the schema first).

    python scripts/setup/seed_demo_data.py
"""

import os
import json
import math
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

REPO = Path(__file__).resolve().parents[2]
DB = os.getenv("WAREHOUSE_DB_PATH", str(REPO / "data" / "warehouse.db"))
SCHEMA = REPO / "data" / "sqlite" / "schema.sql"


def _dt(days_ago=0, hours_ago=0):
    # Use UTC to stay consistent with SQLite's NOW()/datetime('now') used by
    # live inserts, so newly-added rows always sort correctly by timestamp.
    return (datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)).strftime("%Y-%m-%d %H:%M:%S")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys=ON")
    if SCHEMA.exists():
        con.executescript(SCHEMA.read_text())  # idempotent
    cur = con.cursor()

    skus = [r[0] for r in cur.execute("SELECT sku FROM inventory_items ORDER BY sku").fetchall()]
    assets = cur.execute("SELECT asset_id, type, zone FROM equipment_assets").fetchall()

    # Clear demo tables for a clean reseed.
    for t in ["inventory_movements", "tasks", "safety_incidents", "equipment_telemetry",
              "equipment_assignments", "equipment_maintenance", "model_training_history",
              "model_predictions", "audit_log"]:
        cur.execute(f"DELETE FROM {t}")

    # ---- inventory_movements: 180 days of daily outbound + weekly inbound ----
    movements = []
    for sku in skus:
        base = random.randint(20, 90)  # base daily demand
        for d in range(180, -1, -1):
            day = datetime.now() - timedelta(days=d)
            dow, month = day.weekday(), day.month
            seasonal = 1.25 if month in (6, 7, 8, 11, 12) else 1.0     # busy summer/holidays
            weekend = 0.55 if dow >= 5 else 1.0
            qty = max(1, int(base * seasonal * weekend * random.uniform(0.7, 1.3)))
            movements.append((sku, "outbound", qty, _dt(days_ago=d), None, "customer order"))
            if day.weekday() == 0:  # weekly Monday restock
                movements.append((sku, "inbound", int(base * 7 * random.uniform(0.9, 1.2)),
                                  _dt(days_ago=d), "Receiving Dock", "supplier delivery"))
    cur.executemany(
        "INSERT INTO inventory_movements (sku, movement_type, quantity, timestamp, location, notes) VALUES (?,?,?,?,?,?)",
        movements,
    )

    # ---- tasks ----
    kinds = ["pick", "pack", "putaway", "cycle_count", "replenish"]
    statuses = ["pending", "in_progress", "completed", "completed", "completed"]
    assignees = ["operator1", "operator2", "operator3", "system", None]
    tasks = []
    for i in range(40):
        kind = random.choice(kinds)
        status = random.choice(statuses)
        payload = json.dumps({"sku": random.choice(skus), "qty": random.randint(5, 120),
                              "zone": random.choice(["Zone A", "Zone B", "Zone C"])})
        created = _dt(days_ago=random.randint(0, 6), hours_ago=random.randint(0, 23))
        tasks.append((kind, status, random.choice(assignees), payload, created, created))
    cur.executemany(
        "INSERT INTO tasks (kind, status, assignee, payload, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        tasks,
    )

    # ---- safety_incidents ----
    sev = ["low", "low", "medium", "medium", "high", "critical"]
    descs = [
        "Spill in aisle B2 cleaned and cordoned off",
        "Forklift near-miss reported at Loading Dock",
        "Missing PPE observed on operator, corrected on shift",
        "Blocked emergency exit in Zone C, cleared",
        "Pallet stacked above safe height, restacked",
        "Battery overheating on AMR-002, unit taken offline",
        "Slippery floor near charging station, signage added",
    ]
    reporters = ["operator1", "operator2", "supervisor1", "safety_officer"]
    incidents = [(random.choice(sev), random.choice(descs), random.choice(reporters),
                  _dt(days_ago=random.randint(0, 20))) for _ in range(14)]
    cur.executemany(
        "INSERT INTO safety_incidents (severity, description, reported_by, occurred_at) VALUES (?,?,?,?)",
        incidents,
    )

    # ---- equipment_telemetry: last 24h, several metrics per powered asset ----
    telem = []
    for asset_id, atype, zone in assets:
        if atype in ("charger", "conveyor"):
            metrics = {"temp_c": (22, 30), "power": (400, 800)}
        else:
            metrics = {"battery_soc": (35, 98), "temp_c": (20, 40),
                       "speed": (0, 2), "location_x": (0, 200), "location_y": (0, 120)}
        for h in range(24, -1, -2):
            for metric, (lo, hi) in metrics.items():
                telem.append((_dt(hours_ago=h), asset_id, metric, round(random.uniform(lo, hi), 2)))
    cur.executemany(
        "INSERT INTO equipment_telemetry (ts, equipment_id, metric, value) VALUES (?,?,?,?)",
        telem,
    )

    # ---- equipment_assignments ----
    assigns = []
    for asset_id, atype, zone in assets[:6]:
        assigns.append((asset_id, f"TASK-{random.randint(100, 999)}",
                        random.choice(["operator1", "operator2", "system"]),
                        "task", _dt(hours_ago=random.randint(1, 8)), None,
                        f"Active in {zone}"))
    cur.executemany(
        "INSERT INTO equipment_assignments (asset_id, task_id, assignee, assignment_type, assigned_at, released_at, notes) VALUES (?,?,?,?,?,?,?)",
        assigns,
    )

    # ---- equipment_maintenance ----
    mtypes = ["preventive", "corrective", "inspection"]
    maint = []
    for asset_id, atype, zone in assets:
        if random.random() < 0.6:
            maint.append((asset_id, random.choice(mtypes),
                          "Scheduled service and calibration",
                          random.choice(["tech1", "tech2"]),
                          _dt(days_ago=random.randint(1, 40)),
                          random.randint(30, 180), "[]",
                          round(random.uniform(75, 600), 2), "",
                          _dt(days_ago=-random.randint(10, 90))))
    cur.executemany(
        "INSERT INTO equipment_maintenance (asset_id, maintenance_type, description, performed_by, performed_at, duration_minutes, parts_used, cost, notes, next_due) VALUES (?,?,?,?,?,?,?,?,?,?)",
        maint,
    )

    # ---- model registry: training history + predictions ----
    models = ["Random Forest", "XGBoost", "Gradient Boosting", "Prophet",
              "Linear Regression", "Ridge Regression"]
    mth = []
    for m in models:
        for d in (25, 18, 11, 4):
            acc = round(random.uniform(0.82, 0.96), 3)
            mth.append((m, None, _dt(days_ago=d), acc,
                        round(random.uniform(6, 18), 2), round(random.uniform(40, 120), 2),
                        random.randint(2000, 8000), "{}"))
    cur.executemany(
        "INSERT INTO model_training_history (model_name, sku, training_date, accuracy_score, mape_score, rmse_score, training_samples, metadata) VALUES (?,?,?,?,?,?,?,?)",
        mth,
    )
    preds = []
    for m in models:
        for sku in random.sample(skus, 6):
            pv = random.uniform(50, 800)
            av = pv * random.uniform(0.88, 1.12)
            preds.append((m, sku, _dt(days_ago=random.randint(0, 6)),
                          random.choice([7, 14, 30]), round(pv, 2), round(av, 2), "{}"))
    cur.executemany(
        "INSERT INTO model_predictions (model_name, sku, prediction_date, horizon_days, predicted_value, actual_value, metadata) VALUES (?,?,?,?,?,?,?)",
        preds,
    )

    # ---- audit_log ----
    admin_id = cur.execute("SELECT id FROM users WHERE username='admin'").fetchone()
    admin_id = admin_id[0] if admin_id else None
    audit = [(admin_id, random.choice(["login", "view_inventory", "update_task", "run_forecast", "view_safety"]),
              "system", None, "{}", "127.0.0.1", "seed", _dt(days_ago=random.randint(0, 5)))
             for _ in range(20)]
    cur.executemany(
        "INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?)",
        audit,
    )

    con.commit()

    counts = {t: cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in [
        "inventory_movements", "tasks", "safety_incidents", "equipment_telemetry",
        "equipment_assignments", "equipment_maintenance", "model_training_history",
        "model_predictions", "audit_log"]}
    con.close()
    print("Demo data seeded:")
    for t, c in counts.items():
        print(f"  {t:24} {c}")


if __name__ == "__main__":
    main()
