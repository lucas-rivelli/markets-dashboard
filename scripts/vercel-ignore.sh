#!/usr/bin/env bash
# Skip Vercel deploys for data-only sync commits (bash 3.2 compatible — no mapfile).
# Exit 0 = skip build, exit 1 = proceed with build (Vercel ignoreCommand contract).
set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
CUR="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [ -n "$PREV" ] && git cat-file -e "$PREV^{commit}" 2>/dev/null; then
  RANGE="$PREV..$CUR"
elif git rev-parse HEAD^ >/dev/null 2>&1; then
  RANGE="HEAD^..HEAD"
else
  exit 1
fi

CHANGED="$(git diff --name-only "$RANGE" || true)"
if [ -z "$CHANGED" ]; then
  exit 0
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    data/workspace.json|data/spotify-cache.json|data/vic-cache.json|data/writings.json|data/bookmarks.json) ;;
    *) exit 1 ;;
  esac
done <<EOF
$CHANGED
EOF

exit 0
