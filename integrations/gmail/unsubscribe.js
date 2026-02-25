#!/usr/bin/env node
/**
 * Unsubscribe helper for Gmail senders.
 *
 * Strategy:
 *  - For each sender email address provided, search for recent messages with List-Unsubscribe.
 *  - Extract List-Unsubscribe + List-Unsubscribe-Post headers.
 *  - Prefer one-click POST when indicated; else GET https links; else mailto.
 *
 * Usage:
 *  node unsubscribe.js --creds ... --token ... --senders a@b.com,b@c.com [--maxPerSender 3]
 */

const https = require('https');
const { URL } = require('url');
const querystring = require('querystring');
const { google } = require('googleapis');
const {
  loadOAuthClient,
  pickHeaders,
  extractUnsubTargets,
  normalizeFrom,
  extractEmailAddress,
} = require('./lib');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function parseCsv(x) {
  return (x || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function httpRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'User-Agent': 'OpenClaw-Bort/1.0 (unsubscribe helper)',
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data.slice(0, 5000) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseMailto(mailtoUrl) {
  // mailto:addr?subject=...&body=...
  const u = new URL(mailtoUrl);
  const to = decodeURIComponent(u.pathname || '').replace(/^\/+/, '');
  const q = querystring.parse(u.search.replace(/^\?/, ''));
  return {
    to,
    subject: q.subject ? String(q.subject) : '',
    body: q.body ? String(q.body) : '',
  };
}

function makeRawEmail({ to, subject, body }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject || 'Unsubscribe'}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body || '',
  ];
  const msg = lines.join('\r\n');
  return Buffer.from(msg, 'utf8').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

(async () => {
  const credsPath = arg('creds');
  const tokenPath = arg('token');
  const senders = parseCsv(arg('senders'));
  const maxPerSender = parseInt(arg('maxPerSender', '2'), 10);

  if (!credsPath || !tokenPath || !senders.length) {
    console.error('Usage: node unsubscribe.js --creds /path/credentials.json --token /path/token.json --senders a@b.com,b@c.com');
    process.exit(2);
  }

  const auth = loadOAuthClient({ credsPath, tokenPath });
  const gmail = google.gmail({ version: 'v1', auth });

  const results = [];

  for (const sender of senders) {
    const r = { sender, attempts: [], ok: false };

    // Search recent messages from sender in any mailbox.
    const q = `from:${sender} newer_than:90d`;
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: maxPerSender });
    const msgs = list.data.messages || [];

    for (const m of msgs) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From','Subject','List-Unsubscribe','List-Unsubscribe-Post'],
      });
      const hdr = pickHeaders(full.data.payload);
      const fromEmail = extractEmailAddress(hdr.from);
      if (fromEmail.toLowerCase() !== sender.toLowerCase()) continue;

      const unsubTargets = extractUnsubTargets(hdr.listUnsubscribe);
      const oneClick = (hdr.listUnsubscribePost || '').toLowerCase().includes('list-unsubscribe=one-click');

      // Prefer https
      const httpsTargets = unsubTargets.filter((u) => u.startsWith('https://'));
      const mailtoTargets = unsubTargets.filter((u) => u.startsWith('mailto:'));

      if (oneClick && httpsTargets.length) {
        // RFC 8058: POST with List-Unsubscribe=One-Click
        const url = httpsTargets[0];
        const body = 'List-Unsubscribe=One-Click';
        try {
          const resp = await httpRequest(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(body),
            },
            body,
          });
          r.attempts.push({ kind: 'oneclick-post', url, status: resp.status });
          if (resp.status && resp.status >= 200 && resp.status < 400) { r.ok = true; break; }
        } catch (err) {
          r.attempts.push({ kind: 'oneclick-post-error', url, error: String(err?.code || err?.message || err) });
        }
      }

      if (httpsTargets.length) {
        const url = httpsTargets[0];
        try {
          const resp = await httpRequest(url, { method: 'GET' });
          r.attempts.push({ kind: 'get', url, status: resp.status });
          if (resp.status && resp.status >= 200 && resp.status < 400) { r.ok = true; break; }
        } catch (err) {
          r.attempts.push({ kind: 'get-error', url, error: String(err?.code || err?.message || err) });
        }
      }

      if (mailtoTargets.length) {
        const { to, subject, body } = parseMailto(mailtoTargets[0]);
        const raw = makeRawEmail({ to, subject, body });
        const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        r.attempts.push({ kind: 'mailto-send', to, subject, messageId: sent.data.id });
        r.ok = true;
        break;
      }

      r.attempts.push({ kind: 'no-unsub-header', messageId: m.id });
    }

    results.push(r);
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
})().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
