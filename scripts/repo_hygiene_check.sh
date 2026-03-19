#!/usr/bin/env bash
set -euo pipefail

REPO="/root/.openclaw/workspace"
TELEGRAM_CHAT_ID="$(node -p "require('${REPO}/os/constants').TELEGRAM_CHAT_ID")"
STATUS=$(git -C "$REPO" status --porcelain=v1)
EXECUTE="${HYGIENE_EXECUTE:-false}"
if [ "${1:-}" = "--execute" ]; then EXECUTE="true"; fi
ALLOWLIST="${HYGIENE_ALLOWLIST:-memory/ logs/}"

if [ -z "$STATUS" ]; then
  exit 0
fi

# Default: report-only
if [ "$EXECUTE" != "true" ]; then
  MSG=$'Repo hygiene check: uncommitted changes detected (report-only mode).\n\n'"$STATUS"
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
  exit 0
fi

# Explicit execute mode with scoped path allowlist
DISALLOWED=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(printf '%s' "$line" | sed -E 's/^.. //')
  ok=false
  for p in $ALLOWLIST; do
    case "$file" in
      "$p"*) ok=true; break ;;
    esac
  done
  if [ "$ok" = false ]; then
    DISALLOWED+="$line"$'\n'
  fi
done <<< "$STATUS"

if [ -n "$DISALLOWED" ]; then
  MSG=$'Repo hygiene execute blocked: changes outside allowlist.\n\n'"$DISALLOWED"
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
  exit 1
fi

DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
MESSAGE="chore(repo): automated hygiene sync (${DATE})"

ADD_PATHS=()
for p in $ALLOWLIST; do ADD_PATHS+=("$p"); done

git -C "$REPO" add -- "${ADD_PATHS[@]}"
if git -C "$REPO" commit -m "$MESSAGE"; then
  git -C "$REPO" push origin main
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "Repo hygiene: allowlisted changes committed and pushed."
else
  MSG=$'Repo hygiene check: allowlisted changes detected but commit was not created.\n\n'"$STATUS"
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
fi
