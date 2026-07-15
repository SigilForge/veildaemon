#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/_site}"

rm -rf "$OUT"
mkdir -p "$OUT"

rsync -a \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '_site/' \
  --exclude 'node_modules/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude 'veildaemon/' \
  --exclude 'tests/' \
  --exclude 'studio/relay/' \
  --exclude 'tools/' \
  --exclude 'Graveyard/' \
  --exclude 'migration/' \
  --exclude 'reports/' \
  --exclude 'personas/' \
  --exclude 'plugins/' \
  --exclude 'scripts/' \
  --exclude '.trash/' \
  --exclude '.codex-remote-attachments/' \
  --exclude '.venv/' \
  --exclude 'venv/' \
  --exclude 'venv311/' \
  --exclude 'hrm_core/' \
  --exclude 'StreamDaemon/' \
  --exclude 'packs/' \
  "$ROOT/" "$OUT/"

test -f "$OUT/.nojekyll"
test -f "$OUT/CNAME"
test -f "$OUT/index.html"

echo "Prepared Pages artifact at $OUT ($(du -sh "$OUT" | awk '{print $1}'))"
