#!/usr/bin/env node
/**
 * For label Bort/Other unread threads:
 *  - Keep unread if sender has < 3 unread threads
 *  - Mark read for senders with >= 3 unread threads
 *
 * Usage:
 *  node other-prune.js --creds ... --token ... [--label "Bort/Other"] [--threshold 3]
 */

const { google } = require('googleapis');
const {
  loadOAuthClient,
  pickHeaders,
  normalizeFrom,
  extractEmailAddress,
} = require('./lib');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function listAllThreads(gmail, q) {
  let pageToken;
  const out = [];
  while (true) {
    const res = await gmail.users.threads.list({ userId: 'me', q, maxResults: 500, pageToken });
    out.push(...(res.data.threads || []));
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

(async () => {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const label = arg('label', 'Bort/Other');
  const threshold = parseInt(arg('threshold', '3'), 10);
  if (!credsPath || !tokenPath) {
    console.error('Usage: node other-prune.js --creds /path/credentials.json --token /path/token.json');
    process.exit(2);
  }

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const q = `label:"${label}" is:unread`;
  const threads = await listAllThreads(gmail, q);

  // Pass 1: gather sender per thread, count senders.
  const items = [];
  const counts = new Map();

  for (const t of threads) {
    const thr = await gmail.users.threads.get({
      userId: 'me',
      id: t.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const msg = thr.data.messages?.[0];
    const hdr = pickHeaders(msg.payload);
    const fromEmail = (extractEmailAddress(hdr.from) || '').toLowerCase();
    const from = normalizeFrom(hdr.from);
    const subject = hdr.subject || '';
    items.push({ threadId: t.id, fromEmail, from, subject });
    counts.set(fromEmail, (counts.get(fromEmail) || 0) + 1);
  }

  // Determine which senders to mark read.
  const markSenders = new Set();
  for (const [email, c] of counts.entries()) {
    if (!email) continue;
    if (c >= threshold) markSenders.add(email);
  }

  // Pass 2: mark read those threads.
  let marked = 0;
  for (const it of items) {
    if (markSenders.has(it.fromEmail)) {
      await gmail.users.threads.modify({
        userId: 'me',
        id: it.threadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
      marked += 1;
    }
  }

  // Summary
  const sendersSorted = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]);
  const kept = sendersSorted.filter(([_,c])=>c < threshold).length;
  const pruned = sendersSorted.filter(([_,c])=>c >= threshold).length;

  console.log(JSON.stringify({
    ok: true,
    query: q,
    unreadThreadsInLabel: threads.length,
    uniqueSenders: counts.size,
    threshold,
    sendersKeptUnread: kept,
    sendersMarkedRead: pruned,
    threadsMarkedRead: marked,
    topSenders: sendersSorted.slice(0, 20).map(([email,count])=>({email,count}))
  }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
