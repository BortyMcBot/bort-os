#!/usr/bin/env node
/**
 * inbox-audit.js — Read-only Gmail inbox composition report.
 *
 * This script NEVER modifies, trashes, or deletes anything. Every Gmail API
 * call is a list or get with no request body mutations.
 *
 * Outputs:
 *  - JSON report:  integrations/gmail/reports/inbox-audit-<timestamp>.json
 *  - Human-readable summary to stdout
 *
 * Queries:
 *  1. Total inbox threads
 *  2. Unread inbox threads
 *  3. Age distribution (>1y, 6m–1y, 90d–6m, <90d)
 *  4. Category counts (promotions, social, updates, forums)
 *  5. Top 30 senders by thread volume (metadata-only scan with checkpointing)
 *
 * Usage:
 *  node inbox-audit.js --creds /path/credentials.json --token /path/token.json
 *
 *  Or via env vars (same as count-unread.js):
 *  GMAIL_CREDS=/path/credentials.json GMAIL_TOKEN=/path/token.json node inbox-audit.js
 *
 *  On VPS:
 *  node integrations/gmail/inbox-audit.js \
 *    --creds /root/.openclaw/secrets/gmail/gobuffs10/credentials.json \
 *    --token /root/.openclaw/secrets/gmail/gobuffs10/token.json
 *
 * Options:
 *  --creds <path>       OAuth credentials JSON (or env GMAIL_CREDS)
 *  --token <path>       OAuth token JSON (or env GMAIL_TOKEN)
 *  --senderPages <n>    Max pages to scan for top-senders (default: 20, 500 threads/page)
 *  --checkpoint <path>  Checkpoint file path (default: reports/audit-checkpoint.json)
 *  --resume             Resume from checkpoint if one exists
 *  --skipSenders        Skip the top-senders scan (fastest run, counts only)
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { loadOAuthClient, pickHeaders, extractEmailAddress } = require('./lib');

// ── CLI args ──

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

// ── Logging ──

function log(msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ${msg}`);
}

// ── Rate-limit backoff (same pattern as backlog-sweep.js) ──

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBackoff(fn, label, { maxRetries = 6, baseMs = 750, maxMs = 15000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      log(`API: ${label}`);
      return await fn();
    } catch (e) {
      const status = e?.code || e?.response?.status;
      const msg = String(e?.message || '');
      const isRate = status === 429 || /rate|quota|userRateLimitExceeded|resource exhausted/i.test(msg);
      if (!isRate || attempt >= maxRetries) throw e;
      const wait = Math.min(maxMs, baseMs * Math.pow(2, attempt));
      log(`  rate-limited (${status}), retry ${attempt + 1}/${maxRetries} in ${wait}ms`);
      await sleep(wait);
      attempt++;
    }
  }
}

// ── Thread counting (paginated) ──

async function countThreads(gmail, q) {
  let pageToken;
  let total = 0;
  let pages = 0;
  while (true) {
    const res = await withBackoff(
      () => gmail.users.threads.list({ userId: 'me', q, maxResults: 500, pageToken, includeSpamTrash: false }),
      `threads.list q="${q}" page=${pages + 1}`
    );
    total += (res.data.threads || []).length;
    pageToken = res.data.nextPageToken;
    pages++;
    if (!pageToken) break;
  }
  return { query: q, count: total, pages };
}

// ── Checkpoint persistence ──

function loadCheckpoint(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveCheckpoint(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ── Top senders scan ──

async function scanTopSenders(gmail, maxPages, checkpointPath, doResume) {
  const q = 'in:inbox';
  let state = doResume ? loadCheckpoint(checkpointPath) : null;

  if (!state || state.phase !== 'senders') {
    state = {
      phase: 'senders',
      pageToken: null,
      scannedThreads: 0,
      pagesScanned: 0,
      senderCounts: {},
      done: false,
      updatedAt: new Date().toISOString(),
    };
  }

  if (state.done) {
    log('Top-senders scan: resuming from completed checkpoint');
    return state;
  }

  if (state.pagesScanned > 0) {
    log(`Top-senders scan: resuming from page ${state.pagesScanned}, ${state.scannedThreads} threads scanned`);
  }

  while (state.pagesScanned < maxPages) {
    const res = await withBackoff(
      () => gmail.users.threads.list({
        userId: 'me',
        q,
        maxResults: 500,
        pageToken: state.pageToken || undefined,
        includeSpamTrash: false,
      }),
      `threads.list (senders) page=${state.pagesScanned + 1}/${maxPages}`
    );

    const threads = res.data.threads || [];
    if (!threads.length) {
      state.done = true;
      break;
    }

    for (const t of threads) {
      const thr = await withBackoff(
        () => gmail.users.threads.get({
          userId: 'me',
          id: t.id,
          format: 'metadata',
          metadataHeaders: ['From'],
        }),
        `threads.get ${t.id} (metadata:From)`
      );

      const msg = thr.data.messages?.[0];
      const hdr = pickHeaders(msg?.payload);
      const email = (extractEmailAddress(hdr.from) || hdr.from || '(unknown)').toLowerCase();
      state.senderCounts[email] = (state.senderCounts[email] || 0) + 1;
      state.scannedThreads++;

      // Checkpoint every 50 threads
      if (state.scannedThreads % 50 === 0) {
        state.updatedAt = new Date().toISOString();
        saveCheckpoint(checkpointPath, state);
        log(`  checkpoint: ${state.scannedThreads} threads scanned, ${Object.keys(state.senderCounts).length} unique senders`);
      }
    }

    state.pageToken = res.data.nextPageToken || null;
    state.pagesScanned++;

    if (!state.pageToken) {
      state.done = true;
      break;
    }

    state.updatedAt = new Date().toISOString();
    saveCheckpoint(checkpointPath, state);
  }

  state.updatedAt = new Date().toISOString();
  saveCheckpoint(checkpointPath, state);
  return state;
}

// ── Main ──

(async () => {
  const credsPath = arg('creds') || process.env.GMAIL_CREDS;
  const tokenPath = arg('token') || process.env.GMAIL_TOKEN;
  const senderPages = parseInt(arg('senderPages', '20'), 10);
  const checkpointPath = arg('checkpoint', path.join(__dirname, 'reports', 'audit-checkpoint.json'));
  const doResume = flag('resume');
  const skipSenders = flag('skipSenders');

  if (!credsPath || !tokenPath) {
    console.error('Usage: node inbox-audit.js --creds <path> --token <path> [--senderPages 20] [--resume] [--skipSenders]');
    console.error('  Or set env: GMAIL_CREDS and GMAIL_TOKEN');
    process.exit(2);
  }

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });
  const started = Date.now();

  log('=== Gmail Inbox Audit (READ-ONLY) ===');

  // 1. Total inbox
  log('--- Count: total inbox threads ---');
  const totalInbox = await countThreads(gmail, 'in:inbox');

  // 2. Unread
  log('--- Count: unread inbox threads ---');
  const unread = await countThreads(gmail, 'in:inbox is:unread');

  // 3. Age distribution
  log('--- Count: age distribution ---');
  const olderThan1y = await countThreads(gmail, 'in:inbox older_than:1y');
  const olderThan6m = await countThreads(gmail, 'in:inbox older_than:6m');
  const olderThan90d = await countThreads(gmail, 'in:inbox older_than:90d');

  const ageDistribution = {
    olderThan1y: olderThan1y.count,
    between6mAnd1y: olderThan6m.count - olderThan1y.count,
    between90dAnd6m: olderThan90d.count - olderThan6m.count,
    newerThan90d: totalInbox.count - olderThan90d.count,
  };

  // 4. Categories
  log('--- Count: category breakdown ---');
  const categories = {};
  for (const cat of ['promotions', 'social', 'updates', 'forums']) {
    const r = await countThreads(gmail, `in:inbox category:${cat}`);
    categories[cat] = r.count;
  }
  categories.primary = totalInbox.count - (categories.promotions + categories.social + categories.updates + categories.forums);
  if (categories.primary < 0) categories.primary = 0; // threads can be in multiple categories

  // 5. Top senders
  let topSenders = [];
  let senderScanMeta = { skipped: true };

  if (!skipSenders) {
    log(`--- Scan: top senders (up to ${senderPages} pages x 500 threads) ---`);
    const senderState = await scanTopSenders(gmail, senderPages, checkpointPath, doResume);

    const sorted = Object.entries(senderState.senderCounts)
      .sort((a, b) => b[1] - a[1]);

    topSenders = sorted.slice(0, 30).map(([sender, count]) => ({ sender, count }));
    senderScanMeta = {
      skipped: false,
      threadsScanned: senderState.scannedThreads,
      pagesScanned: senderState.pagesScanned,
      uniqueSenders: sorted.length,
      scanComplete: senderState.done,
    };
  }

  const elapsedMs = Date.now() - started;

  // ── Build report ──

  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs,
    inbox: {
      totalThreads: totalInbox.count,
      unreadThreads: unread.count,
      readThreads: totalInbox.count - unread.count,
    },
    ageDistribution,
    categories,
    topSenders,
    senderScanMeta,
  };

  // Write JSON report
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const reportPath = path.join(reportDir, `inbox-audit-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report written to: ${reportPath}`);

  // Clean up checkpoint on successful completion
  if (!skipSenders && senderScanMeta.scanComplete && fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
    log('Checkpoint cleaned up (scan complete)');
  }

  // ── Human-readable summary ──

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        GMAIL INBOX AUDIT — RESULTS          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║                                              ║');
  console.log(`║  Total threads:    ${String(report.inbox.totalThreads).padStart(8)}               ║`);
  console.log(`║  Unread:           ${String(report.inbox.unreadThreads).padStart(8)}               ║`);
  console.log(`║  Read:             ${String(report.inbox.readThreads).padStart(8)}               ║`);
  console.log('║                                              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  AGE DISTRIBUTION                            ║');
  console.log('╠──────────────────────────────────────────────╣');
  console.log(`║  > 1 year:         ${String(ageDistribution.olderThan1y).padStart(8)}               ║`);
  console.log(`║  6 months – 1 yr:  ${String(ageDistribution.between6mAnd1y).padStart(8)}               ║`);
  console.log(`║  90 days – 6 mo:   ${String(ageDistribution.between90dAnd6m).padStart(8)}               ║`);
  console.log(`║  < 90 days:        ${String(ageDistribution.newerThan90d).padStart(8)}               ║`);
  console.log('║                                              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  CATEGORIES                                  ║');
  console.log('╠──────────────────────────────────────────────╣');
  console.log(`║  Primary:          ${String(categories.primary).padStart(8)}               ║`);
  console.log(`║  Promotions:       ${String(categories.promotions).padStart(8)}               ║`);
  console.log(`║  Social:           ${String(categories.social).padStart(8)}               ║`);
  console.log(`║  Updates:          ${String(categories.updates).padStart(8)}               ║`);
  console.log(`║  Forums:           ${String(categories.forums).padStart(8)}               ║`);
  console.log('║                                              ║');

  if (topSenders.length) {
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  TOP SENDERS BY VOLUME                       ║');
    console.log('╠──────────────────────────────────────────────╣');
    for (let i = 0; i < topSenders.length; i++) {
      const s = topSenders[i];
      const num = String(i + 1).padStart(2);
      const count = String(s.count).padStart(5);
      const sender = s.sender.length > 32 ? s.sender.slice(0, 29) + '...' : s.sender;
      console.log(`║  ${num}. ${count}  ${sender.padEnd(32)} ║`);
    }
    console.log('║                                              ║');
    if (!senderScanMeta.scanComplete) {
      console.log('║  (scan incomplete — re-run with --resume)    ║');
      console.log('║                                              ║');
    }
  }

  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Elapsed: ${(elapsedMs / 1000).toFixed(1)}s                              ║`);
  console.log(`║  Report:  ${path.basename(reportPath).padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════╝');
})().catch((e) => {
  console.error('FATAL:', e?.response?.data || e?.message || e);
  process.exit(1);
});
