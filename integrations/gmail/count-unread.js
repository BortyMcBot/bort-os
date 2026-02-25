#!/usr/bin/env node
// Count unread inbox threads accurately by paging.

const { google } = require('googleapis');
const { loadOAuthClient } = require('./lib');

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
    const res = await gmail.users.threads.list({ userId: 'me', q, maxResults: 500, pageToken });
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
