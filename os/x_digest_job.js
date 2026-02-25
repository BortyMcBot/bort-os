#!/usr/bin/env node

// X digest job (read-only)
// - Budget-safe (target <= $0.05/day; runs every 4 hours => aim <= $0.008/run)
// - Uses os/x_call.js for all X calls
// - Rotates through curated accounts; fetches up to 1 user's recent tweets per run
// - Stores only short excerpts + links/ids + summaries (no full dumps)

const fs = require('fs');
const path = require('path');

const { xCall } = require('./x_call');

const LOG_PATH = path.join(process.cwd(), 'memory', 'x_digest.log.md');
const STATE_PATH = path.join(process.cwd(), 'memory', 'x_digest_state.json');

function nowPhoenixStamp() {
  // ISO-ish stamp in America/Phoenix
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

function safeReadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function ensureLogFile() {
  if (fs.existsSync(LOG_PATH)) return;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(
    LOG_PATH,
    '# X Digest Log (append-only)\n\n(Dev/ops-focused summaries; no full tweet dumps.)\n',
    { flag: 'wx' }
  );
}

function excerpt(s, n = 140) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + '…';
}

function tweetUrl(username, id) {
  if (!username || !id) return null;
  return `https://x.com/${username}/status/${id}`;
}

function pickAccount(curated, state) {
  const i = Number(state.nextIndex || 0);
  const idx = (i >= 0 ? i : 0) % curated.length;
  const acct = curated[idx];
  const nextIndex = (idx + 1) % curated.length;
  return { acct, nextIndex };
}

async function main() {
  ensureLogFile();

  // Curated set: start with 3 already followed, plus up to 7 more from our follow list.
  // (Usernames only; IDs resolved per-run to avoid storing more state. Budget keeps it to 1 account fetch.)
  const curated = [
    { username: 'OpenAI' },
    { username: 'Shopify' },
    { username: 'remix_run' },
    { username: 'reactjs' },
    { username: 'vercel' },
    { username: 'CloudflareDev' },
    { username: 'github' },
    { username: 'PostHog' },
  ];

  const state = safeReadJson(STATE_PATH, { nextIndex: 0 });
  const { acct, nextIndex } = pickAccount(curated, state);

  const meta = {
    ts_phoenix: nowPhoenixStamp(),
    endpoints: [],
    statusCodes: [],
    ingested: 0,
    skipped: 0,
  };

  // Budget target: only 1 account per run.
  // Step A: resolve id (GET /2/users/by/username/:username)
  const lookup = await xCall({
    actionType: 'lookup',
    method: 'GET',
    endpoint: `/2/users/by/username/${encodeURIComponent(acct.username)}`,
    details: `digest: resolve @${acct.username}`,
    costUsdOverride: 0.005,
    extractJsonPaths: ['data.id', 'data.username'],
  });

  meta.endpoints.push(`GET /2/users/by/username/${acct.username}`);
  if (!lookup.ok && lookup.blocked) {
    meta.statusCodes.push('blocked_by_budget');
    meta.skipped += 1;
    appendDigest(meta, acct, []);
    writeJsonAtomic(STATE_PATH, { nextIndex });
    return;
  }

  meta.statusCodes.push(lookup.status);
  if (lookup.status !== 200) {
    meta.skipped += 1;
    appendDigest(meta, acct, []);
    writeJsonAtomic(STATE_PATH, { nextIndex });
    return;
  }

  const userId = lookup.extracted?.['data.id'];
  const resolvedUsername = lookup.extracted?.['data.username'] || acct.username;
  if (!userId) {
    meta.skipped += 1;
    appendDigest(meta, acct, []);
    writeJsonAtomic(STATE_PATH, { nextIndex });
    return;
  }

  // Step B: fetch recent tweets (cap small; we will store only excerpts + ids)
  // NOTE: costs are conservative; keep call count low.
  const tweets = await xCall({
    actionType: 'lookup',
    method: 'GET',
    // Restrict to this user only; avoid RT/replies via API params and local filters.
    endpoint: `/2/users/${userId}/tweets?max_results=25&exclude=retweets,replies&tweet.fields=created_at,author_id`,
    details: `digest: recent tweets for @${resolvedUsername}`,
    costUsdOverride: 0.005,
    extractJsonPaths: ['data'],
  });

  meta.endpoints.push(`GET /2/users/${userId}/tweets`);
  if (!tweets.ok && tweets.blocked) {
    meta.statusCodes.push('blocked_by_budget');
    meta.skipped += 1;
    appendDigest(meta, acct, []);
    writeJsonAtomic(STATE_PATH, { nextIndex });
    return;
  }

  meta.statusCodes.push(tweets.status);

  const items = Array.isArray(tweets.extracted?.data) ? tweets.extracted.data : [];

  const DEVOPS_KEYWORDS = [
    'openclaw',
    'automation',
    'tool',
    'tools',
    'workflow',
    'ops',
    'devops',
    'deploy',
    'deployment',
    'incident',
    'postmortem',
    'debug',
    'perf',
    'performance',
    'latency',
    'security',
    'vuln',
    'ci',
    'tests',
    'github',
    'cloudflare',
    'vercel',
    'remix',
    'react',
    'shopify',
    'hydrogen',
  ];

  function isDevOps(text) {
    const s = String(text || '').toLowerCase();
    return DEVOPS_KEYWORDS.some((k) => s.includes(k));
  }

  function isExcludedTweet(t) {
    const text = String(t?.text || '').trim();
    if (!text) return true;
    // Block RT/quote chains
    if (text.startsWith('RT') || text.includes('RT @')) return true;
    // Skip replies
    if (text.startsWith('@')) return true;
    // If author_id isn't the resolved user, skip
    if (t?.author_id && String(t.author_id) !== String(userId)) return true;
    // Off-topic filter
    if (!isDevOps(text)) return true;
    return false;
  }

  const filtered = [];
  for (const t of items) {
    if (filtered.length >= 25) break;
    if (isExcludedTweet(t)) {
      meta.skipped += 1;
      continue;
    }
    filtered.push({
      id: t.id,
      excerpt: excerpt(t.text, 160),
      url: tweetUrl(resolvedUsername, t.id),
    });
  }

  meta.ingested = filtered.length;
  appendDigest(meta, { username: resolvedUsername, userId }, filtered);

  writeJsonAtomic(STATE_PATH, { nextIndex });
}

