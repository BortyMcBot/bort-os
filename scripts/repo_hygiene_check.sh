#!/usr/bin/env bash
set -euo pipefail

REPO="/root/.openclaw/workspace"
STATUS=$(git -C "$REPO" status --porcelain=v1)

if [ -z "$STATUS" ]; then
  exit 0
fi

MSG=$'Repo hygiene check: uncommitted changes detected.\n\n'"$STATUS"
openclaw message send --channel telegram --target 8374853956 --message "$MSG"
