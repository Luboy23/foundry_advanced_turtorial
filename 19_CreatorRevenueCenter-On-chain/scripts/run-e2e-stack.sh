#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANVIL_PORT="${ANVIL_PORT:-8645}"
WEB_PORT="${WEB_PORT:-3119}"
INDEXER_PORT="${INDEXER_PORT:-42169}"

cleanup() {
  cd "$ROOT_DIR"
  make stop ANVIL_PORT="$ANVIL_PORT" WEB_PORT="$WEB_PORT" INDEXER_PORT="$INDEXER_PORT" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
make dev ANVIL_PORT="$ANVIL_PORT" WEB_PORT="$WEB_PORT" INDEXER_PORT="$INDEXER_PORT"
