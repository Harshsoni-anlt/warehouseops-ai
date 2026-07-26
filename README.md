# WarehouseOps AI

**A multi-agent warehouse operations assistant that runs entirely on free, open-source infrastructure — no GPU, no managed databases, no paid APIs.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.120+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

Ask it operational questions in plain language — *"Which items are below reorder point?"*, *"Where are the Acme Steel Bolts stored?"*, *"Which forklifts are in maintenance?"* — and a planner routes the request to specialist agents that query the live database and answer with grounded results.

Then **upload your own CSV** and it answers about your warehouse instead of the sample one.

![WarehouseOps AI walkthrough](docs/demo.gif)

> **Runs on your machine, not a hosted demo.** Two commands and a free API key.
> Jump to [Quick start](#quick-start).

---

## What it actually does

| | |
|---|---|
| **Ask in plain language** | A LangGraph planner classifies the question and routes it to the inventory, equipment, operations, safety, forecasting or document agent. The chat shows which agent answered and which terms triggered the routing. |
| **Answers are grounded** | Stock answers come from SQL rows, not from the model. If an item isn't there, it says so instead of inventing a quantity. |
| **Bring your own data** | Upload a CSV of inventory, stock movements or equipment. Every page and the assistant switch to your operation. |
| **Read documents** | Drop in an invoice or a filing — text extraction plus an LLM pulls vendor, dates, totals and line items into a table. |
| **Forecast demand** | Train scikit-learn models on movement history, compare MAPE across model types, get reorder recommendations. |
| **Tools over MCP** | 18 agent actions exposed as discoverable Model Context Protocol tools, with a dashboard to search and execute them. |

## Why this exists

Enterprise "agentic operations" demos usually assume a GPU cluster, a managed vector database and a paid inference endpoint. This project rebuilds the same architecture so it runs on a laptop for ₹0:

| Concern | Typical enterprise stack | Here |
|---|---|---|
| Chat LLM | Paid, hosted inference | **Groq** free tier, or **local Ollama** |
| Embeddings | Hosted embedding API | **sentence-transformers** (local, CPU) |
| Vector store | Managed vector DB server | **ChromaDB** (local, persistent) |
| Relational data | PostgreSQL / TimescaleDB | **SQLite** (single file, auto-seeded) |
| Forecasting | GPU training cluster | **scikit-learn** on CPU |
| Orchestration | Same | **LangGraph** planner + **MCP** tool routing |
| Guardrails | Same | **NeMo Guardrails** (open source) |

Every backend was swapped behind a stable interface, so the multi-agent design, tool routing, guardrails and web console are unchanged — only the infrastructure got cheaper.

## Architecture

```
        React console  ──HTTP──▶  FastAPI
                                     │
                             LangGraph planner
                                     │
                     ┌───────────────┼───────────────┐
             MCP tool routing + NeMo Guardrails + memory
                                     │
   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 Inventory  Equipment   Safety   Forecasting  Document   … agents
   │            │          │          │           │
   └──── SQLite (structured) ──── + ──── ChromaDB (semantic) ────┘
                                     │
                        Groq / Ollama  ·  local embeddings
```

- **Planner** — a LangGraph state machine picks the agent and composes the answer. Routing is rule-based and scored (`src/api/graphs/intent_rules.py`), with the matched terms surfaced in the UI so you can see *why* a question went where it did.
- **Agents** — inventory, equipment, operations, safety, forecasting and document extraction, each with its own tools and data.
- **Retrieval** — exact SQL lookups (SQLite) plus semantic search (ChromaDB) over indexed documents.
- **Guardrails & memory** — programmable input/output rails and conversation memory wrap the whole flow.

---

## Quick start

**You need:** Python 3.10+ (3.11 recommended) and Node 18+.
**Optional:** a free [Groq API key](https://console.groq.com/keys) — no credit card. Without it, everything works except the assistant and document extraction.

```bash
git clone https://github.com/Harshsoni-anlt/warehouseops-ai.git
cd warehouseops-ai

./run.sh            # backend  → http://localhost:8000/docs
```

`run.sh` creates a virtualenv, installs dependencies, writes a `.env` with a
random JWT secret, and **creates and seeds the SQLite database** — 20 inventory
SKUs, 12 equipment assets, 180 days of stock movements, tasks, incidents and
telemetry, so nothing is empty. First run takes a few minutes (it downloads
PyTorch); after that it starts in seconds.

To enable the assistant, add your key to `.env`:

```bash
GROQ_API_KEY=gsk_your_key_here
```

In a second terminal:

```bash
./run_frontend.sh   # console → http://localhost:3000
```

Or ask a question straight from the API:

```bash
curl -s -X POST localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Which items are below reorder point?"}'
```

**Fully offline?** Set `LLM_PROVIDER=ollama` in `.env` and
`ollama pull qwen2.5:7b-instruct` — no API key, no network.

Stuck? See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Use your own warehouse data

The demo ships with realistic sample data, but it isn't locked to it. Use the
**Import Data** screen in the console, or the API:

```bash
# See the datasets and the exact columns expected
curl localhost:8000/api/v1/data/templates

# Download a ready-to-fill CSV template
curl -O localhost:8000/api/v1/data/template/inventory

# Upload it (add ?replace=true to clear the sample data first)
curl -F "file=@my_inventory.csv" localhost:8000/api/v1/data/import/inventory
```

| Dataset | Required columns | What it unlocks |
|---|---|---|
| `inventory` | `sku`, `name`, `quantity` (+ `location`, `reorder_point`) | Stock questions, reorder alerts |
| `movements` | `sku`, `movement_type`, `quantity`, `timestamp` | **Demand forecasting** — aim for 90+ days of `outbound` rows |
| `equipment` | `asset_id`, `type` (+ `model`, `zone`, `status`, `owner_user`) | Asset status, telemetry, maintenance |

Extra columns are ignored, so a full WMS export works as-is. Re-importing the
same SKU updates it rather than duplicating.

---

## Testing

```bash
pytest
```

Covers the SQLite retrieval layer (including the PostgreSQL-idiom translation
shim), the ChromaDB vector retriever, agent routing, and the inventory agent
against a real database file.

The routing tests exist because of a real bug worth knowing about: the original
classifier matched keywords as *substrings*, so `"Acme Steel Bolts"` matched
`bol` (bill of lading) and `"reorder point"` matched `po` (purchase order).
Inventory questions were being answered by the document agent. The suite pins
those exact traps.

## Project layout

```
src/api/            FastAPI app, routers, agents, services (LLM, guardrails, memory, MCP)
src/api/graphs/     LangGraph planner + intent routing rules
src/retrieval/      structured (SQLite) + vector (ChromaDB) retrieval
src/ui/web/         React + TypeScript console
data/sqlite/        schema, applied on first run
scripts/setup/      init_local_db.py and helpers
tests/              routing, retrieval and agent tests
docs/               troubleshooting, roadmap
```

## Known limitations

Stated plainly, because a demo that hides these isn't worth much:

- **Scanned/image-only PDFs won't extract.** There's no OCR in the free stack. The app detects this and says so rather than reporting a false success.
- **SQLite is single-writer.** Fine for a laptop, wrong for concurrent production load.
- **The forecast is a trend/seasonality baseline**, not a supply-chain-grade model. MAPE is reported honestly; it isn't tuned to look good.
- **Guardrails are configured but lightly tested.**
- **The first chat after startup is slow** — the local embedding model loads on first use.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's being built next and why.
Issues and PRs welcome — if you run this against your own warehouse data, I'd
genuinely like to hear what broke.

⭐ **If this is useful, star the repo.** It's the clearest signal that the work
is worth continuing.

## License

Apache License 2.0 — see [LICENSE](LICENSE). This project is an adaptation of an
open-source reference architecture; attribution to the original authors is
recorded in [NOTICE](NOTICE), and third-party licenses in
[LICENSE-3rd-party.txt](LICENSE-3rd-party.txt).
