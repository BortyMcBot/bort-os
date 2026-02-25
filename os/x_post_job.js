#!/usr/bin/env node

// X post job
// - Runs after digest (scheduled by systemd timer)
// - Parses latest entry from memory/x_digest.log.md
// - Drafts a candidate tweet to memory/x_post_queue.md (append-only)
// - Posts at most 1 tweet per run, only if clearly valuable
// - Uses os/x_call.js for X calls (budget + ledger)
// - Never logs tokens, headers, or response bodies

const fs = require('fs');
const path = require('path');

const { xCall } = require('./x_call');

const DIGEST_PATH = path.join(process.cwd(), 'memory', 'x_digest.log.md');
const QUEUE_PATH = path.join(process.cwd(), 'memory', 'x_post_queue.md');
const RESULTS_PATH = path.join(process.cwd(), 'memory', 'x_post_results.log.md');

function nowPhoenixStamp() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return dtf.format(new Date()).replace(',', '');
}

function ensureFile(p, header) {
  if (fs.existsSync(p)) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, header, { flag: 'wx' });
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function lastDigestEntry(md) {
  // Latest-digest-only: isolate ONLY the most recent digest entry by newest "- ts_utc:" marker
  // inside the "Run metadata" section.
  const idx = md.lastIndexOf('\n- ts_utc:');
  if (idx === -1) return null;

  const runMetaIdx = md.lastIndexOf('\nRun metadata:', idx);
  if (runMetaIdx === -1) return null;

  // Find the start of the digest entry heading preceding this Run metadata.
  const start = md.lastIndexOf('\n## ', runMetaIdx);
  if (start === -1) return null;

  // Find end at next digest heading (or EOF).
  const next = md.indexOf('\n## ', idx + 1);
  const end = next === -1 ? md.length : next;

  return md.slice(start + 1, end).trim();
}