function appendDigest(meta, acct, tweets) {
  const lines = [];
  lines.push(`\n## ${meta.ts_phoenix} (America/Phoenix) — x_digest`);
  lines.push('');
  lines.push('Run metadata:');
  lines.push(`- ts_utc: ${new Date().toISOString()}`);
  lines.push(`- account: @${acct.username}`);
  if (acct.userId) lines.push(`- user_id: ${acct.userId}`);
  lines.push(`- allowlist: OpenAI, Shopify, remix_run, reactjs, vercel, CloudflareDev, github, PostHog`);
  lines.push(`- endpoints: ${meta.endpoints.join(' | ') || '(none)'}`);
  lines.push(`- status_codes: ${meta.statusCodes.join(' | ') || '(none)'}`);
  lines.push(`- ingested: ${meta.ingested}`);
  lines.push(`- skipped: ${meta.skipped}`);
  lines.push('');

  lines.push('What we’re doing together:');
  lines.push('- Wiring X into OpenClaw safely: x_call wrapper + budget cap + queue-on-block.');
  lines.push('- Running digest + post jobs via systemd timers (read + optional post).');
  lines.push('');

  lines.push('What I learned from X (dev/ops only):');
  if (!tweets.length) {
    lines.push('- (no dev/ops items ingested this run)');
  } else {
    const bullets = tweets.slice(0, 7).map((t) => `- ${t.excerpt}`);
    lines.push(...bullets);
  }
  lines.push('');

  lines.push('What I want to learn next (dev/ops):');
  lines.push('- Tighten filters so only original dev/ops signal makes it into digests');
  lines.push('- Keep X reads/posts within budget automatically, with clear queues when blocked');
  lines.push('- Turn digest learnings into small, shippable automation tasks');
  lines.push('');

  lines.push('Items (excerpts + links):');
  if (!tweets.length) {
    lines.push('- (none)');
  } else {
    for (const t of tweets) {
      lines.push(`- ${t.id}${t.url ? ` — ${t.url}` : ''} — ${t.excerpt}`);
    }
  }

  fs.appendFileSync(LOG_PATH, lines.join('\n') + '\n');
}

main().catch(() => process.exit(1));
