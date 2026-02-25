#!/usr/bin/env node

/*
X (Twitter) OAuth 2.0 Authorization Code Flow with PKCE

Goals:
- Generate PKCE verifier/challenge
- Print authorize URL (safe)
- Start local callback server on 127.0.0.1:8080/oauth/x/callback
- Exchange code -> access token (+ refresh token if provided)
- Persist tokens WITHOUT printing them
- Optional dry-run: call GET https://api.x.com/2/users/me and print status code only

Env vars used (exact):
- X_CLIENT_ID (required)
- X_CLIENT_SECRET (optional; usually not needed for PKCE public clients)
- X_REDIRECT_URI (optional; default http://127.0.0.1:8080/oauth/x/callback)
- X_SCOPES (optional; default: tweet.read tweet.write users.read follows.read follows.write offline.access)
- X_ACCESS_TOKEN (written to /root/.openclaw/openclaw.json env.vars)
- X_REFRESH_TOKEN (written if returned)

IMPORTANT (running on droplet):
- You will likely need SSH port-forwarding so your browser can hit the callback:
  ssh -L 8080:127.0.0.1:8080 root@<droplet>
- Set X_REDIRECT_URI to: http://127.0.0.1:8080/oauth/x/callback
  and register that redirect URI in the X developer app settings.
*/

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const fs = require('fs');

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const ME_URL = 'https://api.x.com/2/users/me';

function loadOpenClawEnvVars() {
  // Read OpenClaw config env store (no printing).
  const p = '/root/.openclaw/openclaw.json';
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = JSON.parse(raw);
    const vars = cfg?.env?.vars;
    return vars && typeof vars === 'object' ? vars : {};
  } catch {
    return {};
  }
}

// Merge env with precedence: process.env overrides config env.vars
const mergedEnv = { ...loadOpenClawEnvVars(), ...process.env };

function mustEnv(name) {
  const v = mergedEnv[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(2);
  }
  return v;
}

function env(name, fallback) {
  const v = mergedEnv[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest();
}

function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(sha256(verifier));
  return { verifier, challenge, method: 'S256' };
}

function nowIso() {
  return new Date().toISOString();
}

function redact(s) {
  if (!s) return '';
  return '[REDACTED]';
}

function updateOpenClawEnvVars(patch) {
  // Writes tokens into /root/.openclaw/openclaw.json env.vars without printing them.
  const p = '/root/.openclaw/openclaw.json';
  const raw = fs.readFileSync(p, 'utf8');
  const cfg = JSON.parse(raw);
  cfg.env = cfg.env || {};
  cfg.env.vars = cfg.env.vars || {};

  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    cfg.env.vars[k] = String(v);
  }

  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

async function httpPostForm(url, formObj, basicAuth) {
  const body = new URLSearchParams(formObj).toString();
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': Buffer.byteLength(body),
  };
  if (basicAuth) headers.authorization = basicAuth;

  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text();
  return { status: res.status, text };
}

