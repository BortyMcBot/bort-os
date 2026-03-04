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
const SCORED_PATH = path.join(process.cwd(), 'memory', 'x_digest_scored.md');
const INTERESTS_PATH = path.join(process.cwd(), 'project_source', 'BORT_INTERESTS.md');

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

function ensureScoredFile() {
  if (fs.existsSync(SCORED_PATH)) return;
  fs.mkdirSync(path.dirname(SCORED_PATH), { recursive: true });
  fs.writeFileSync(SCORED_PATH, '', { flag: 'wx' });
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

function readInterestsTopics() {
  try {
    const raw = fs.readFileSync(INTERESTS_PATH, 'utf8');
    const lines = raw.split('\n');
    const topics = [];
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        inSection = trimmed.toLowerCase() === '## topic domains';
        continue;
      }
      if (!inSection) continue;
      if (trimmed.startsWith('- ')) {
        const topic = trimmed.slice(2).trim();
        if (topic) topics.push(topic);
      }
    }
    return topics;
  } catch {
    return [];
  }
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTweet(text, topicDomains) {
  const tokens = new Set(tokenize(text));
  let score = 0;
  const matched = [];

  for (const topic of topicDomains) {
    const topicTokens = tokenize(topic);
    let overlap = 0;
    for (const t of topicTokens) {
      if (tokens.has(t)) overlap += 1;
    }
    if (overlap > 0) {
      matched.push(topic);
      score += overlap;
    }
  }

  return { score, matchedTopics: matched };
}

function parseScoredEntries(raw) {
  const entries = [];
  const re = /---\s*\n([\s\S]*?)\n---/g;
  let m;
  while ((m = re.exec(raw))) {
    const block = m[1];
    const tsMatch = block.match(/^timestamp:\s*(.+)$/m);
    const ts = tsMatch ? new Date(tsMatch[1].trim()).getTime() : null;
    entries.push({ raw: `---\n${block}\n---`, ts });
  }
  return entries;
}

function pruneAndWriteScored(newEntries) {
  ensureScoredFile();
  const raw = fs.readFileSync(SCORED_PATH, 'utf8');
  const existing = parseScoredEntries(raw);
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const kept = existing.filter((e) => e.ts && e.ts >= cutoff);
  const merged = [...kept, ...newEntries];
  const out = merged.map((e) => e.raw).join('\n\n');
  fs.writeFileSync(SCORED_PATH, out + (out ? '\n' : ''));
}

function buildScoredEntry({ timestamp, sourceAccount, tweetId, score, matchedTopics, excerptText }) {
  const matched = JSON.stringify(matchedTopics || []);
  const lines = [
    '---',
    `timestamp: ${timestamp}`,
    `source_account: ${sourceAccount}`,
    `tweet_id: ${tweetId}`,
    `tweet_url: https://x.com/${sourceAccount}/status/${tweetId}`,
    `score: ${score}`,
    `matched_topics: ${matched}`,
    `excerpt: ${excerpt(excerptText, 200)}`,
    '---',
  ];
  return lines.join('\n');
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

  const topicDomains = readInterestsTopics();

  const state = safeReadJson(STATE_PATH, { nextIndex: 0 });
  const { acct, nextIndex } = pickAccount(curated, state);

  const meta = {
    ts_phoenix: nowPhoenixStamp(),
    endpoints: [],
    statusCodes: [],
    ingested: 0,
    skipped: 0,
  };

  // Preflight auth check (attempt refresh via xCall if needed)
  const health = await xCall({
    actionType: 'lookup',
    method: 'GET',
    endpoint: '/2/users/me',
    details: 'preflight auth check',
    costUsdOverride: 0.005,
  });
  if (health.status === 401) {
    appendDigest(
      {
        ts_phoenix: nowPhoenixStamp(),
        endpoints: ['/2/users/me'],
        statusCodes: [401],
        ingested: 0,
        skipped: 0,
      },
      acct,
      []
    );
    writeJsonAtomic(STATE_PATH, { nextIndex });
    return;
  }

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

  function isExcludedTweet(t) {
    const text = String(t?.text || '').trim();
    if (!text) return true;
    // Block RT/quote chains
    if (text.startsWith('RT') || text.includes('RT @')) return true;
    // Skip replies
    if (text.startsWith('@')) return true;
    // If author_id isn't the resolved user, skip
    if (t?.author_id && String(t.author_id) !== String(userId)) return true;
    return false;
  }

  const scored = [];
  for (const t of items) {
    if (scored.length >= 25) break;
    if (isExcludedTweet(t)) {
      meta.skipped += 1;
      continue;
    }
    const { score, matchedTopics } = scoreTweet(t.text, topicDomains);
    scored.push({
      id: t.id,
      text: t.text,
      score,
      matchedTopics,
      url: tweetUrl(resolvedUsername, t.id),
    });
  }

  const topScored = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const filtered = topScored.map((t) => ({
    id: t.id,
    excerpt: excerpt(t.text, 160),
    url: t.url,
  }));

  meta.ingested = filtered.length;
  appendDigest(meta, { username: resolvedUsername, userId }, filtered);

  const scoredEntries = topScored.map((t) => ({
    raw: buildScoredEntry({
      timestamp: new Date().toISOString(),
      sourceAccount: resolvedUsername,
      tweetId: t.id,
      score: t.score,
      matchedTopics: t.matchedTopics,
      excerptText: t.text,
    }),
    ts: Date.now(),
  }));

  if (scoredEntries.length) {
    pruneAndWriteScored(scoredEntries);
  } else {
    pruneAndWriteScored([]);
  }

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
