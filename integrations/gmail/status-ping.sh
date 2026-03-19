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
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-$(node -e "try{const fs=require('fs');const c=JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));process.stdout.write(String(c?.env?.vars?.TELEGRAM_CHAT_ID||''));}catch{process.stdout.write('')}" )}"

UNREAD_JSON=$(GMAIL_CREDS="$CREDS" GMAIL_TOKEN="$TOKEN" node ./count-unread.js)
UNREAD=$(echo "$UNREAD_JSON" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).total')
PROCESSED=$(node -e 'const fs=require("fs"); try { const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(s.processedThreads||0)); } catch { process.stdout.write("0"); }' "$STATE")
UPDATED=$(node -e 'const fs=require("fs"); try { const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(s.updatedAt||"")); } catch { process.stdout.write(""); }' "$STATE")

PCT=$(node - <<NODE
const initial=${INITIAL};
const unread=${UNREAD};
const pct=((initial-unread)/initial*100);
console.log(pct.toFixed(1));
NODE
)

TOP=$(node - "$STATE" <<'NODE'
const fs = require('fs');
let st = {};
try {
  st = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
} catch {
  st = {};
}
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
