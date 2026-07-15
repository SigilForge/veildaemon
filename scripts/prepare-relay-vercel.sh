#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/_relay-vercel}"

rm -rf "$OUT"
mkdir -p \
  "$OUT/api" \
  "$OUT/assets" \
  "$OUT/studio/assets/brand" \
  "$OUT/studio/relay"

cp "$ROOT/deploy/relay-vercel/vercel.json" "$OUT/vercel.json"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$OUT/"
cp "$ROOT/api/scan-code.js" "$OUT/api/"
cp "$ROOT/api/character.js" "$OUT/api/"
cp "$ROOT/assets/background.webp" "$OUT/assets/"
cp "$ROOT/studio/studio.css" "$OUT/studio/"
cp "$ROOT/studio/assets/brand/favicon.ico" "$OUT/studio/assets/brand/"
cp "$ROOT/studio/assets/brand/cradlepoint-studio-emblem-256.webp" "$OUT/studio/assets/brand/"
cp -R "$ROOT/studio/relay/." "$OUT/studio/relay/"
cp "$ROOT/studio/relay/index.html" "$OUT/index.html"

test -f "$OUT/index.html"
test -f "$OUT/studio/relay/index.html"
test -f "$OUT/studio/relay/relay.js"
test -f "$OUT/studio/relay/vendor/zxing_reader.wasm"
test -f "$OUT/api/character.js"
test -f "$OUT/vercel.json"

echo "Prepared RelayDaemon Vercel project at $OUT"
