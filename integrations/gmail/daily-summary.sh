#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${BORT_WORKSPACE:-/root/.openclaw/workspace}"
GMAIL_DIR="${GMAIL_DIR:-$WORKSPACE/integrations/gmail}"
CREDS="${CREDS:-/root/.openclaw/secrets/gmail/gobuffs10/credentials.json}"
TOKEN="${TOKEN:-/root/.openclaw/secrets/gmail/gobuffs10/token.json}"
PREFS="${PREFS:-$GMAIL_DIR/prefs-gobuffs10.json}"
OUT="${OUT:-/tmp/gmail-daily.json}"

mkdir -p "$(dirname "$OUT")"
touch "$OUT"

cd "$GMAIL_DIR"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-$(node -e "try{const fs=require('fs');const c=JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));process.stdout.write(String(c?.env?.vars?.TELEGRAM_CHAT_ID||''));}catch{process.stdout.write('')}" )}"

node ./daily-review.js --creds "$CREDS" --token "$TOKEN" --prefs "$PREFS" --max 50 > "$OUT"

# Auto-unsubscribe from anything in SpamReview (best-effort). These are already marked read by daily-review.js.
SPAM_SENDERS=$(OUT="$OUT" node - <<'NODE'
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.OUT,'utf8'));
const spam = d.spamReview || [];
const set = new Set();
for (const it of spam) {
  const s = String(it.fromEmail||'').toLowerCase().trim();
  if (s) set.add(s);
}
process.stdout.write(Array.from(set).join(','));
NODE
)

if [[ -n "$SPAM_SENDERS" ]]; then
  node ./unsubscribe.js --creds "$CREDS" --token "$TOKEN" --senders "$SPAM_SENDERS" --maxPerSender 1 || true
fi

MSG=$(OUT="$OUT" node - <<'NODE'
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.OUT,'utf8'));
const imp = d.important||[];
const oth = d.other||[];
const sub = d.subscriptions||[];
const spam = d.spamReview||[];
const line = (s)=>String(s||'').replace(/\s+/g,' ').trim();

let msg = `Gmail summary (gobuffs10)\n\n`;
msg += `IMPORTANT (starred): ${imp.length}\n`;
for (const it of imp.slice(0,10)) msg += `• ${line(it.fromEmail||it.from)} — ${line(it.subject)}\n`;

msg += `\nOTHER (unread): ${oth.length}`;
if (oth.length) {
  msg += ` (top ${Math.min(10, oth.length)})\n`;
  for (const it of oth.slice(0,10)) msg += `• ${line(it.fromEmail||it.from)} — ${line(it.subject)}\n`;
} else msg += `\n`;

// top senders for subs
const counts = new Map();
for (const it of sub) {
  const k = String(it.fromEmail||it.from||'(unknown)').toLowerCase();
  counts.set(k, (counts.get(k)||0)+1);
}
const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
msg += `\nSUBSCRIPTIONS: ${sub.length}`;
if (sub.length) {
  msg += ` (top senders)\n`;
  for (const [k,c] of top) msg += `• ${k} (${c})\n`;
} else msg += `\n`;

msg += `\nSPAM REVIEW: ${spam.length}`;
console.log(msg);
NODE
)

if [[ -n "$TELEGRAM_CHAT_ID" ]]; then
  openclaw message send --channel telegram --target "$TELEGRAM_CHAT_ID" --message "$MSG"
fi
