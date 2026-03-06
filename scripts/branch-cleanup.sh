#!/usr/bin/env bash
set -euo pipefail

# Branch cleanup script for bort-os
# Removes local and remote branches that have been merged to main.
# Designed to be run daily by Bort via cron, or manually.
#
# Usage:
#   branch-cleanup.sh              # dry-run (default)
#   branch-cleanup.sh --execute    # actually delete branches

REPO="${BORT_WORKSPACE:-/root/.openclaw/workspace}"
MAIN_BRANCH="main"
DRY_RUN=true
TELEGRAM_TARGET="$(node -p "require('${REPO}/os/constants').TELEGRAM_CHAT_ID")"

for arg in "$@"; do
  case "$arg" in
    --execute) DRY_RUN=false ;;
    --repo=*)  REPO="${arg#*=}" ;;
    *)         echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

cd "$REPO"

# Ensure we have the latest remote state
git fetch --prune origin 2>/dev/null

# --- Local branches merged to main ---
LOCAL_MERGED=$(git branch --merged "$MAIN_BRANCH" | grep -v "^\*" | grep -v "^[[:space:]]*${MAIN_BRANCH}$" || true)

# --- Remote branches merged to main (claude/* and bort/* only) ---
REMOTE_MERGED=$(git branch -r --merged "$MAIN_BRANCH" \
  | grep -E "origin/(claude|bort)/" \
  | sed 's|origin/||' \
  | tr -d ' ' || true)

LOCAL_COUNT=$(echo "$LOCAL_MERGED" | grep -c '[^[:space:]]' || true)
REMOTE_COUNT=$(echo "$REMOTE_MERGED" | grep -c '[^[:space:]]' || true)

if [ "$LOCAL_COUNT" -eq 0 ] && [ "$REMOTE_COUNT" -eq 0 ]; then
  echo "No merged branches to clean up."
  exit 0
fi

echo "=== Branch cleanup ==="
echo "Mode: $(if $DRY_RUN; then echo 'dry-run'; else echo 'EXECUTE'; fi)"
echo ""

if [ "$LOCAL_COUNT" -gt 0 ]; then
  echo "Local branches merged to $MAIN_BRANCH ($LOCAL_COUNT):"
  echo "$LOCAL_MERGED" | sed 's/^/  /'
  echo ""
fi

if [ "$REMOTE_COUNT" -gt 0 ]; then
  echo "Remote branches merged to $MAIN_BRANCH ($REMOTE_COUNT):"
  echo "$REMOTE_MERGED" | sed 's/^/  /'
  echo ""
fi

if $DRY_RUN; then
  echo "Run with --execute to delete these branches."
  exit 0
fi

# Delete local merged branches
DELETED_LOCAL=0
if [ "$LOCAL_COUNT" -gt 0 ]; then
  while IFS= read -r branch; do
    branch=$(echo "$branch" | tr -d ' ')
    [ -z "$branch" ] && continue
    echo "Deleting local: $branch"
    git branch -d "$branch"
    DELETED_LOCAL=$((DELETED_LOCAL + 1))
  done <<< "$LOCAL_MERGED"
fi

# Delete remote merged branches
DELETED_REMOTE=0
if [ "$REMOTE_COUNT" -gt 0 ]; then
  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    echo "Deleting remote: origin/$branch"
    git push origin --delete "$branch" 2>/dev/null || echo "  (already deleted on remote)"
    DELETED_REMOTE=$((DELETED_REMOTE + 1))
  done <<< "$REMOTE_MERGED"
fi

SUMMARY="Branch cleanup: deleted $DELETED_LOCAL local, $DELETED_REMOTE remote merged branches."
echo ""
echo "$SUMMARY"

# Notify via Telegram if openclaw is available
if command -v openclaw &>/dev/null; then
  openclaw message send --channel telegram --target "$TELEGRAM_TARGET" --message "$SUMMARY"
fi
