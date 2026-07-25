#!/usr/bin/env bash
# WarehouseOps AI — one-command frontend launcher.
#   ./run_frontend.sh
# Installs npm deps (first run only) and starts the React console on :3000.
# Start the backend first (./run.sh) so the UI has an API to talk to.
set -euo pipefail
cd "$(dirname "$0")/src/ui/web"

if [ ! -d "node_modules" ]; then
  echo "==> Installing frontend dependencies (first run)…"
  npm install
fi

echo ""
echo "==> WarehouseOps AI console →  http://localhost:3000"
echo ""
exec npm start
