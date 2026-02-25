#!/usr/bin/env node
/**
 * OAuth bootstrap for Gmail API.
 *
 * Usage:
 *   node auth.js --email you@gmail.com [--creds credentials.json] [--token token.json]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

if (!fs.existsSync(credsPath)) {
  console.error(`Missing credentials file at: ${credsPath}`);
  console.error('Download OAuth Client (Desktop app) JSON from Google Cloud and save as credentials.json');
  process.exit(2);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const { client_secret, client_id, redirect_uris } = creds.installed || creds.web || {};
if (!client_id || !client_secret || !redirect_uris?.length) {
  console.error('credentials.json does not look like a Google OAuth client JSON');
  process.exit(2);
}

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Full modify access so we can label/archive/trash.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  // optional but useful
  'https://www.googleapis.com/auth/userinfo.email',
];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
  // This helps ensure the right account is selected during consent.
  login_hint: email,
});

console.log('\nAuthorize this app by visiting this url:\n');
console.log(authUrl);
console.log('\nAfter approving, paste the code here.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned. Try again with prompt=consent, and ensure you are not reusing an already-authorized client without revoking.');
    }
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    console.log(`\nSaved token to: ${tokenPath}`);
  } catch (err) {
    console.error('Error retrieving access token', err?.response?.data || err);
    process.exit(1);
  }
});
