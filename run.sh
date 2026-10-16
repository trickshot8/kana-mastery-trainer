#!/usr/bin/env bash
# Runs all tests against ../index.html (Node 18+ and Python 3, no packages needed).
#   regress.js     practice logic: SRS, answer checking, distractors, confusion hints
#   sync.test.js   optional hub sync, GitHub-Pages behaviour, export/import, chart colours
set -euo pipefail
cd "$(dirname "$0")"
PAGE=../index.html
TMP=$(mktemp -d); trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$TMP"' EXIT
mkdir -p "$TMP/data" "$TMP/static"
echo '[{"id":"p-000001","name":"小明","color":"#3b7dd8"},{"id":"p-000002","name":"爸爸","color":"#4f9a3a"}]' > "$TMP/data/players.json"
python3 -I save_api_replica.py "$TMP/data" 8721 &                                   # a save service ("hub")
(cd "$TMP/static" && python3 -I -m http.server 8723 --bind 127.0.0.1 >/dev/null 2>&1) &   # a static host ("GitHub Pages")
sleep 1
node regress.js "$PAGE"
node sync.test.js "$PAGE" http://127.0.0.1:8721 "$TMP/data" http://127.0.0.1:8729 http://127.0.0.1:8723
