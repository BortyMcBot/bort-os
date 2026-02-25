const fs = require('fs');
const { google } = require('googleapis');

function loadOAuthClient({ credsPath, tokenPath }) {
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const { client_secret, client_id, redirect_uris } = creds.installed || creds.web || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

async function getOrCreateLabel(gmail, name) {
  const list = await gmail.users.labels.list({ userId: 'me' });
  const found = (list.data.labels || []).find((l) => l.name === name);
  if (found) return found;
  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      type: 'user',
    },
  });
  return created.data;
}

function pickHeaders(payload) {
  const headers = payload?.headers || [];
  const get = (n) => headers.find((h) => h.name?.toLowerCase() === n)?.value || '';
  return {
    from: get('from'),
    to: get('to'),
    subject: get('subject'),
    date: get('date'),
    listUnsubscribe: get('list-unsubscribe'),
    listUnsubscribePost: get('list-unsubscribe-post'),
  };
}

function extractUnsubTargets(listUnsubscribe) {
  // list-unsubscribe header may look like: <mailto:...>, <https://...>
  const out = [];
  if (!listUnsubscribe) return out;
  const parts = listUnsubscribe.split(',').map((s) => s.trim());
  for (const p of parts) {
    const m = p.match(/<([^>]+)>/);
    const v = (m ? m[1] : p).trim();
    if (v) out.push(v);
  }
  return out;
}

function normalizeFrom(from) {
  return (from || '').replace(/\s+/g, ' ').trim();
}

function extractEmailAddress(from) {
  // Examples:
  //  - "Name" <user@example.com>
  //  - user@example.com
  const s = (from || '').trim();
  const m = s.match(/<([^>]+)>/);
  const addr = (m ? m[1] : s).trim();
  return addr.replace(/^"|"$/g, '');
}

module.exports = {
  loadOAuthClient,
  getOrCreateLabel,
  pickHeaders,
  extractUnsubTargets,
  normalizeFrom,
  extractEmailAddress,
};
