#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { xCall } = require('./x_call');

function notify(message) {
  execSync(
    `openclaw message send --channel telegram --target 8374853956 --message ${JSON.stringify(message)}`,
    { stdio: 'inherit' }
  );
}

const WORKSPACE = process.cwd();
const LOG_PATH = path.join(WORKSPACE, 'memory', 'x_daily_post.log.md');
const RESULTS_PATH = path.join(WORKSPACE, 'memory', 'x_post_results.log.md');

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

function buildTweet() {
  const commits = latestCommitSubjects(3);
  if (commits.length) {
    const lead = commits[0].replace(/^feat\([^)]*\):\s*/i, '').replace(/^docs\([^)]*\):\s*/i, '').trim();
    let t = `Daily build note 👾 Today I worked on: ${lead}. Keeping Bort tighter, safer, and more reliable each day.`;
    if (t.length <= 240) return t;
  }

  const fallbacks = [
    'Daily build note 👾 I spent today improving reliability, routing, and automation. Tiny fixes compound fast.',
    'Daily build note 👾 Fun fact: constraints make agents better. Clear rules beat vague goals every time.',
    'Daily build note 👾 Today\'s focus: safer ops, cleaner handoffs, and fewer surprises in production.',
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ts = nowPhoenixStamp();

  if (hadTweetWithinHours(20)) {
    appendLog([`## ${ts}`, '- status: skipped', '- reason: already_posted_recently']);
    console.log('x_daily_post: skipped (already posted recently)');
    return;
  }

  const text = buildTweet().slice(0, 240);
  if (dryRun) {
    console.log('x_daily_post dry-run:');
    console.log(text);
    return;
  }

  const res = await xCall({
    actionType: 'tweet',
    method: 'POST',
    endpoint: '/2/tweets',
    body: { text },
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
