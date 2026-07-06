#!/usr/bin/env bash
# Ping /api/trigger-bookmarks to queue a GitHub Actions bookmark sync.
# Use with cron-job.org (every 5 minutes) or any external scheduler.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

SITE_URL="${SITE_URL:-https://markets-dashboard-knowledgemaxxing.vercel.app}"
CRON_SECRET="${CRON_SECRET:-}"

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET is not set. Add it to .env.local or export it." >&2
  exit 1
fi

RESP=$(curl -fsS --retry 2 --retry-delay 5 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  ${VERCEL_BYPASS_SECRET:+-H "x-vercel-protection-bypass: ${VERCEL_BYPASS_SECRET}"} \
  "${SITE_URL%/}/api/trigger-bookmarks")

echo "$RESP"
echo "Bookmark sync queued via ${SITE_URL}/api/trigger-bookmarks"
