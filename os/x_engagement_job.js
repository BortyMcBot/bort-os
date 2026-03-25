#!/usr/bin/env node

// X engagement snapshot (read-only)
// - Estimated API calls/day: 1 GET per tweet posted in last 7 days (typically ~7 calls/day)
// - Purpose: capture metrics for Bryan to review and manually update BORT_INTERESTS.md "## What has landed"
// - This job does NOT auto-update any config

const fs = require('fs');
const path = require('path');
const { xCall } = require('./x_call');

const WORKSPACE = process.cwd();
const POST_LOG_PATH = path.join(WORKSPACE, 'memory', 'x_daily_post.log.md');
const POST_RESULTS_STATE_PATH = path.join(WORKSPACE, 'memory', 'x_post_results.json');
const ENGAGEMENT_LOG_PATH = path.join(WORKSPACE, 'memory', 'x_engagement.log.md');

function parsePhoenixStampToDate(stamp) {
  const m = String(stamp || '').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}-07:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parsePostLog() {
  if (fs.existsSync(POST_RESULTS_STATE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(POST_RESULTS_STATE_PATH, 'utf8'));
      if (Array.isArray(raw)) {
        return raw
          .filter((e) => e && e.status === '201' && e.tweetId)
          .map((e) => ({ stamp: e.stamp, tweetId: String(e.tweetId), postType: e.postType || 'unknown' }));
      }
    } catch {
      // fall back to legacy markdown parsing below
    }
  }

  if (!fs.existsSync(POST_LOG_PATH)) return [];
  const raw = fs.readFileSync(POST_LOG_PATH, 'utf8');
  const blocks = raw.split(/^##\s+/m).slice(1);
  const entries = [];
  const postTypeByStamp = {};

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const stamp = lines[0]?.trim();
    if (!stamp) continue;

    let status = '';
    let tweetId = '';
    let postType = '';

    for (const line of lines.slice(1)) {
      const l = line.trim();
      if (l.startsWith('- status:')) status = l.split(':').slice(1).join(':').trim();
      if (l.startsWith('- tweet_id:')) tweetId = l.split(':').slice(1).join(':').trim();
      if (l.startsWith('- post_type:')) postType = l.split(':').slice(1).join(':').trim();
    }

    if (postType) postTypeByStamp[stamp] = postType;
    if (status === '201' && tweetId && tweetId !== '(none)') {
      entries.push({ stamp, tweetId, postType: postType || postTypeByStamp[stamp] || 'unknown' });
    }
  }

  return entries;
}

function loadRecentTweetIds(hours = 24 * 7) {
  const entries = parsePostLog();
  const cutoff = Date.now() - hours * 3600 * 1000;
  return entries.filter((e) => {
    const t = parsePhoenixStampToDate(e.stamp);
    return t && t.getTime() >= cutoff;
  });
}

function parseEngagementEntries(raw) {
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

function pruneAndWrite(newEntries) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const existingRaw = fs.existsSync(ENGAGEMENT_LOG_PATH) ? fs.readFileSync(ENGAGEMENT_LOG_PATH, 'utf8') : '';
  const existing = parseEngagementEntries(existingRaw).filter((e) => e.ts && e.ts >= cutoff);
  const out = [...existing, ...newEntries].map((e) => e.raw).join('\n\n');
  fs.mkdirSync(path.dirname(ENGAGEMENT_LOG_PATH), { recursive: true });
  fs.writeFileSync(ENGAGEMENT_LOG_PATH, out + (out ? '\n' : ''));
}

function excerptText(text, n = 100) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n);
}

async function main() {
  const recent = loadRecentTweetIds(24 * 7);
  if (!recent.length) {
    pruneAndWrite([]);
    return;
  }

  const newEntries = [];

  for (const item of recent) {
    const res = await xCall({
      actionType: 'lookup',
      method: 'GET',
      endpoint: `/2/tweets/${item.tweetId}?tweet.fields=public_metrics,text`,
      details: `engagement snapshot for ${item.tweetId}`,
      costUsdOverride: 0.005,
      extractJsonPaths: [
        'data.public_metrics.impression_count',
        'data.public_metrics.like_count',
        'data.public_metrics.retweet_count',
        'data.public_metrics.reply_count',
        'data.text',
      ],
    });

    if (!res.ok && res.blocked) continue;

    const metrics = res.extracted || {};
    const impressions = Number(metrics['data.public_metrics.impression_count'] || 0);
    const likes = Number(metrics['data.public_metrics.like_count'] || 0);
    const retweets = Number(metrics['data.public_metrics.retweet_count'] || 0);
    const replies = Number(metrics['data.public_metrics.reply_count'] || 0);
    const text = metrics['data.text'] || '';

    const block = [
      '---',
      `timestamp: ${new Date().toISOString()}`,
      `tweet_id: ${item.tweetId}`,
      `post_type: ${item.postType || 'unknown'}`,
      `excerpt: ${excerptText(text, 100)}`,
      'metrics:',
      `  impressions: ${impressions}`,
      `  likes: ${likes}`,
      `  retweets: ${retweets}`,
      `  replies: ${replies}`,
      '---',
    ].join('\n');

    newEntries.push({ raw: block, ts: Date.now() });
  }

  pruneAndWrite(newEntries);
}

main().catch(() => process.exit(1));
