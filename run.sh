#!/usr/bin/env bash
# WarehouseOps AI — one-command backend launcher.
#   ./run.sh
# Creates a virtualenv, installs deps (first run only), ensures the local DB,
# and starts the API on http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")"

VENV=".venv"
PORT="${PORT:-8000}"

# Pick a Python 3.10+ interpreter (this stack needs >=3.10; targets 3.11).
pick_python() {
  # Honor an explicit override first.
  if [ -n "${PYTHON:-}" ] && "$PYTHON" -c 'import sys; exit(0 if sys.version_info>=(3,10) else 1)' 2>/dev/null; then
    echo "$PYTHON"; return 0
  fi
  for c in python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; exit(0 if sys.version_info>=(3,10) else 1)' 2>/dev/null; then
      echo "$c"; return 0
    fi
  done
  return 1
}

if ! PYBIN="$(pick_python)"; then
  echo "!! No Python 3.10+ found (this project needs 3.10+, targets 3.11)."
  echo "   Your default 'python3' looks like 3.9 (the conda 'base' env)."
  echo "   Fix with either:"
  echo "     • conda:  conda create -n warehouse python=3.11 -y && conda activate warehouse"
  echo "     • brew:   brew install python@3.11   then re-run ./run.sh"
  echo "   Then run:  ./run.sh    (or PYTHON=python3.11 ./run.sh)"
  exit 1
fi
echo "==> Using $("$PYBIN" -V) at $(command -v "$PYBIN")"

# 1. Virtualenv — recreate if it exists but is the wrong Python version.
if [ -d "$VENV" ] && ! "$VENV/bin/python" -c 'import sys; exit(0 if sys.version_info>=(3,10) else 1)' 2>/dev/null; then
  echo "==> Existing $VENV uses an unsupported Python; recreating…"
  rm -rf "$VENV"
fi
if [ ! -d "$VENV" ]; then
  echo "==> Creating virtualenv ($VENV)…"
  "$PYBIN" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

# 2. Dependencies (install once; delete .venv/.deps-installed to force reinstall)
if [ ! -f "$VENV/.deps-installed" ]; then
  echo "==> Installing dependencies (first run — this can take a few minutes)…"
  pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
  touch "$VENV/.deps-installed"
fi

# 2b. Pre-download the local embedding model once (so the first chat is instant,
#     not a 60s model download). Runs even if deps were already installed.
if [ ! -f "$VENV/.embed-warmed" ]; then
  echo "==> Pre-downloading the local embedding model (one-time, ~80MB)…"
  python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')" \
    && touch "$VENV/.embed-warmed" || echo "   (skip — will download on first chat instead)"
fi

# 3. Config — create .env on first run rather than failing.
if [ ! -f ".env" ]; then
  echo "==> No .env found; creating one from .env.example…"
  cp .env.example .env
  # A random JWT secret per install, so nobody ships the placeholder.
  SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
  python - "$SECRET" <<'PY'
import pathlib, sys
p = pathlib.Path(".env")
p.write_text(
    p.read_text().replace(
        "JWT_SECRET_KEY=your-strong-random-secret-minimum-32-characters-change-this",
        f"JWT_SECRET_KEY={sys.argv[1]}",
    )
)
PY
  echo "    Created .env with a random JWT secret."
fi

if ! grep -qE '^GROQ_API_KEY=gsk_' .env; then
  echo ""
  echo "    Note: GROQ_API_KEY is not set in .env."
  echo "    Everything except the assistant and document extraction still works."
  echo "    Get a free key (no card) at https://console.groq.com/keys and add it:"
  echo "      GROQ_API_KEY=gsk_..."
  echo ""
fi

# 4. Database — created and seeded on first run.
if [ ! -f "data/warehouse.db" ]; then
  echo "==> Creating and seeding the local database…"
  python scripts/setup/init_local_db.py
fi

# 5. Launch
echo ""
echo "==> WarehouseOps AI API →  http://localhost:${PORT}/docs"
echo "    (Ctrl+C to stop)"
echo ""
exec uvicorn src.api.app:app --host 0.0.0.0 --port "${PORT}" --reload
