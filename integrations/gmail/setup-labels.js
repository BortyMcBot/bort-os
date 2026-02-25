#!/usr/bin/env node
/**
 * Create Bort labels if they don't exist.
 */

const { google } = require('googleapis');
const { loadOAuthClient, getOrCreateLabel } = require('./lib');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const credsPath = arg('creds');
const tokenPath = arg('token');
if (!credsPath || !tokenPath) {
  console.error('Usage: node setup-labels.js --creds /path/credentials.json --token /path/token.json');
  process.exit(2);
}

(async () => {
  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const names = ['Bort/Important', 'Bort/Other', 'Bort/Subscription', 'Bort/SpamReview', 'Bort/WaitingOn'];
  const labels = {};
  for (const n of names) {
    const lbl = await getOrCreateLabel(gmail, n);
    labels[n] = lbl.id;
  }
  console.log(JSON.stringify({ ok: true, labels }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
