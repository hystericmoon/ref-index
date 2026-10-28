#!/usr/bin/env bash
# Captures showcase screenshots in batches of 400 and publishes each batch as it finishes:
# uploads the WebPs to the `showcase` bucket, then records them in showcase_items.
# Resumable: items already tried are skipped. Run from the repo root (Git Bash).
set -euo pipefail
supabase=./node_modules/.bin/supabase
n=$(find tmp/showcase-thumbs -maxdepth 1 -name "batch-*" -type d 2>/dev/null | wc -l)
while true; do
  n=$((n + 1))
  dir="tmp/showcase-thumbs/batch-$n"
  node scripts/capture-showcase.ts --out "$dir" --limit 400 --workers 10
  [ -s "$dir/results.ndjson" ] || { rm -rf "$dir"; echo "All items tried."; break; }
  if ls "$dir"/img/*.webp >/dev/null 2>&1; then
    $supabase storage cp -r "$dir/img" ss:///showcase --linked --experimental -j 8 \
      --cache-control "public, max-age=31536000, immutable" >/dev/null
  fi
  node scripts/showcase-thumbs-sql.ts "$dir" > "$dir.sql"
  $supabase db query --linked -f "$dir.sql" >/dev/null
  echo "batch $n: $(grep -c '"ok":true' "$dir/results.ndjson") captured of $(wc -l < "$dir/results.ndjson")"
done
