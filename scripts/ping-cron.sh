#!/usr/bin/env bash
# Ping /api/feed to warm the Vercel edge cache. Use with any free cron service (cron-job.org, etc.)
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

BYPASS_ARGS=()
if [ -n "${VERCEL_BYPASS_SECRET:-}" ]; then
  BYPASS_ARGS=(-H "x-vercel-protection-bypass: ${VERCEL_BYPASS_SECRET}")
fi

curl -fsS --retry 2 --retry-delay 5 \
  "${BYPASS_ARGS[@]}" \
  "${SITE_URL%/}/api/feed"

echo "Feed refreshed at ${SITE_URL}/api/feed"
