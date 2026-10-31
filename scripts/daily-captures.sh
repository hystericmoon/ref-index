#!/usr/bin/env bash
# Daily follow-up to the 03:00 UTC gallery refresh, run on the capturing PC by Windows Task
# Scheduler ("Openrefs daily captures", 11:30 local): screenshots new showcase items, then makes
# detail captures for new Top picks, then uploads them to Cloudflare Pages. The capture scripts are resumable and skip items already tried.
# Log: tmp/daily-captures.log. Neither step uses the Claude API.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp
{
  echo "== $(date '+%Y-%m-%d %H:%M')"
  bash scripts/capture-showcase.sh
  bash scripts/capture-details.sh
  # Copies the new images to Cloudflare Pages, where the site loads them from. Each capture batch is
  # already uploaded; this run drops images the site no longer uses.
  node scripts/cdn-sync.ts
} >> tmp/daily-captures.log 2>&1
