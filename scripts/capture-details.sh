#!/usr/bin/env bash
# Captures showcase detail screenshots in batches of 150 and publishes each batch as it finishes:
# adds the WebPs to the cdn/ mirror and uploads it to Cloudflare Pages (scripts/cdn-sync.ts), then
# records them in showcase_items.
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
  # A failed upload skips recording that batch: rerun the sync with --add, then the two SQL commands.
  if [ -d "$dir/img/details" ]; then
    node scripts/cdn-sync.ts --add "$dir" >/dev/null || { echo "batch $n: upload failed, not recorded"; continue; }
  fi
  node scripts/showcase-details-sql.ts "$dir" > "$dir.sql"
  $supabase db query --linked -f "$dir.sql" >/dev/null || echo "batch $n: recording failed"
  echo "batch $n: $(grep -c '"ok":true' "$dir/results.ndjson") captured of $(wc -l < "$dir/results.ndjson") ($(date +%H:%M))"
done
