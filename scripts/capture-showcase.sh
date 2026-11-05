#!/usr/bin/env bash
# Captures showcase screenshots in batches of 400 and publishes each batch as it finishes:
# adds the WebPs to the cdn/ mirror and uploads it to Cloudflare Pages (scripts/cdn-sync.ts), then
# records them in showcase_items.
# Resumable: items already tried are skipped. Run from the repo root (Git Bash).
# CAPTURE_LIMIT (items per batch, default 400), CAPTURE_WORKERS (default 12) and MAX_BATCHES
# (default: until every item is tried) size a run, e.g. for a CI runner or a small test.
set -euo pipefail
supabase=./node_modules/.bin/supabase
mkdir -p tmp/showcase-thumbs
n=$(find tmp/showcase-thumbs -maxdepth 1 -name "batch-*" -type d 2>/dev/null | wc -l)
batches=0
while [ "$batches" -lt "${MAX_BATCHES:-1000000}" ]; do
  batches=$((batches + 1))
  n=$((n + 1))
  dir="tmp/showcase-thumbs/batch-$n"
  # Backstop: a wedged browser ends the batch after 30 minutes; finished items are already recorded.
  timeout 1800 node scripts/capture-showcase.ts --out "$dir" --limit "${CAPTURE_LIMIT:-400}" --workers "${CAPTURE_WORKERS:-12}" || true
  [ -s "$dir/results.ndjson" ] || { rm -rf "$dir"; echo "All items tried."; break; }
  # A failed upload skips recording that batch: rerun the sync with --add, then the two SQL commands.
  if [ -n "$(find "$dir/img" -name "*.webp" 2>/dev/null | head -1)" ]; then
    node scripts/cdn-sync.ts --add "$dir" >/dev/null || { echo "batch $n: upload failed, not recorded"; continue; }
  fi
  node scripts/showcase-thumbs-sql.ts "$dir" > "$dir.sql"
  $supabase db query --linked -f "$dir.sql" >/dev/null || echo "batch $n: recording failed"
  echo "batch $n: $(grep -c '"ok":true' "$dir/results.ndjson") captured of $(wc -l < "$dir/results.ndjson") ($(date +%H:%M))"
done
