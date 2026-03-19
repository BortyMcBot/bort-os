#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${BORT_WORKSPACE:-/root/.openclaw/workspace}"
GMAIL_DIR="${GMAIL_DIR:-$WORKSPACE/integrations/gmail}"
CREDS="${CREDS:-/root/.openclaw/secrets/gmail/gobuffs10/credentials.json}"
TOKEN="${TOKEN:-/root/.openclaw/secrets/gmail/gobuffs10/token.json}"
STATE="${STATE:-$GMAIL_DIR/backlog-state-gobuffs10.json}"
LOG="${LOG:-$GMAIL_DIR/backlog-sweep.log}"
INITIAL="${INITIAL:-13888}"

cd "$GMAIL_DIR"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-$(node -p "require('${WORKSPACE}/os/constants').TELEGRAM_CHAT_ID" 2>/dev/null || true)}"

UNREAD_JSON=$(GMAIL_CREDS="$CREDS" GMAIL_TOKEN="$TOKEN" node ./count-unread.js)
UNREAD=$(echo "$UNREAD_JSON" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).total')
PROCESSED=$(node -pe 'const s=require(process.argv[1]); console.log(s.processedThreads||0)' "$STATE" 2>/dev/null || echo 0)
UPDATED=$(node -pe 'const s=require(process.argv[1]); console.log(s.updatedAt||"")' "$STATE" 2>/dev/null || echo "")

PCT=$(node - <<NODE
const initial=${INITIAL};
const unread=${UNREAD};
const pct=((initial-unread)/initial*100);
console.log(pct.toFixed(1));
NODE
)

TOP=$(node - "$STATE" <<'NODE'
const st = require(process.argv[1]);
const top = Object.entries(st.offenders||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
console.log(top.map(([k,v])=>`${k}(${v})`).join(', '));
NODE
)

LASTERR=$(tail -n 30 "$LOG" | grep -E "ERROR|rateLimit|429|timeout" | tail -n 2 | tr '\n' ' ' || true)

MSG="Gmail cleanup status (gobuffs10): unread-in-inbox=${UNREAD}/${INITIAL} (${PCT}%). processed=${PROCESSED}. updated=${UPDATED}. top offenders: ${TOP}."
if [[ -n "${LASTERR}" ]]; then
  MSG+=" Recent errors: ${LASTERR}"
fi

if [[ -n "$TELEGRAM_CHAT_ID" ]]; then
  /usr/bin/openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
fi
