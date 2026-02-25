#!/usr/bin/env node
/**
 * Daily review: unread inbox triage.
 *
 * Buckets:
 *  - Subscription: has List-Unsubscribe
 *  - SpamReview: subscription + looks spammy
 *  - Important: non-subscription + looks important (keywords/allowlist)
 *  - Other: non-subscription + not important
 *
 * Actions:
 *  - Apply bucket label
 *  - Star ONLY Important
 *  - No mark-read, no archiving (except archive-after-unsubscribe sender rule)
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

function loadPrefs(p) {
  if (!fs.existsSync(p)) return { archiveAfterUnsubscribe: { enabled: true, senders: [] }, important: {} };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function senderMatches(list, fromEmail) {
  const x = (fromEmail || '').toLowerCase();
  return (list || []).some((s) => (s || '').toLowerCase() === x);
}

(async () => {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const prefsPath = arg('prefs', path.join(__dirname, 'prefs-gobuffs10.json'));
  const maxThreads = parseInt(arg('max', '50'), 10);
  if (!credsPath || !tokenPath) {
    console.error('Usage: node daily-review.js --creds /path/credentials.json --token /path/token.json [--prefs prefs.json]');
    process.exit(2);
  }

  const prefs = loadPrefs(prefsPath);
  const archiveEnabled = prefs?.archiveAfterUnsubscribe?.enabled !== false;
  const archiveSenders = prefs?.archiveAfterUnsubscribe?.senders || [];

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const lblImportant = await getOrCreateLabel(gmail, 'Bort/Important');
  const lblOther = await getOrCreateLabel(gmail, 'Bort/Other');
  const lblSub = await getOrCreateLabel(gmail, 'Bort/Subscription');
  const lblSpam = await getOrCreateLabel(gmail, 'Bort/SpamReview');

  const list = await gmail.users.threads.list({
    userId: 'me',
    q: 'in:inbox is:unread',
    maxResults: maxThreads,
  });

  const threads = list.data.threads || [];
  const summary = {
    ok: true,
    scanned: threads.length,
    important: [],
    other: [],
    subscriptions: [],
    spamReview: [],
    archivedByRule: [],
    activeSubscriptions: {},
  };

  for (const t of threads) {
    const thr = await gmail.users.threads.get({
      userId: 'me',
      id: t.id,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
    });

    const msg = thr.data.messages?.[0];
    const hdr = pickHeaders(msg.payload);

    const from = normalizeFrom(hdr.from);
    const fromEmail = extractEmailAddress(hdr.from);
    const subject = hdr.subject || '';
    const unsubTargets = extractUnsubTargets(hdr.listUnsubscribe);
    const hasUnsub = unsubTargets.length > 0;

    let bucket;
    let labelId;

    if (hasUnsub) {
      if (looksSpammy(subject, from)) {
        bucket = 'spamReview';
        labelId = lblSpam.id;
      } else {
        bucket = 'subscriptions';
        labelId = lblSub.id;
      }
    } else {
      if (looksImportant({ fromEmail, subject }, prefs)) {
        bucket = 'important';
        labelId = lblImportant.id;
      } else {
        bucket = 'other';
        labelId = lblOther.id;
      }
    }

    // Apply bucket label (and mark spam as read)
    const removeLabelIds = [];
    if (bucket === 'spamReview') removeLabelIds.push('UNREAD');

    await gmail.users.threads.modify({
      userId: 'me',
      id: t.id,
      requestBody: {
        addLabelIds: [labelId],
        ...(removeLabelIds.length ? { removeLabelIds } : {}),
      },
    });

    if (bucket === 'important') {
      await gmail.users.threads.modify({
        userId: 'me',
        id: t.id,
        requestBody: { addLabelIds: ['STARRED'] },
      });
    }

    if (archiveEnabled && senderMatches(archiveSenders, fromEmail)) {
      await gmail.users.threads.modify({
        userId: 'me',
        id: t.id,
        requestBody: { removeLabelIds: ['INBOX'] },
      });
      summary.archivedByRule.push({ threadId: t.id, from, fromEmail, subject });
    }

    const item = { threadId: t.id, from, fromEmail, subject, date: hdr.date || '', hasUnsubscribe: hasUnsub, unsubTargets };
    summary[bucket].push(item);

    if (hasUnsub) {
      const key = fromEmail || from || '(unknown)';
      const cur = summary.activeSubscriptions[key] || { count: 0, unsubTargets: new Set() };
      cur.count += 1;
      for (const u of unsubTargets) cur.unsubTargets.add(u);
      summary.activeSubscriptions[key] = cur;
    }
  }

  const active = {};
  for (const [k, v] of Object.entries(summary.activeSubscriptions)) {
    active[k] = { count: v.count, unsubTargets: Array.from(v.unsubTargets) };
  }
  summary.activeSubscriptions = active;

  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
