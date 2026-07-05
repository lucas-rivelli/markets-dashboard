#!/usr/bin/env bash
# Skip Vercel deploys for workspace-only sync commits.
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

mapfile -t CHANGED < <(git diff --name-only "$RANGE")

if [ "${#CHANGED[@]}" -eq 0 ]; then
  exit 0
fi

for path in "${CHANGED[@]}"; do
  if [ "$path" != "data/workspace.json" ]; then
    exit 1
  fi
done

exit 0