function parseTsUtc(entry) {
  const m = entry.match(/^- ts_utc:\s*(.+)\s*$/m);
  if (!m) return null;
  const d = new Date(m[1]);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parsePhoenixStampToDate(stamp) {
  // stamp format: YYYY-MM-DD HH:MM:SS (America/Phoenix; fixed -07:00)
  const m = String(stamp || '').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}-07:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function hadSuccessfulPostWithinWindow(hours) {
  if (!fs.existsSync(RESULTS_PATH)) return false;
  const md = readText(RESULTS_PATH);
  // Find blocks like:
  // ## <phoenix stamp> (America/Phoenix) — x_post
  // - status: 201
  const re = /^##\s+(.+?)\s+\(America\/Phoenix\)\s+—\s+x_post\s*$/gm;
  let match;
  const now = new Date();

  while ((match = re.exec(md)) !== null) {
    const stamp = match[1].trim();
    const blockStart = match.index;
    const blockEnd = md.indexOf('\n## ', blockStart + 1);
    const block = md.slice(blockStart, blockEnd === -1 ? md.length : blockEnd);

    const statusLine = block.split('\n').find((l) => l.trim().startsWith('- status:')) || '';
    const status = statusLine.split(':').slice(1).join(':').trim();
    if (status !== '201') continue;

    const when = parsePhoenixStampToDate(stamp);
    if (!when) continue;

    const ageMs = now.getTime() - when.getTime();
    if (ageMs >= 0 && ageMs <= hours * 60 * 60 * 1000) return true;
  }

  return false;
}

function extractSection(entry, heading) {
  // heading like "What I learned from X:"
  const idx = entry.indexOf(heading);
  if (idx === -1) return null;
  const rest = entry.slice(idx + heading.length);
  // stop at next blank-line + non-indented heading-ish
  const stopMatch = rest.match(/\n\n[A-Z][^\n]*:\n/);
  const block = stopMatch ? rest.slice(0, stopMatch.index) : rest;
  return block.trim();
}

function parseBullets(block) {
  if (!block) return [];
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

function pickConcreteTakeaway(bullets) {
  const keywords = [
    'deploy',
    'incident',
    'outage',
    'latency',
    'perf',
    'performance',
    'security',
    'vuln',
    'automation',
    'tool',
    'workflow',
    'ops',
    'debug',
    'postmortem',
    'release',
    'ci',
    'tests',
    'remix',
    'react',
    'vercel',
    'cloudflare',
    'shopify',
  ];

  for (const b of bullets) {
    const s = b.toLowerCase();
    if (keywords.some((k) => s.includes(k))) return b;
  }

  // If nothing matches, return null to skip.
  return null;
}

function buildTweet(takeaway) {
  // Must be <=240 chars; include managed-by + what we learned.
  const base = `Dev/ops note from today: ${takeaway}`;
  const footer = `\n\n— Bort (managed by @gobuffs10) ballersanonymo.us`;
  let tweet = base + footer;
  if (tweet.length <= 240) return tweet;

  // Try to shorten takeaway.
  const trimmed = takeaway.length > 140 ? takeaway.slice(0, 139) + '…' : takeaway;
  tweet = `Dev/ops note: ${trimmed}` + footer;
  if (tweet.length <= 240) return tweet;

  // Last resort: shorter footer.
  const shortFooter = `\n\n— Bort (@gobuffs10) ballersanonymo.us`;
  tweet = `Dev/ops note: ${trimmed}` + shortFooter;
  return tweet.slice(0, 240);
}

function appendQueue({ ts, decision, reason, tweet }) {
  ensureFile(
    QUEUE_PATH,
    '# X Post Queue (append-only)\n\nSchema:\n```yaml\n- ts_phoenix: <YYYY-MM-DD HH:MM:SS>\n  decision: post|skip\n  reason: <short>\n  tweet: <string>\n```\n\n---\n\n'
  );

  const block = [
    '- ts_phoenix: ' + ts,
    '  decision: ' + decision,
    '  reason: ' + reason,
    '  tweet: ' + JSON.stringify(tweet || ''),
    '',
  ].join('\n');

  fs.appendFileSync(QUEUE_PATH, block);
}

function appendResult({ ts, status, tweetId, skipped }) {
  ensureFile(RESULTS_PATH, '# X Post Results (append-only; status-only)\n\n');
  const lines = [
    `\n## ${ts} (America/Phoenix) — x_post`,
    '',
    `- status: ${status}`,
    tweetId ? `- tweet_id: ${tweetId}` : '- tweet_id: (none)',
    skipped ? `- skipped: ${skipped}` : '- skipped: (none)',
    '',
  ].join('\n');
  fs.appendFileSync(RESULTS_PATH, lines);
}

async function main() {
  const ts = nowPhoenixStamp();

  if (!fs.existsSync(DIGEST_PATH)) {
    appendQueue({ ts, decision: 'skip', reason: 'no_digest_log', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'no_digest_log' });
    return;
  }

  // Window guard: prevent repeated manual runs from posting.
  if (hadSuccessfulPostWithinWindow(4)) {
    appendQueue({ ts, decision: 'skip', reason: 'already_posted_this_window', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'already_posted_this_window' });
    return;
  }

  const md = readText(DIGEST_PATH);
  const last = lastDigestEntry(md);
  if (!last) {
    appendQueue({ ts, decision: 'skip', reason: 'no_digest_entries', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'no_digest_entries' });
    return;
  }

  // Freshness gate: require latest digest within last 6 hours.
  const tsUtc = parseTsUtc(last);
  if (!tsUtc) {
    appendQueue({ ts, decision: 'skip', reason: 'stale_or_missing_digest', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'stale_or_missing_digest' });
    return;
  }
  const ageMs = Date.now() - tsUtc.getTime();
  if (ageMs < 0 || ageMs > 6 * 60 * 60 * 1000) {
    appendQueue({ ts, decision: 'skip', reason: 'stale_or_missing_digest', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'stale_or_missing_digest' });
    return;
  }

  // Candidate selection: ONLY from the latest digest entry.
  const learnedBlock = extractSection(last, 'What I learned from X (dev/ops only):');
  const bullets = parseBullets(learnedBlock);

  // Items parsing: find matching x.com status link for the chosen takeaway.
  const itemsBlock = extractSection(last, 'Items (excerpts + links):');
  const itemLines = parseBullets(itemsBlock);

  const parsedItems = itemLines
    .map((l) => {
      const urlMatch = l.match(/https:\/\/x\.com\/[^\s]+\/status\/\d+/);
      const url = urlMatch ? urlMatch[0] : null;
      const parts = l.split(' — ');
      const excerpt = parts.length >= 3 ? parts.slice(2).join(' — ').trim() : l;
      return { line: l, url, excerpt };
    })
    .filter((it) => it.url);

  // Hard blocks: RT/reply + marketing/sponsor content.
  const marketingRe = /(store|merch|sale|%\s*off|discount|shipping|sponsor|thank you to|livestream sponsor)/i;

  const cleaned = bullets.filter((b) => {
    const s = String(b || '').trim();
    if (!s) return false;
    if (s.startsWith('RT') || s.includes('RT @') || s.startsWith('@')) return false;
    if (marketingRe.test(s)) return false;
    return true;
  });

  const takeaway = pickConcreteTakeaway(cleaned);

  if (!takeaway) {
    appendQueue({ ts, decision: 'skip', reason: 'no_concrete_takeaway', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'no_concrete_takeaway' });
    return;
  }

  if (takeaway.startsWith('RT') || takeaway.includes('RT @') || takeaway.startsWith('@')) {
    appendQueue({ ts, decision: 'skip', reason: 'blocked_rt_or_reply', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'blocked_rt_or_reply' });
    return;
  }
  if (marketingRe.test(takeaway)) {
    appendQueue({ ts, decision: 'skip', reason: 'blocked_marketing', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'blocked_marketing' });
    return;
  }

  // Find a matching item link by simple keyword overlap.
  const kw = String(takeaway)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);

  const kwSet = new Set(kw);

  function overlapScore(excerptText) {
    const words = String(excerptText)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5);
    let score = 0;
    for (const w of words) if (kwSet.has(w)) score++;
    return score;
  }

  let best = null;
  for (const it of parsedItems) {
    const score = overlapScore(it.excerpt);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { ...it, score };
  }

  if (!best || !best.url || !/^https:\/\/x\.com\/.+\/status\/\d+$/.test(best.url)) {
    appendQueue({ ts, decision: 'skip', reason: 'no_link_for_takeaway', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'no_link_for_takeaway' });
    return;
  }

  const topic = String(takeaway)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Output tweet format:
  // - 1–2 lines about our work
  // - 1 takeaway
  // - link on its own line
  let tweet =
    `Working with @gobuffs10 on OpenClaw X workflows (budget cap + digest/post timers).\n` +
    `Takeaway: ${topic}\n` +
    `${best.url}`;

  if (tweet.length > 240) {
    const shortened = topic.length > 120 ? topic.slice(0, 119) + '…' : topic;
    tweet =
      `Working with @gobuffs10 on OpenClaw X workflows (budget + timers).\n` +
      `Takeaway: ${shortened}\n` +
      `${best.url}`;
  }

  // Final gates
  if (tweet.includes('RT @') || tweet.startsWith('RT') || tweet.startsWith('@')) {
    appendQueue({ ts, decision: 'skip', reason: 'blocked_rt_or_reply', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'blocked_rt_or_reply' });
    return;
  }
  if (marketingRe.test(tweet)) {
    appendQueue({ ts, decision: 'skip', reason: 'blocked_marketing', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'blocked_marketing' });
    return;
  }
  if (tweet.length > 240) {
    appendQueue({ ts, decision: 'skip', reason: 'quality_gate_failed', tweet: '' });
    appendResult({ ts, status: 'skipped', tweetId: null, skipped: 'quality_gate_failed' });
    return;
  }

  // Always draft to queue before posting.
  appendQueue({ ts, decision: 'post', reason: 'concrete_takeaway', tweet });

  // Post (<=1 tweet per run)
  const res = await xCall({
    actionType: 'tweet',
    method: 'POST',
    endpoint: '/2/tweets',
    body: { text: tweet },
    details: 'x_post_job: digest follow-up',
    costUsdOverride: 0.02,
    extractJsonPaths: ['data.id'],
  });

  if (!res.ok && res.blocked) {
    appendResult({ ts, status: 'blocked_by_budget', tweetId: null, skipped: 'blocked_by_budget' });
    return;
  }

  const tweetId = res.extracted?.['data.id'] || null;
  appendResult({ ts, status: res.status, tweetId, skipped: null });
}

main().catch(() => process.exit(1));
