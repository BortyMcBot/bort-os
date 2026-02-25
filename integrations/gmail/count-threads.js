#!/usr/bin/env node

// Count threads for a given Gmail search query by paging until exhausted.
// Outputs JSON: { query, threadCount, pages, elapsedMs }

const { google } = require('googleapis');
const fs = require('fs');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

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

async function main() {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const q = arg('q');
  const pageSize = Number(arg('pageSize', '500'));

  if (!credsPath || !tokenPath || !q) {
    console.error('Usage: count-threads.js --creds <path> --token <path> --q <query> [--pageSize 500]');
    process.exit(2);
  }

  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const { client_secret, client_id, redirect_uris } = creds.installed || creds.web || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const started = Date.now();
  let pageToken = undefined;
  let total = 0;
  let pages = 0;

  while (true) {
    const res = await withBackoff(() =>
      gmail.users.threads.list({
        userId: 'me',
        q,
        maxResults: pageSize,
        pageToken,
        includeSpamTrash: false,
      })
    );

    const threads = res?.data?.threads || [];
    total += threads.length;
    pages += 1;

    pageToken = res?.data?.nextPageToken;
    if (!pageToken) break;
  }

  const out = { query: q, threadCount: total, pages, elapsedMs: Date.now() - started };
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  const status = e?.code || e?.response?.status;
  console.error('ERROR', status || '', e?.message || e);
  process.exit(1);
});
