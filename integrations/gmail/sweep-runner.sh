#!/usr/bin/env bash
set -euo pipefail

# Runs one backlog sweep chunk without invoking the LLM.

WORKSPACE="${BORT_WORKSPACE:-/root/.openclaw/workspace}"
GMAIL_DIR="${GMAIL_DIR:-$WORKSPACE/integrations/gmail}"
RUNTIME_DIR="${GMAIL_RUNTIME_DIR:-$HOME/.openclaw/state/gmail}"
CREDS="${CREDS:-/root/.openclaw/secrets/gmail/gobuffs10/credentials.json}"
TOKEN="${TOKEN:-/root/.openclaw/secrets/gmail/gobuffs10/token.json}"
PREFS="${PREFS:-$GMAIL_DIR/prefs-gobuffs10.json}"
STATE="${STATE:-$RUNTIME_DIR/backlog-state-gobuffs10.json}"
LOG="${LOG:-$RUNTIME_DIR/backlog-sweep.log}"

[[ -f "$CREDS" ]] || { echo "Missing creds: $CREDS" >&2; exit 2; }
[[ -f "$TOKEN" ]] || { echo "Missing token: $TOKEN" >&2; exit 2; }
[[ -f "$PREFS" ]] || { echo "Missing prefs: $PREFS" >&2; exit 2; }

mkdir -p "$RUNTIME_DIR"

cd "$GMAIL_DIR"

# Tune these if we see rate limits
BATCH="${BATCH:-500}"
MAXBATCHES="${MAXBATCHES:-1}"
QUERY="${QUERY:-in:inbox is:unread}"

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
