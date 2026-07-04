#!/usr/bin/env bash
# Ping /api/cron to warm the feed cache. Use with any free cron service (cron-job.org, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${CRON_SECRET:?Set CRON_SECRET in .env.local or the environment}"
SITE_URL="${SITE_URL:-https://markets-dashboard.vercel.app}"

curl -fsS --retry 2 --retry-delay 5 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${SITE_URL%/}/api/cron"

echo "Feed refreshed at ${SITE_URL}/api/cron"
