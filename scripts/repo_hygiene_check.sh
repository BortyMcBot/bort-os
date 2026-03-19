#!/usr/bin/env bash
set -euo pipefail

REPO="/root/.openclaw/workspace"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-$(node -e "try{const fs=require('fs');const c=JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));process.stdout.write(String(c?.env?.vars?.TELEGRAM_CHAT_ID||''));}catch{process.stdout.write('')}" )}"
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
  if [ -n "$TELEGRAM_CHAT_ID" ]; then
    openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "Repo hygiene: auto-committed and pushed."
  fi
else
  MSG=$'Repo hygiene check: uncommitted changes detected.\n\n'"$STATUS"
  if [ -n "$TELEGRAM_CHAT_ID" ]; then
    openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
  fi
fi
