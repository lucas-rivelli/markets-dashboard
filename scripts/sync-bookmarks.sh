#!/usr/bin/env bash
# Sync X bookmarks from birdclaw → data/bookmarks.json → GitHub
# Run manually or via launchd/cron on your Mac each morning.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v birdclaw >/dev/null 2>&1; then
  echo "birdclaw not found. Install: npm i -g birdclaw (or see https://birdclaw.sh/)" >&2
  exit 1
fi

echo "Syncing bookmarks from X…" >&2
birdclaw sync bookmarks --mode auto --limit 100 --max-pages 5 --early-stop --refresh --json >/dev/null 2>&1 || true

echo "Exporting bookmarks…" >&2
birdclaw search tweets --bookmarked --limit 100 --json \
  | node scripts/export-bookmarks.js

if git diff --quiet data/bookmarks.json; then
  echo "No bookmark changes." >&2
  exit 0
fi

git add data/bookmarks.json
git commit -m "Update X bookmarks from birdclaw"
git push origin main

echo "Bookmarks pushed to GitHub." >&2
