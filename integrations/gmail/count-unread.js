#!/usr/bin/env node
// Count unread inbox threads accurately by paging.

const { google } = require('googleapis');
const { loadOAuthClient } = require('./lib');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBackoff(fn, { maxRetries = 6, baseMs = 750, maxMs = 15000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.code || e?.response?.status;
      const msg = String(e?.message || '');
      const isRate = status === 429 || /rate|quota|userRateLimitExceeded|resource exhausted/i.test(msg);
      if (!isRate || attempt >= maxRetries) throw e;
      const wait = Math.min(maxMs, baseMs * Math.pow(2, attempt));
      await sleep(wait);
      attempt++;
    }
  }
}

(async () => {
  const credsPath = process.env.GMAIL_CREDS;
  const tokenPath = process.env.GMAIL_TOKEN;
  const q = process.env.GMAIL_QUERY || 'in:inbox is:unread';

  if (!credsPath || !tokenPath) {
    console.error('Missing env GMAIL_CREDS / GMAIL_TOKEN');
    process.exit(2);
  }

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  let pageToken;
  let total = 0;
  let pages = 0;
  while (true) {
    const res = await withBackoff(() => gmail.users.threads.list({ userId: 'me', q, maxResults: 500, pageToken }));
    total += (res.data.threads || []).length;
    pageToken = res.data.nextPageToken;
    pages += 1;
    if (!pageToken) break;
  }

  console.log(JSON.stringify({ ok: true, q, total, pages }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
