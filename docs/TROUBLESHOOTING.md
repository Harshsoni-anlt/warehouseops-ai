# Troubleshooting

Everything here is a problem someone actually hit while running this.

---

## Setup

### `No Python 3.10+ found`

The stack needs 3.10 or newer (LangGraph requires it). A conda `base`
environment is usually 3.9, which is the most common cause.

```bash
conda create -n warehouse python=3.11 -y && conda activate warehouse
# or
brew install python@3.11
```

Then re-run `./run.sh`, or point it at a specific interpreter:

```bash
PYTHON=python3.11 ./run.sh
```

`run.sh` detects a wrong-version virtualenv and rebuilds it automatically.

### First run takes several minutes

Expected. `pip install` pulls PyTorch (for `sentence-transformers`) and
ChromaDB. It's cached afterwards — later starts take seconds. To force a
reinstall, delete `.venv/.deps-installed`.

### `npm start` fails or the console won't load

```bash
node --version    # needs 18+
cd src/ui/web && rm -rf node_modules package-lock.json && npm install
```

---

## Running

### The assistant returns an error, everything else works

You don't have a Groq key set. Get one free (no card) at
[console.groq.com/keys](https://console.groq.com/keys) and add it to `.env`:

```bash
GROQ_API_KEY=gsk_...
```

Then restart the backend. Inventory, equipment, tasks, safety, forecasting and
the dashboards all work without it — only the assistant and the LLM half of
document extraction need a key.

To run with no external calls at all:

```bash
# .env
LLM_PROVIDER=ollama
```

```bash
ollama pull qwen2.5:7b-instruct
```

### `504` or `ECONNREFUSED` from the console

The frontend proxies `/api/*` to `http://localhost:8000`. Check the backend is
actually up:

```bash
curl localhost:8000/api/v1/health
```

If you changed the backend port, update the target in `src/ui/web/craco.config.js`
— note that this project proxies through **CRACO**, not the `proxy` field in
`package.json`, so editing `package.json` has no effect.

### The first chat is slow, later ones are fast

The local embedding model loads into memory on first use. `run.sh`
pre-downloads it, but the load still happens inside the first request. Known
limitation — see the roadmap.

### `database is locked`

SQLite allows one writer. If you have two backends running against the same
`data/warehouse.db`, stop one.

**Never delete `warehouse.db-wal` or `-shm` while the server is running.** The
process keeps the deleted inode and its writes become invisible to new readers,
which looks exactly like data silently vanishing.

### A document uploads but extracts nothing

If the card says the file looks scanned or image-only, that's accurate: there's
no OCR in this stack, so only PDFs with embedded text can be read. Test with a
text-based PDF (an invoice exported from software rather than photographed).

### Changes to Python files don't take effect

Restart the backend. `--reload` is not reliable for this project — module-level
singletons (the planner graph, the tool registry, the SQLite retriever) are
built at import time and survive a partial reload.

---

## Resetting

Back to a clean, seeded database:

```bash
rm data/warehouse.db data/warehouse.db-wal data/warehouse.db-shm   # backend stopped!
python scripts/setup/init_local_db.py
```

Clear uploaded documents and their records:

```bash
rm -rf data/uploads/* document_statuses.json
```

---

## Still stuck?

Open an issue with your OS, Python version, the command you ran and the error.
Backend logs print to the terminal running `./run.sh`; frontend errors are in
the browser console.
