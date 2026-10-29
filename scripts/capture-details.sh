#!/usr/bin/env bash
# Captures showcase detail screenshots in batches of 150 and publishes each batch as it finishes:
# uploads the WebPs to the `showcase` bucket, then records them in showcase_items.
# Resumable: items already tried are skipped. Run from the repo root (Git Bash).
set -euo pipefail
supabase=./node_modules/.bin/supabase
mkdir -p tmp/showcase-details
n=$(find tmp/showcase-details -maxdepth 1 -name "batch-*" -type d 2>/dev/null | wc -l)
while true; do
  n=$((n + 1))
  dir="tmp/showcase-details/batch-$n"
  # Backstop: a wedged browser ends the batch after 40 minutes; finished items are already recorded.
  timeout 2400 node scripts/capture-details.ts --out "$dir" --limit 150 --workers 8 || true
  [ -s "$dir/results.ndjson" ] || { rm -rf "$dir"; echo "All items tried."; break; }
  if [ -d "$dir/img/details" ]; then
    $supabase storage cp -r "$dir/img" ss:///showcase --linked --experimental -j 8 \
      --cache-control "public, max-age=31536000, immutable" >/dev/null || echo "batch $n: upload failed"
  fi
  node scripts/showcase-details-sql.ts "$dir" > "$dir.sql"
  $supabase db query --linked -f "$dir.sql" >/dev/null || echo "batch $n: recording failed"
  echo "batch $n: $(grep -c '"ok":true' "$dir/results.ndjson") captured of $(wc -l < "$dir/results.ndjson") ($(date +%H:%M))"
done
