# WarehouseOps AI

**A multi-agent warehouse operations assistant that runs entirely on free, open-source infrastructure — no GPU, no managed databases, no paid APIs.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.120+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

Ask it operational questions in plain language — *"Which forklifts are in maintenance?"*, *"What's below reorder point in Zone B?"*, *"Forecast demand for DOR001"* — and a team of specialized agents route the request, query the warehouse's data, and answer with grounded results.

---

## Why this exists

Enterprise "agentic operations" demos usually assume a GPU cluster, a managed vector database, and a paid inference endpoint. This project shows the same architecture rebuilt so it runs on a laptop for ₹0:

| Concern | Typical enterprise stack | Here |
|---|---|---|
| Chat LLM | Paid, hosted inference | **Groq** free tier, or **local Ollama** |
| Embeddings | Hosted embedding API | **sentence-transformers** (local, CPU) |
| Vector store | Managed vector DB server | **ChromaDB** (local, persistent) |
| Relational data | PostgreSQL / TimescaleDB | **SQLite** (single file, auto-seeded) |
| Orchestration | Same | **LangGraph** multi-agent planner + **MCP** tool routing |
| Guardrails | Same | **NeMo Guardrails** (open source) |

Every backend was swapped behind a stable interface, so the multi-agent design, tool routing, guardrails, and web UI are unchanged — only the infrastructure got cheaper.

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

- **Agents** — inventory, equipment, safety, forecasting, and document-extraction, each with its own tools and prompt.
- **Planner** — a LangGraph state machine decides which agent(s) handle a request and composes the answer.
- **Retrieval** — a hybrid layer combines exact SQL lookups (SQLite) with semantic search (ChromaDB) over indexed documents.
- **Guardrails & memory** — programmable input/output rails and conversation memory wrap the whole flow.

## Quick start

**Requires Python 3.10+ (3.11 recommended)** and a free
[Groq API key](https://console.groq.com) in `.env` (copy from `.env.example`
and fill in `GROQ_API_KEY`). Then, from the project root:

```bash
./run.sh            # backend  → http://localhost:8000/docs
```

The first run creates a virtualenv and installs dependencies (a few minutes);
after that it starts in seconds. The local database ships prebuilt and seeded
(16 inventory SKUs, 12 equipment assets, `admin` / `operator` login users).

In a second terminal, start the web console:

```bash
./run_frontend.sh   # UI → http://localhost:3000
```

Or ask a question straight from the API:

```bash
curl -s -X POST localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How many bags of Lay'\''s Classic do we have and where are they?"}'
```

Prefer fully offline? Set `LLM_PROVIDER=ollama` in `.env` and
`ollama pull qwen2.5:7b-instruct` — no API key required.

Full details and troubleshooting: **[LOCAL_TEST.md](LOCAL_TEST.md)**.

## Features

- **Natural-language operations** — inventory levels, stock locations, reorder alerts, equipment status, safety incidents, demand forecasts.
- **Multi-agent routing** over the Model Context Protocol, so each capability is an independent, testable tool surface.
- **Hybrid retrieval** — structured queries for facts, vector search for documents, merged and ranked.
- **Guardrails** — prompt-injection protection and output validation on by default.
- **Auth** — JWT login with role-based users (seeded `admin` / `operator`).
- **Runs anywhere** — SQLite + ChromaDB persist to `data/`; the only external call is to your chosen chat LLM.

## Tech stack

`Python 3.11` · `FastAPI` · `LangGraph` · `Model Context Protocol` · `NeMo Guardrails` · `Groq` / `Ollama` · `sentence-transformers` · `ChromaDB` · `SQLite` · `React 19` · `TypeScript` · `Material UI`

## Testing

```bash
pytest
```

The suite covers the SQLite retrieval layer (including the PostgreSQL-idiom
translation shim) and the ChromaDB vector retriever.

## Project layout

```
src/api/            FastAPI app, routers, agents, services (LLM, guardrails, memory, MCP)
src/retrieval/      structured (SQLite) + vector (ChromaDB) retrieval
src/ui/web/         React + TypeScript console
data/sqlite/        schema (auto-applied on first run)
scripts/setup/      init_local_db.py and helpers
tests/              retrieval unit tests
LOCAL_TEST.md       zero-infra run guide
```

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE). This project is
an adaptation of an open-source reference architecture; attribution to the
original authors is recorded in [NOTICE](NOTICE), and third-party licenses in
[LICENSE-3rd-party.txt](LICENSE-3rd-party.txt).
