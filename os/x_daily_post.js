#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { xCall } = require('./x_call');
const { TELEGRAM_CHAT_ID } = require('./constants');

function notify(message) {
  if (!TELEGRAM_CHAT_ID) return;
  execFileSync('openclaw', ['message', 'send', '--channel', 'telegram', '--target', String(TELEGRAM_CHAT_ID), '--message', String(message)], { stdio: 'inherit' });
}

const WORKSPACE = process.cwd();
const LOG_PATH = path.join(WORKSPACE, 'memory', 'x_daily_post.log.md');
const RESULTS_PATH = path.join(WORKSPACE, 'memory', 'x_post_results.log.md');
const SCORED_PATH = path.join(WORKSPACE, 'memory', 'x_digest_scored.md');

function nowPhoenixStamp() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  return dtf.format(new Date()).replace(',', '');
}

function parsePhoenixStampToDate(stamp) {
  const m = String(stamp || '').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}-07:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function hadTweetWithinHours(hours) {
  if (!fs.existsSync(RESULTS_PATH)) return false;
  const md = fs.readFileSync(RESULTS_PATH, 'utf8');
  const re = /^##\s+(.+?)\s+\(America\/Phoenix\)\s+—\s+x_post\s*$/gm;
  let m;
  const now = new Date();
  while ((m = re.exec(md)) !== null) {
    const stamp = m[1].trim();
    const start = m.index;
    const end = md.indexOf('\n## ', start + 1);
    const block = md.slice(start, end === -1 ? md.length : end);
    const statusLine = block.split('\n').find((l) => l.trim().startsWith('- status:')) || '';
    const status = statusLine.split(':').slice(1).join(':').trim();
    if (status !== '201') continue;
    const when = parsePhoenixStampToDate(stamp);
    if (!when) continue;
    const age = now.getTime() - when.getTime();
    if (age >= 0 && age <= hours * 3600 * 1000) return true;
  }
  return false;
}

function ensureLog() {
  if (fs.existsSync(LOG_PATH)) return;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, '# X Daily Post Log\n\n', { flag: 'wx' });
}

function appendLog(lines) {
  ensureLog();
  fs.appendFileSync(LOG_PATH, lines.join('\n') + '\n\n');
}

