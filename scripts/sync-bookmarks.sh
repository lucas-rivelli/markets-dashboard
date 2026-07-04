#!/usr/bin/env bash
# Sync X bookmarks from birdclaw → data/bookmarks.json → GitHub
# Run manually or via launchd/cron on your Mac each morning.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BIRDCLAW="npx birdclaw"
if ! $BIRDCLAW --version >/dev/null 2>&1; then
  echo "birdclaw not found. Run: npm install" >&2
  exit 1
fi

echo "Syncing bookmarks from X…" >&2
if ! $BIRDCLAW sync bookmarks --mode auto --limit 100 --max-pages 5 --early-stop --refresh --json >/dev/null; then
  echo "Bookmark sync failed. Log into x.com in Safari/Chrome, enable Full Disk Access for Cursor/Terminal, or set AUTH_TOKEN and CT0 in .env.local." >&2
  exit 1
fi

echo "Exporting bookmarks…" >&2
$BIRDCLAW search tweets --bookmarked --limit 100 --json \
  | node scripts/export-bookmarks.js

if git diff --quiet data/bookmarks.json; then
  echo "No bookmark changes." >&2
  exit 0
fi

git add data/bookmarks.json
git commit -m "Update X bookmarks from birdclaw"
git push origin main

echo "Bookmarks pushed to GitHub." >&2
