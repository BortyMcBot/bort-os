#!/usr/bin/env bash
set -euo pipefail

# Runs one backlog sweep chunk without invoking the LLM.

CREDS="/root/.openclaw/secrets/gmail/gobuffs10/credentials.json"
TOKEN="/root/.openclaw/secrets/gmail/gobuffs10/token.json"
PREFS="/root/.openclaw/workspace/integrations/gmail/prefs-gobuffs10.json"
STATE="/root/.openclaw/workspace/integrations/gmail/backlog-state-gobuffs10.json"
LOG="/root/.openclaw/workspace/integrations/gmail/backlog-sweep.log"

cd /root/.openclaw/workspace/integrations/gmail

# Tune these if we see rate limits
BATCH="500"
MAXBATCHES="1"
QUERY='in:inbox is:unread'

{
  echo "[$(date -Is)] sweep start batch=${BATCH}";
  node ./backlog-sweep.js \
    --creds "$CREDS" \
    --token "$TOKEN" \
    --prefs "$PREFS" \
    --q "$QUERY" \
    --batch "$BATCH" \
    --maxBatches "$MAXBATCHES" \
    --state "$STATE";
  echo "[$(date -Is)] sweep ok";
} >> "$LOG" 2>&1 || {
  echo "[$(date -Is)] sweep ERROR" >> "$LOG";
  exit 1;
}
