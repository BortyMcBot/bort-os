#!/usr/bin/env node
/**
 * Resumable Bort/Other unread prune.
 *
 * Rule:
 *  - keep unread if sender has < threshold unread threads in label
 *  - mark read for senders with >= threshold
 *
 * Two-phase (but can be run repeatedly; it will resume):
 *  - scan: build sender counts + cache thread->sender
 *  - apply: mark threads read for senders meeting threshold
 *
 * Usage:
 *  node other-prune2.js --creds ... --token ... [--label "Bort/Other"] [--threshold 3]
 *                    [--scanLimit 200] [--applyLimit 200] [--state state.json]
 */

const fs = require('fs');
const path = require('path');
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

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

async function listThreadsPage(gmail, q, pageToken) {
  const res = await gmail.users.threads.list({ userId: 'me', q, maxResults: 500, pageToken });
  return {
    threads: res.data.threads || [],
    nextPageToken: res.data.nextPageToken || null,
  };
}

(async () => {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const label = arg('label', 'Bort/Other');
  const threshold = parseInt(arg('threshold', '3'), 10);
  const scanLimit = parseInt(arg('scanLimit', '200'), 10);
  const applyLimit = parseInt(arg('applyLimit', '200'), 10);
  const statePath = arg('state', path.join(__dirname, 'other-prune-state-gobuffs10.json'));

  if (!credsPath || !tokenPath) {
    console.error('Usage: node other-prune2.js --creds ... --token ...');
    process.exit(2);
  }

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const q = `label:\"${label}\" is:unread`;

  const state = loadJson(statePath, {
    version: 1,
    label,
    threshold,
    q,
    scan: {
      pageToken: null,
      done: false,
      scannedThreads: 0,
    },
    apply: {
      cursor: 0,
      done: false,
      markedRead: 0,
    },
    // maps
    threadToSender: {},
    senderCounts: {},
    updatedAt: null,
  });

  // If label/threshold changed, reset.
  if (state.label !== label || state.threshold !== threshold) {
    state.label = label;
    state.threshold = threshold;
    state.q = q;
    state.scan = { pageToken: null, done: false, scannedThreads: 0 };
    state.apply = { cursor: 0, done: false, markedRead: 0 };
    state.threadToSender = {};
    state.senderCounts = {};
  }

  // --- SCAN CHUNK ---
  let scannedThisRun = 0;
  while (!state.scan.done && scannedThisRun < scanLimit) {
    const page = await listThreadsPage(gmail, q, state.scan.pageToken || undefined);
    const threads = page.threads;

    if (!threads.length) {
      state.scan.done = true;
      break;
    }

    for (const t of threads) {
      if (scannedThisRun >= scanLimit) break;
      if (state.threadToSender[t.id]) continue;

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

      const sender = fromEmail || from || '(unknown)';
      state.threadToSender[t.id] = sender;
      state.senderCounts[sender] = (state.senderCounts[sender] || 0) + 1;

      state.scan.scannedThreads += 1;
      scannedThisRun += 1;

      if (state.scan.scannedThreads % 20 === 0) {
        state.updatedAt = new Date().toISOString();
        saveJson(statePath, state);
      }
    }

    state.scan.pageToken = page.nextPageToken;
    if (!page.nextPageToken) state.scan.done = true;

    state.updatedAt = new Date().toISOString();
    saveJson(statePath, state);
  }

  // --- APPLY CHUNK ---
  // Build a stable list of threads to process.
  const threadIds = Object.keys(state.threadToSender);
  let appliedThisRun = 0;

  while (state.scan.done && !state.apply.done && appliedThisRun < applyLimit) {
    if (state.apply.cursor >= threadIds.length) {
      state.apply.done = true;
      break;
    }

    const tid = threadIds[state.apply.cursor];
    const sender = state.threadToSender[tid];
    const c = state.senderCounts[sender] || 0;

    if (c >= threshold) {
      await gmail.users.threads.modify({
        userId: 'me',
        id: tid,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
      state.apply.markedRead += 1;
      appliedThisRun += 1;
    }

    state.apply.cursor += 1;

    if (state.apply.cursor % 50 === 0) {
      state.updatedAt = new Date().toISOString();
      saveJson(statePath, state);
    }
  }

  // Summaries
  const senderEntries = Object.entries(state.senderCounts);
  senderEntries.sort((a,b)=>b[1]-a[1]);
  const sendersToRead = senderEntries.filter(([_,c]) => c >= threshold).length;
  const sendersToKeep = senderEntries.filter(([_,c]) => c < threshold).length;

  state.updatedAt = new Date().toISOString();
  saveJson(statePath, state);

  console.log(JSON.stringify({
    ok: true,
    label,
    threshold,
    scan: state.scan,
    apply: state.apply,
    sendersCounted: senderEntries.length,
    sendersToKeepUnread: sendersToKeep,
    sendersToMarkRead: sendersToRead,
    scannedThisRun,
    appliedThisRun,
    topSenders: senderEntries.slice(0, 15).map(([sender,count])=>({sender,count})),
    statePath,
    updatedAt: state.updatedAt,
  }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
