# Run / Test Guide

Runs on your Mac with **zero infrastructure** — no Postgres, no Milvus, no
Docker. Chat uses Groq (free); embeddings, database, and vector store are all
local.

**Prerequisite: Python 3.10+ (3.11 recommended).** The conda `base` env is
usually 3.9 and won't work. If needed:
`conda create -n warehouse python=3.11 -y && conda activate warehouse`.
`run.sh` auto-detects a suitable Python and rebuilds the venv if it's the wrong
version.

## Fastest path (2 commands)

Everything is pre-wired: `.env` already has your Groq key, and the SQLite
database ships prebuilt and seeded.

```bash
# Terminal 1 — backend (first run installs deps, ~a few minutes)
./run.sh                 # → http://localhost:8000/docs

# Terminal 2 — web console
./run_frontend.sh        # → http://localhost:3000
```

Log in at the UI with **admin / changeme** (or operator / changeme).

## Smoke tests

Health:
```bash
curl localhost:8000/health/simple
```

Chat (inventory Q&A over the seeded data):
```bash
curl -s -X POST localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How many bags of Lays Classic do we have and where are they?"}'
```

Try also: "Which forklifts are in maintenance?", "What is below reorder point?"

## What's already done for you
- `.env` created with your `GROQ_API_KEY` and a generated `JWT_SECRET_KEY`.
- `data/warehouse.db` prebuilt: 16 inventory SKUs, 12 equipment assets,
  `admin` + `operator` users (password `changeme`).
- Backend (:8000) and the frontend proxy are aligned on the same port.

## Manual steps (only if you want them)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/setup/init_local_db.py     # re-seed DB (idempotent)
uvicorn src.api.app:app --reload --port 8000
pytest                                     # run the test suite
```

## Offline mode (no Groq)
In `.env` set `LLM_PROVIDER=ollama`, then `ollama pull qwen2.5:7b-instruct`.
No API key needed.

## What works locally
- Chat → agent routing (MCP) → SQLite retrieval → Groq answer
- Inventory, equipment, safety, forecasting, document agents over the local DB
- Vector search over ChromaDB, NeMo Guardrails, conversation memory, JWT auth

## If something errors
Copy the traceback back to me. The DB and vector layers are unit-tested
(`pytest`), so first-run issues are usually a missing system dep (e.g.
`poppler` for PDF features) or an env value — quick to fix.
