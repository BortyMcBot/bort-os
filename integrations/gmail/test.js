#!/usr/bin/env node
/**
 * Quick sanity test: load token, hit Gmail profile, list a few inbox threads.
 *
 * Usage:
 *   node test.js --email you@gmail.com [--creds credentials.json] [--token token.json]
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const email = arg('email');
if (!email) {
  console.error('Missing --email');
  process.exit(2);
}

const credsPath = arg('creds', path.join(__dirname, 'credentials.json'));
const tokenPath = arg('token', path.join(__dirname, 'token.json'));

if (!fs.existsSync(credsPath)) throw new Error(`Missing ${credsPath}`);
if (!fs.existsSync(tokenPath)) throw new Error(`Missing ${tokenPath}`);

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const { client_secret, client_id, redirect_uris } = creds.installed || creds.web || {};

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));

(async () => {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log('Gmail profile:', profile.data.emailAddress, 'threads:', profile.data.threadsTotal, 'messages:', profile.data.messagesTotal);

  const list = await gmail.users.threads.list({
    userId: 'me',
    q: 'in:inbox',
    maxResults: 5,
  });

  const threads = list.data.threads || [];
  console.log(`\nTop ${threads.length} threads in inbox:`);
  for (const t of threads) {
    console.log('-', t.id);
  }

  console.log('\nOK');
})().catch((err) => {
  console.error(err?.response?.data || err);
  process.exit(1);
});
