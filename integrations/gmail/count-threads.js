#!/usr/bin/env node

// Count threads for a given Gmail search query by paging until exhausted.
// Outputs JSON: { query, threadCount, pages, elapsedMs }

const { google } = require('googleapis');
const { loadOAuthClient, withBackoff } = require('./lib');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
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

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

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
