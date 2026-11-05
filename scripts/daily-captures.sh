#!/usr/bin/env bash
# Daily follow-up to the 03:00 UTC gallery refresh, run on the capturing PC by Windows Task
# Scheduler ("Openrefs daily captures", 11:30 local): screenshots new showcase items, then makes
# detail captures for new Top picks, then uploads them to R2 and Cloudflare Pages. The capture scripts
# are resumable and skip items already tried. CI runs the same steps daily at 07:00 UTC
# (.github/workflows/daily-captures.yml); this PC job stays as the fallback until CI is trusted.
# Log: tmp/daily-captures.log. Neither step uses the Claude API.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp
{
  echo "== $(date '+%Y-%m-%d %H:%M')"
  # A Playwright update needs a new browser build; this is a no-op when it's already installed.
  pnpm exec playwright install chromium
  bash scripts/capture-showcase.sh
  bash scripts/capture-details.sh
  # Keeps the R2 master copy (openrefs-images) and Cloudflare Pages, where the site loads images from,
  # in step with the database. Each capture batch is
  # already uploaded; this run drops images the site no longer uses.
  node scripts/cdn-sync.ts
} >> tmp/daily-captures.log 2>&1