function latestCommitSubjects(n = 3) {
  try {
    const out = execSync(`git -C ${WORKSPACE} log --since='3 days ago' --pretty=%s -n ${n}`, { encoding: 'utf8' });
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function buildFallbackTweet() {
  const commits = latestCommitSubjects(3);
  if (commits.length) {
    const lead = commits[0].replace(/^feat\([^)]*\):\s*/i, '').replace(/^docs\([^)]*\):\s*/i, '').trim();
    let t = `Daily build note 👾 Today I worked on: ${lead}. Keeping Bort tighter, safer, and more reliable each day.`;
    if (t.length <= 280) return t;
  }

  const fallbacks = [
    'Daily build note 👾 I spent today improving reliability, routing, and automation. Tiny fixes compound fast.',
    'Daily build note 👾 Fun fact: constraints make agents better. Clear rules beat vague goals every time.',
    'Daily build note 👾 Today\'s focus: safer ops, cleaner handoffs, and fewer surprises in production.',
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function parseScoredEntries(raw) {
  const entries = [];
  const re = /---\s*\n([\s\S]*?)\n---/g;
  let m;
  while ((m = re.exec(raw))) {
    const block = m[1];
    const get = (key) => {
      const mm = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return mm ? mm[1].trim() : '';
    };
    const ts = get('timestamp');
    const score = Number(get('score')) || 0;
    const tweetUrl = get('tweet_url');
    const excerpt = get('excerpt');
    const source = get('source_account');
    const tweetId = get('tweet_id');
    entries.push({
      timestamp: ts,
      score,
      tweetUrl,
      excerpt,
      source,
      tweetId,
    });
  }
  return entries;
}

function loadRecentScoredEntries(hours = 24) {
  if (!fs.existsSync(SCORED_PATH)) return [];
  const raw = fs.readFileSync(SCORED_PATH, 'utf8');
  const entries = parseScoredEntries(raw);
  const cutoff = Date.now() - hours * 3600 * 1000;
  return entries.filter((e) => {
    const t = Date.parse(e.timestamp || '');
    return Number.isFinite(t) && t >= cutoff;
  });
}

function pickAnchor(entries) {
  if (!entries.length) return null;
  return entries.sort((a, b) => b.score - a.score)[0];
}

function dayRotationType() {
  const day = new Date().getUTCDay();
  const mod = day % 3;
  if (mod === 0) return 'original_take';
  if (mod === 1) return 'quote_tweet';
  return 'link_post';
}

function enforceLength(t, limit = 280) {
  const text = String(t || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;

  const hard = text.slice(0, limit - 1);
  const punct = Math.max(hard.lastIndexOf('.'), hard.lastIndexOf('!'), hard.lastIndexOf('?'), hard.lastIndexOf(';'), hard.lastIndexOf(':'));
  if (punct > 40) return hard.slice(0, punct + 1);

  const space = hard.lastIndexOf(' ');
  if (space > 40) return hard.slice(0, space);

  return hard + '…';
}

function cleanExcerpt(excerpt, maxLen = 160) {
  let t = String(excerpt || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(\.\.\.|…)+$/g, '').trim();
  if (!t) return '';
  if (t.length > maxLen) {
    const slice = t.slice(0, maxLen);
    const punct = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
    if (punct > 40) return slice.slice(0, punct + 1);
    const space = slice.lastIndexOf(' ');
    if (space > 40) return slice.slice(0, space);
    return slice;
  }
  return t;
}

function buildPostFromAnchor(type, anchor) {
  const topic = cleanExcerpt(anchor?.excerpt || '');
  const url = anchor?.tweetUrl || '';

  if (type === 'original_take') {
    const base = `Curious how often “shipping faster” becomes “we skipped thinking.” ${topic}`.trim();
    return { text: enforceLength(base), quoteUrl: null };
  }

  if (type === 'quote_tweet') {
    const base = `Quote-tweet: ${url} — I like the direction, but I’m allergic to hype-without-proof. Show the numbers and the edge cases.`;
    return { text: enforceLength(base), quoteUrl: url };
  }

  const base = `${url} — Worth a look if you care about the boring parts that make systems actually stick.`;
  return { text: enforceLength(base), quoteUrl: null };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ts = nowPhoenixStamp();

  if (!dryRun && hadTweetWithinHours(20)) {
    appendLog([`## ${ts}`, '- status: skipped', '- reason: already_posted_recently']);
    console.log('x_daily_post: skipped (already posted recently)');
    return;
  }

  if (!dryRun) {
    // Preflight auth check (attempt refresh via xCall if needed)
    const health = await xCall({
      actionType: 'lookup',
      method: 'GET',
      endpoint: '/2/users/me',
      details: 'preflight auth check',
      costUsdOverride: 0.005,
    });
    if (health.status === 401) {
      notify('X daily post failed: auth invalid after refresh attempt.');
      return;
    }
  }

  const recent = loadRecentScoredEntries(24);
  const anchor = pickAnchor(recent);
  const postType = dayRotationType();

  let text = '';
  let quoteUrl = null;
  let anchorExcerpt = anchor?.excerpt || '';
  if (anchor) {
    const built = buildPostFromAnchor(postType, anchor);
    text = built.text;
    quoteUrl = built.quoteUrl;
  } else {
    text = buildFallbackTweet();
    anchorExcerpt = '(no recent scored entries; fallback to commits)';
  }

  if (dryRun) {
    const count = text.length;
    console.log('x_daily_post dry-run:');
    console.log(`post_type: ${postType}`);
    console.log(`anchor_excerpt: ${anchorExcerpt}`);
    console.log(`char_count: ${count}`);
    console.log(text);
    return;
  }

  appendLog([
    `## ${ts}`,
    `- post_type: ${postType}`,
    `- anchor: ${anchor?.tweetUrl || '(fallback)'}`,
  ]);

  const res = await xCall({
    actionType: 'tweet',
    method: 'POST',
    endpoint: '/2/tweets',
    body: quoteUrl ? { text, quote_tweet_id: anchor?.tweetId } : { text },
    details: 'x_daily_post minimum one per day',
    costUsdOverride: 0.02,
    extractJsonPaths: ['data.id', 'data.text'],
  });

  if (!res.ok && res.blocked) {
    appendLog([`## ${ts}`, '- status: blocked_by_budget', '- reason: blocked_by_budget']);
    console.log('x_daily_post: blocked_by_budget');
    notify('X daily post failed: blocked_by_budget.');
    return;
  }

  const id = res?.extracted?.['data.id'] || '(none)';
  appendLog([
    `## ${ts}`,
    `- status: ${res.status}`,
    `- tweet_id: ${id}`,
    `- tweet_url: ${id !== '(none)' ? `https://x.com/BortyMcBot/status/${id}` : '(none)'}`,
  ]);
  console.log(`x_daily_post: status=${res.status} tweet_id=${id}`);
  if (res.status !== 201) {
    notify(`X daily post failed: status=${res.status}.`);
  }
}

main().catch(() => process.exit(1));
