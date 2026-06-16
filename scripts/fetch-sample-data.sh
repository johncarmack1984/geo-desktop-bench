#!/usr/bin/env sh
# Fetch the ~6 MB Protomaps Firenze sample basemap into the dirs the demos serve it
# from (kept out of git). Run once after cloning.
set -e
URL="https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for d in geo-render-bench/public geo-render-bench/data web-capstone/public shell-bench/frontend/public; do
  mkdir -p "$ROOT/$d"
  curl -fL -o "$ROOT/$d/firenze.pmtiles" "$URL"
  echo "→ $d/firenze.pmtiles"
done
