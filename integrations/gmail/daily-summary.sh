#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${BORT_WORKSPACE:-/root/.openclaw/workspace}"
ACCOUNT_SLUG="${ACCOUNT_SLUG:-gobuffs10}"
ACCOUNT_LABEL="${ACCOUNT_LABEL:-$ACCOUNT_SLUG}"
CREDS="${CREDS:-/root/.openclaw/secrets/gmail/${ACCOUNT_SLUG}/credentials.json}"
TOKEN="${TOKEN:-/root/.openclaw/secrets/gmail/${ACCOUNT_SLUG}/token.json}"
PREFS="${PREFS:-${WORKSPACE}/integrations/gmail/prefs-${ACCOUNT_SLUG}.json}"
OUT="${OUT:-/tmp/gmail-daily-${ACCOUNT_SLUG}.json}"

cd "${WORKSPACE}/integrations/gmail"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

node ./daily-review.js --creds "$CREDS" --token "$TOKEN" --prefs "$PREFS" --max 50 > "$OUT"

# Auto-unsubscribe from anything in SpamReview (best-effort). These are already marked read by daily-review.js.
SPAM_SENDERS=$(OUT_PATH="$OUT" node - <<'NODE'
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.OUT_PATH,'utf8'));
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

MSG=$(OUT_PATH="$OUT" ACCOUNT_LABEL="$ACCOUNT_LABEL" ACCOUNT_SLUG="$ACCOUNT_SLUG" node - <<'NODE'
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.OUT_PATH,'utf8'));
const imp = d.important||[];
const oth = d.other||[];
const sub = d.subscriptions||[];
const spam = d.spamReview||[];
const line = (s)=>String(s||'').replace(/\s+/g,' ').trim();

let msg = `Gmail summary (${process.env.ACCOUNT_LABEL || process.env.ACCOUNT_SLUG || 'gmail'})\n\n`;
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
else
  echo "TELEGRAM_CHAT_ID not set; skipping Telegram send." >&2
fi
