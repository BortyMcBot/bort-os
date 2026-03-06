#!/usr/bin/env bash
set -euo pipefail

REPO="/root/.openclaw/workspace"
TELEGRAM_CHAT_ID="$(node -p "require('${REPO}/os/constants').TELEGRAM_CHAT_ID")"
STATUS=$(git -C "$REPO" status --porcelain=v1)

if [ -z "$STATUS" ]; then
  exit 0
fi

# Auto-commit hygiene drift
DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
MESSAGE="chore(repo): automated hygiene sync (${DATE})"

git -C "$REPO" add -A
if git -C "$REPO" commit -m "$MESSAGE"; then
  git -C "$REPO" push origin main
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "Repo hygiene: auto-committed and pushed."
else
  MSG=$'Repo hygiene check: uncommitted changes detected.\n\n'"$STATUS"
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
fi
