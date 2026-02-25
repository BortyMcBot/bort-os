#!/usr/bin/env node
/**
 * Backlog sweep: page through unread inbox threads, classify, label/star, and optionally mark read.
 *
 * Buckets:
 *  - Subscription: has List-Unsubscribe
 *  - SpamReview: subscription + looks spammy
 *  - Important: non-subscription + looks important (keywords/allowlist)
 *  - Other: non-subscription + not important
 *
 * Cleanup-phase actions (per Bryan):
 *  - Apply bucket label always
 *  - Star ONLY Important
 *  - Mark READ only for Subscription + SpamReview
 *  - Leave Important + Other UNREAD
 *  - Archive only if sender is in archive-after-unsubscribe list
 *
 * Performance:
 *  - Exactly 1 threads.get + 1 threads.modify per thread (modify combines label/star/read/archive)
 *
 * Usage:
 *  node backlog-sweep.js --creds ... --token ... --prefs prefs.json [--q "in:inbox is:unread"]
 *                     [--batch 200] [--state state.json] [--maxBatches 50]
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const {
  loadOAuthClient,
  getOrCreateLabel,
  pickHeaders,
  extractUnsubTargets,
  normalizeFrom,
  extractEmailAddress,
} = require('./lib');
const { looksSpammy, looksImportant } = require('./classify');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function loadJson(p, fallback) {
  if (!p) return fallback;
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function inc(map, key, by = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + by;
}

function senderMatches(list, fromEmail) {
  const x = (fromEmail || '').toLowerCase();
  return (list || []).some((s) => (s || '').toLowerCase() === x);
}

(async () => {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const prefsPath = arg('prefs', path.join(__dirname, 'prefs-gobuffs10.json'));
  const q = arg('q', 'in:inbox is:unread');
  const batch = parseInt(arg('batch', '200'), 10);
  const maxBatches = parseInt(arg('maxBatches', '20'), 10);
  const statePath = arg('state', path.join(__dirname, 'backlog-state-gobuffs10.json'));

  if (!credsPath || !tokenPath) {
    console.error('Missing --creds/--token');
    process.exit(2);
  }

  const prefs = loadJson(prefsPath, { archiveAfterUnsubscribe: { enabled: true, senders: [] }, important: {}, unimportant: {} });
  const archiveEnabled = prefs?.archiveAfterUnsubscribe?.enabled !== false;
  const archiveSenders = prefs?.archiveAfterUnsubscribe?.senders || [];

  const state = loadJson(statePath, {
    q,
    nextPageToken: null,
    processedThreads: 0,
    labeledImportant: 0,
    labeledOther: 0,
    labeledSubscription: 0,
    labeledSpamReview: 0,
    starred: 0,
    markedRead: 0,
    archivedByRule: 0,
    offenders: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (state.q !== q) {
    state.q = q;
    state.nextPageToken = null;
  }

  // Persist state immediately so progress survives SIGKILL/timeouts.
  state.updatedAt = new Date().toISOString();
  saveJson(statePath, state);

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const lblImportant = await getOrCreateLabel(gmail, 'Bort/Important');
  const lblOther = await getOrCreateLabel(gmail, 'Bort/Other');
  const lblSub = await getOrCreateLabel(gmail, 'Bort/Subscription');
  const lblSpam = await getOrCreateLabel(gmail, 'Bort/SpamReview');

  let pageToken = state.nextPageToken || undefined;
  let batches = 0;

  while (batches < maxBatches) {
    const res = await gmail.users.threads.list({ userId: 'me', q, maxResults: batch, pageToken });
    const threads = res.data.threads || [];
    pageToken = res.data.nextPageToken;

    if (!threads.length) {
      state.nextPageToken = null;
      state.updatedAt = new Date().toISOString();
      saveJson(statePath, state);
      console.log(JSON.stringify({ ok: true, done: true, state }, null, 2));
      return;
    }

    for (const t of threads) {
      const thr = await gmail.users.threads.get({
        userId: 'me',
        id: t.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
      });
      const msg = thr.data.messages?.[0];
      const hdr = pickHeaders(msg.payload);

      const from = normalizeFrom(hdr.from);
      const fromEmail = extractEmailAddress(hdr.from);
      const fromEmailLc = (fromEmail || '').toLowerCase();
      const subject = hdr.subject || '';
      const unsubTargets = extractUnsubTargets(hdr.listUnsubscribe);
      const hasUnsub = unsubTargets.length > 0;

      let bucket;
      let labelId;
      let shouldStar = false;
      let shouldMarkRead = false;

      if (hasUnsub) {
        inc(state.offenders, fromEmailLc || from);
        if (looksSpammy(subject, from)) {
          bucket = 'spamReview';
          labelId = lblSpam.id;
          state.labeledSpamReview += 1;
        } else {
          bucket = 'subscription';
          labelId = lblSub.id;
          state.labeledSubscription += 1;
        }
        shouldMarkRead = true; // cleanup rule
      } else {
        if (looksImportant({ fromEmail, subject }, prefs)) {
          bucket = 'important';
          labelId = lblImportant.id;
          state.labeledImportant += 1;
          shouldStar = true;
        } else {
          bucket = 'other';
          labelId = lblOther.id;
          state.labeledOther += 1;
        }
      }

      const addLabelIds = [labelId];
      if (shouldStar) addLabelIds.push('STARRED');

      const removeLabelIds = [];
      if (shouldMarkRead) removeLabelIds.push('UNREAD');

      if (archiveEnabled && senderMatches(archiveSenders, fromEmail)) {
        removeLabelIds.push('INBOX');
        state.archivedByRule += 1;
      }

      await gmail.users.threads.modify({
        userId: 'me',
        id: t.id,
        requestBody: {
          addLabelIds,
          ...(removeLabelIds.length ? { removeLabelIds } : {}),
        },
      });

      if (shouldStar) state.starred += 1;
      if (shouldMarkRead) state.markedRead += 1;

      state.processedThreads += 1;

      // Persist progress periodically (every 10 threads) to reduce IO overhead.
      if (state.processedThreads % 10 === 0) {
        state.updatedAt = new Date().toISOString();
        saveJson(statePath, state);
      }
    }

    state.nextPageToken = pageToken || null;
    state.updatedAt = new Date().toISOString();
    saveJson(statePath, state);

    batches += 1;

    if (!pageToken) {
      console.log(JSON.stringify({ ok: true, done: true, state }, null, 2));
      return;
    }
  }

  console.log(JSON.stringify({ ok: true, done: false, state }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