async function httpGetStatus(url, bearerToken) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${bearerToken}`,
    },
  });
  return res.status;
}

function normalizeEndpointFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return String(url);
  }
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--no-server') out.noServer = true;
  }
  return out;
}

function startCallbackServer({ expectedState }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/oauth/x/callback') {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('Not found');
          return;
        }

        const state = u.searchParams.get('state');
        const code = u.searchParams.get('code');
        const err = u.searchParams.get('error');

        if (err) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end('Auth error received. You can close this tab.');
          resolve({ ok: false, error: err });
          server.close();
          return;
        }

        if (!code) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end('Missing code. You can close this tab.');
          resolve({ ok: false, error: 'missing_code' });
          server.close();
          return;
        }

        if (!state || state !== expectedState) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end('State mismatch. You can close this tab.');
          resolve({ ok: false, error: 'state_mismatch' });
          server.close();
          return;
        }

        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('Auth received. You can close this tab.');
        resolve({ ok: true, code });
        server.close();
      } catch (e) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Server error.');
        resolve({ ok: false, error: 'server_error' });
        server.close();
      }
    });

    server.on('error', reject);
    server.listen(8080, '127.0.0.1', () => {
      // server ready
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);

  // DRY RUN: status-only check using stored access token; do not start OAuth flow.
  if (args.dryRun === true) {
    const accessToken = mustEnv('X_ACCESS_TOKEN');

    // Budget guard (must run before every X API call)
    const xb = require('./x_budget');
    xb.ensureLedgerFile();
    xb.ensureQueueFile();

    const endpoint = normalizeEndpointFromUrl(ME_URL);
    const gate = xb.guardOrQueue({
      actionType: 'lookup',
      method: 'GET',
      endpoint,
      details: 'dry-run users/me status check',
    });

    if (!gate.ok) {
      console.log('dry_run_status: blocked_by_budget');
      process.exit(1);
    }

    const status = await httpGetStatus(ME_URL, accessToken);
    // Record spend regardless of status code (we made the call).
    xb.recordSpend({
      amount: gate.estimateUsd,
      metadata: { actionType: 'lookup', method: 'GET', endpoint },
    });

    console.log(`dry_run_status: ${status}`);
    process.exit(status === 200 ? 0 : 1);
  }

  // Safe debug: presence only (no values)
  console.log('env_presence:');
  console.log(`- X_CLIENT_ID: ${mergedEnv.X_CLIENT_ID ? 'yes' : 'no'}`);
  console.log(`- X_REDIRECT_URI: ${mergedEnv.X_REDIRECT_URI ? 'yes' : 'no'}`);
  console.log(`- X_SCOPES: ${mergedEnv.X_SCOPES ? 'yes' : 'no'}`);
  console.log(`- X_CLIENT_SECRET: ${mergedEnv.X_CLIENT_SECRET ? 'yes' : 'no'}`);
  console.log('');

  const clientId = mustEnv('X_CLIENT_ID');
  const clientSecret = mergedEnv.X_CLIENT_SECRET || null;

  const redirectUri = env('X_REDIRECT_URI', 'http://127.0.0.1:8080/oauth/x/callback');
  const scopes = env(
    'X_SCOPES',
    'tweet.read tweet.write users.read follows.read follows.write offline.access'
  );

  const { verifier, challenge, method } = generatePkce();
  const state = base64url(crypto.randomBytes(16));

  const authorize = new URL(AUTH_URL);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', scopes);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', method);

  console.log('x_auth');
  console.log('');
  console.log(`- ts: ${nowIso()}`);
  console.log(`- redirect_uri: ${redirectUri}`);
  console.log(`- scopes: ${scopes}`);
  console.log('');
  console.log('Authorize URL (open in browser):');
  console.log(authorize.toString());
  console.log('');

  if (args.noServer) {
    console.log('NOTE: --no-server set; not starting callback server.');
    console.log('Provide the code manually by re-running without --no-server.');
    process.exit(0);
  }

  console.log('Waiting for callback on http://127.0.0.1:8080/oauth/x/callback ...');
  const cb = await startCallbackServer({ expectedState: state });
  if (!cb.ok) {
    console.error(`Callback failed: ${cb.error}`);
    process.exit(3);
  }

  const form = {
    grant_type: 'authorization_code',
    code: cb.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  };

  // X may require client authentication for some apps; support optional Basic Auth.
  const basicAuth = clientSecret
    ? `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    : null;

  const tok = await httpPostForm(TOKEN_URL, form, basicAuth);
  if (tok.status < 200 || tok.status >= 300) {
    console.error(`Token exchange failed: status=${tok.status}`);
    // Do not print response body (could contain sensitive details)
    process.exit(4);
  }

  let parsed;
  try {
    parsed = JSON.parse(tok.text);
  } catch {
    console.error('Token exchange failed: non-JSON response');
    process.exit(4);
  }

  const accessToken = parsed.access_token;
  const refreshToken = parsed.refresh_token;

  if (!accessToken) {
    console.error('Token exchange failed: missing access_token');
    process.exit(4);
  }

  // Persist to OpenClaw config env vars (no printing)
  updateOpenClawEnvVars({
    X_REDIRECT_URI: redirectUri,
    X_SCOPES: scopes,
    X_ACCESS_TOKEN: accessToken,
    X_REFRESH_TOKEN: refreshToken || '',
  });

  console.log('Token exchange: success');
  console.log('- stored: X_ACCESS_TOKEN (and X_REFRESH_TOKEN if provided) into /root/.openclaw/openclaw.json env.vars');

  if (args.dryRun) {
    const status = await httpGetStatus(ME_URL, accessToken);
    console.log(`dry_run_users_me_status: ${status}`);
  } else {
    console.log('dry_run: skipped (pass --dry-run to verify with GET /2/users/me)');
  }

  // Never print tokens.
  console.log(`tokens_printed: ${redact(accessToken)}`);
}

main().catch((e) => {
  console.error('x_auth failed');
  process.exit(1);
});
