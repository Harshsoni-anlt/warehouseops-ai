# SPDX-License-Identifier: Apache-2.0
"""
Bring-your-own-data endpoints.

Lets anyone load their own warehouse data into the assistant from a CSV file —
the same shape the demo data uses. Provides downloadable templates so a user can
export from their WMS/spreadsheet, fill the columns, and upload.

Supported datasets: inventory, equipment, movements (demand history).
"""

import csv
import io
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse

from src.retrieval.structured import SQLRetriever

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/data", tags=["Data Import"])
sql_retriever = SQLRetriever()

# dataset -> (required columns, optional columns, template rows)
TEMPLATES: Dict[str, Dict[str, Any]] = {
    "inventory": {
        "columns": ["sku", "name", "quantity", "location", "reorder_point"],
        "required": ["sku", "name", "quantity"],
        "sample": [
            ["SKU-001", "Blue Widget 500ml", "1200", "Zone A-Aisle 1", "200"],
            ["SKU-002", "Red Widget 500ml", "850", "Zone A-Aisle 2", "150"],
        ],
        "description": "Your product catalog and current stock levels.",
    },
    "equipment": {
        "columns": ["asset_id", "type", "model", "zone", "status", "owner_user"],
        "required": ["asset_id", "type"],
        "sample": [
            ["FL-01", "forklift", "Toyota 8FGU25", "Zone A", "available", ""],
            ["AMR-01", "amr", "MiR-250", "Zone B", "charging", ""],
        ],
        "description": "Forklifts, robots, chargers and other assets you operate.",
    },
    "movements": {
        "columns": ["sku", "movement_type", "quantity", "timestamp", "location", "notes"],
        "required": ["sku", "movement_type", "quantity", "timestamp"],
        "sample": [
            ["SKU-001", "outbound", "45", "2026-07-01 09:15:00", "Zone A-Aisle 1", "customer order"],
            ["SKU-001", "inbound", "500", "2026-07-02 07:00:00", "Receiving Dock", "supplier delivery"],
        ],
        "description": "Stock movement history — this is what powers demand forecasting. "
                       "Aim for 90+ days of outbound rows for meaningful forecasts.",
    },
}

INSERTS = {
    "inventory": (
        "INSERT INTO inventory_items (sku, name, quantity, location, reorder_point, updated_at) "
        "VALUES ($1,$2,$3,$4,$5,NOW()) "
        "ON CONFLICT(sku) DO UPDATE SET name=excluded.name, quantity=excluded.quantity, "
        "location=excluded.location, reorder_point=excluded.reorder_point, updated_at=NOW()",
        ["sku", "name", "quantity", "location", "reorder_point"],
    ),
    "equipment": (
        "INSERT INTO equipment_assets (asset_id, type, model, zone, status, owner_user, created_at, updated_at) "
        "VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) "
        "ON CONFLICT(asset_id) DO UPDATE SET type=excluded.type, model=excluded.model, "
        "zone=excluded.zone, status=excluded.status, owner_user=excluded.owner_user, updated_at=NOW()",
        ["asset_id", "type", "model", "zone", "status", "owner_user"],
    ),
    "movements": (
        "INSERT INTO inventory_movements (sku, movement_type, quantity, timestamp, location, notes) "
        "VALUES ($1,$2,$3,$4,$5,$6)",
        ["sku", "movement_type", "quantity", "timestamp", "location", "notes"],
    ),
}

_INT_FIELDS = {"quantity", "reorder_point"}


@router.get("/templates")
async def list_templates():
    """List the datasets you can import, with their columns."""
    return {
        "datasets": [
            {
                "name": key,
                "description": spec["description"],
                "columns": spec["columns"],
                "required": spec["required"],
                "template_url": f"/api/v1/data/template/{key}",
            }
            for key, spec in TEMPLATES.items()
        ]
    }


@router.get("/template/{dataset}", response_class=PlainTextResponse)
async def download_template(dataset: str):
    """Download a ready-to-fill CSV template for a dataset."""
    spec = TEMPLATES.get(dataset)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Unknown dataset '{dataset}'")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(spec["columns"])
    w.writerows(spec["sample"])
    return PlainTextResponse(
        buf.getvalue(),
        headers={"Content-Disposition": f'attachment; filename="{dataset}_template.csv"'},
    )


@router.post("/import/{dataset}")
async def import_csv(dataset: str, file: UploadFile = File(...), replace: bool = False):
    """
    Import a CSV into the assistant.

    - `dataset`: inventory | equipment | movements
    - `replace`: if true, clears existing rows in that table first
    """
    spec = TEMPLATES.get(dataset)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Unknown dataset '{dataset}'")

    try:
        raw = (await file.read()).decode("utf-8-sig", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    reader = csv.DictReader(io.StringIO(raw))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    missing = [c for c in spec["required"] if c not in headers]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required column(s): {', '.join(missing)}. Expected: {', '.join(spec['columns'])}",
        )

    query, fields = INSERTS[dataset]
    await sql_retriever.initialize()

    if replace:
        table = {"inventory": "inventory_items", "equipment": "equipment_assets",
                 "movements": "inventory_movements"}[dataset]
        await sql_retriever.execute_command(f"DELETE FROM {table}")

    imported, errors = 0, []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        try:
            values = []
            for f in fields:
                v = (row.get(f) or "").strip()
                if f in _INT_FIELDS:
                    values.append(int(float(v)) if v else 0)
                else:
                    values.append(v or None)
            if not values[0]:
                continue  # skip blank lines
            await sql_retriever.execute_command(query, *values)
            imported += 1
        except Exception as e:
            if len(errors) < 10:
                errors.append(f"row {i}: {e}")

    logger.info("Imported %d rows into %s (%d errors)", imported, dataset, len(errors))
    return {
        "success": True,
        "dataset": dataset,
        "imported": imported,
        "errors": errors,
        "message": f"Imported {imported} rows into {dataset}"
                   + (f" ({len(errors)} rows skipped)" if errors else ""),
    }
