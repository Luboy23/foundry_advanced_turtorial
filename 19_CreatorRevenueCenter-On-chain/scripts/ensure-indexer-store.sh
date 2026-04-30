#!/usr/bin/env bash
set -euo pipefail

INDEXER_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../services/indexer" && pwd)}"
PONDER_DIR="$INDEXER_DIR/.ponder"
PGLITE_DIR="$PONDER_DIR/pglite"
PID_FILE="$PGLITE_DIR/postmaster.pid"

if [[ "${FORCE_RESET_INDEXER_STORE:-0}" == "1" ]]; then
  if [[ -d "$PGLITE_DIR" ]]; then
    echo "检测到 FORCE_RESET_INDEXER_STORE=1，重建 indexer 本地存储：$PGLITE_DIR"
    rm -rf "$PGLITE_DIR"
  fi
  exit 0
fi

if [[ ! -d "$PGLITE_DIR" || ! -f "$PID_FILE" ]]; then
  exit 0
fi

raw_pid="$(head -n 1 "$PID_FILE" | tr -d '[:space:]')"
stale_store=0

if [[ ! "$raw_pid" =~ ^[0-9]+$ ]] || [[ "$raw_pid" -le 1 ]]; then
  stale_store=1
elif ! ps -p "$raw_pid" >/dev/null 2>&1; then
  stale_store=1
fi

if [[ "$stale_store" -eq 1 ]]; then
  echo "检测到 indexer PGlite 存储异常（postmaster.pid=${raw_pid}），正在重建：$PGLITE_DIR"
  rm -rf "$PGLITE_DIR"
fi
