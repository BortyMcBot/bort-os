#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RESULTS_PATH = path.join(process.cwd(), 'memory', 'x_post_results.log.md');
const DAILY_LOG = path.join(process.cwd(), 'memory', 'x_daily_post.log.md');

function parsePhoenixStampToDate(stamp) {
  const m = String(stamp || '').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}-07:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function lastSuccessFromResults() {
  if (!fs.existsSync(RESULTS_PATH)) return null;
  const md = fs.readFileSync(RESULTS_PATH, 'utf8');
  const re = /^##\s+(.+?)\s+\(America\/Phoenix\)\s+—\s+x_post\s*$/gm;
  let m;
  let last = null;
  while ((m = re.exec(md)) !== null) {
    const stamp = m[1].trim();
    const start = m.index;
    const end = md.indexOf('\n## ', start + 1);
    const block = md.slice(start, end === -1 ? md.length : end);
    const statusLine = block.split('\n').find((l) => l.trim().startsWith('- status:')) || '';
    const status = statusLine.split(':').slice(1).join(':').trim();
    if (status === '201') {
      const when = parsePhoenixStampToDate(stamp);
      if (when) last = { when, stamp };
    }
  }
  return last;
}

function lastDailyStatus() {
  if (!fs.existsSync(DAILY_LOG)) return null;
  const md = fs.readFileSync(DAILY_LOG, 'utf8');
  const re = /^##\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/gm;
  let m; let last = null;
  while ((m = re.exec(md)) !== null) {
    const stamp = m[1].trim();
    const start = m.index;
    const end = md.indexOf('\n## ', start + 1);
    const block = md.slice(start, end === -1 ? md.length : end);
    const statusLine = block.split('\n').find((l) => l.trim().startsWith('- status:')) || '';
    const status = statusLine.split(':').slice(1).join(':').trim();
    last = { stamp, status };
  }
  return last;
}

function hoursSince(d) {
  return (Date.now() - d.getTime()) / 3600000;
}

function notify(message) {
  execSync(`openclaw message send --channel telegram --target 8374853956 --message ${JSON.stringify(message)}`, { stdio: 'inherit' });
}

function main() {
  const lastSuccess = lastSuccessFromResults();
  const lastDaily = lastDailyStatus();

  const ok = lastSuccess && hoursSince(lastSuccess.when) <= 30;
  if (ok) return;

  const reason = lastDaily ? `last_daily_status=${lastDaily.status}` : 'no_daily_log';
  const msg = `X daily post watchdog: no successful tweet in last 30h. Reason: ${reason}. I can retry auth or run a manual post if you want.`;
  notify(msg);
}

main();
