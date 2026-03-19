#!/usr/bin/env node

// Canonical X API wrapper
// - Budget preflight BEFORE every network call
// - Queue when blocked (reason=blocked_by_budget)
// - Record spend after any network attempt (success or failure), but only if call executed
// - Never prints tokens, headers, or response bodies

const fs = require('fs');
const crypto = require('crypto');

const xb = require('./x_budget');

const X_BASE = 'https://api.x.com';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';

function loadOpenClawEnvVars() {
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

function updateOpenClawEnvVars(patch) {
  const p = '/root/.openclaw/openclaw.json';
  const lock = '/tmp/openclaw.json.lock';
  let lockFd = null;
  for (let i = 0; i < 20; i++) {
    try {
      lockFd = fs.openSync(lock, 'wx');
      break;
    } catch {
      const t = Date.now() + 50;
      while (Date.now() < t) {}
    }
  }
  if (lockFd == null) throw new Error('Could not acquire config lock');

  try {
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = JSON.parse(raw);
    cfg.env = cfg.env || {};
    cfg.env.vars = cfg.env.vars || {};

    for (const [k, v] of Object.entries(patch)) {
      if (v == null) continue;
      cfg.env.vars[k] = String(v);
    }

    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, p);
  } finally {
    try { fs.closeSync(lockFd); } catch {}
    try { fs.unlinkSync(lock); } catch {}
  }
}

function mergedEnv() {
  // precedence: process.env overrides config env.vars
  return { ...loadOpenClawEnvVars(), ...process.env };
}

function must(envObj, key) {
  const v = envObj[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function normalizeEndpoint(endpoint) {
  const ep = String(endpoint || '');
  if (!ep.startsWith('/')) return '/' + ep;
  return ep;
}

function loadPricingIfExists() {
  const p = `${process.cwd()}/os/x_pricing.json`;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

function estimateCost({ actionType, endpoint, method, costUsdOverride }) {
  if (typeof costUsdOverride === 'number' && Number.isFinite(costUsdOverride) && costUsdOverride >= 0) {
    return costUsdOverride;
  }

  const pricing = loadPricingIfExists();
  const m = String(method || '').toUpperCase();
  const ep = normalizeEndpoint(endpoint);

  // Pricing format (if present):
  // { "defaults": {"unknown": 0.01}, "routes": [{"method":"GET","endpoint":"/2/users/me","cost":0.005}] }
  if (pricing && Array.isArray(pricing.routes)) {
    for (const r of pricing.routes) {
      if (!r || typeof r !== 'object') continue;
      if (String(r.method || '').toUpperCase() !== m) continue;
      if (String(r.endpoint || '') !== ep) continue;
      const c = Number(r.cost);
      if (Number.isFinite(c) && c >= 0) return c;
    }
    const unk = Number(pricing?.defaults?.unknown);
    if (Number.isFinite(unk) && unk >= 0) return unk;
  }

  // Fallback to x_budget conservative estimator.
  return xb.estimateCost({ actionType, endpoint: ep, method: m });
}

function newActionId() {
  return crypto.randomBytes(8).toString('hex');
}

function getByPath(obj, p) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(p).split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
    else return undefined;
  }
  return cur;
}

function extractJson(obj, paths) {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const out = {};
  for (const p of paths) {
    const v = getByPath(obj, p);
    if (v !== undefined) out[p] = v;
  }
  return out;
}

function pctEncode(s) {
  return encodeURIComponent(String(s)).replace(/[!*()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function collectQueryParams(urlObj) {
  const params = [];
  for (const [k, v] of urlObj.searchParams.entries()) {
    params.push([k, v]);
  }
  return params;
}

function buildOAuthHeader({ method, urlObj, consumerKey, consumerSecret, token, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  const allParams = [];
  for (const [k, v] of Object.entries(oauthParams)) allParams.push([k, v]);
  for (const [k, v] of collectQueryParams(urlObj)) allParams.push([k, v]);

  allParams.sort((a, b) => {
    if (a[0] === b[0]) return String(a[1]).localeCompare(String(b[1]));
    return String(a[0]).localeCompare(String(b[0]));
  });

  const paramString = allParams.map(([k, v]) => `${pctEncode(k)}=${pctEncode(v)}`).join('&');
  const baseUrl = `${urlObj.origin}${urlObj.pathname}`;
  const baseString = [String(method).toUpperCase(), pctEncode(baseUrl), pctEncode(paramString)].join('&');
  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const header =
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(headerParams[k])}"`)
      .join(', ');

  return header;
}

async function refreshAccessToken(envObj) {
  const refreshToken = envObj.X_REFRESH_TOKEN;
  const clientId = envObj.X_CLIENT_ID;
  const clientSecret = envObj.X_CLIENT_SECRET;

  if (!refreshToken || !clientId) return { ok: false, status: 0 };

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
  };

  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.authorization = `Basic ${basic}`;
  }

  const res = await fetch(TOKEN_URL, { method: 'POST', headers, body: form.toString() });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status };

  try {
    const j = JSON.parse(text);
    const access = j.access_token;
    const refresh = j.refresh_token || refreshToken;
    if (access) {
      updateOpenClawEnvVars({ X_ACCESS_TOKEN: access, X_REFRESH_TOKEN: refresh });
      return { ok: true, status: res.status };
    }
  } catch {
    // ignore
  }

  return { ok: false, status: res.status };
}

async function doRequest({ actionType, method, endpoint, body, extractJsonPaths, envObj, estimateUsd }) {
  const m = String(method || 'GET').toUpperCase();
  const ep = normalizeEndpoint(endpoint);
  const urlObj = new URL(X_BASE + ep);

  const headers = {};
  const accessToken = envObj.X_ACCESS_TOKEN;
  const url = X_BASE + ep;

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  } else if (m === 'GET') {
    const bearer = must(envObj, 'X_BEARER_TOKEN');
    headers.authorization = `Bearer ${bearer}`;
  } else if (m === 'POST' || m === 'DELETE') {
    const consumerKey = must(envObj, 'X_API_KEY');
    const consumerSecret = must(envObj, 'X_API_SECRET');
    const token = must(envObj, 'X_ACCESS_TOKEN');
    const tokenSecret = must(envObj, 'X_ACCESS_TOKEN_SECRET');
    headers.authorization = buildOAuthHeader({
      method: m,
      urlObj,
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
    });
  } else {
    const bearer = must(envObj, 'X_BEARER_TOKEN');
    headers.authorization = `Bearer ${bearer}`;
  }

  let requestBody;
  if (body !== undefined && body !== null) {
    headers['content-type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let status = 0;
  let executed = false;
  let extracted = null;

  try {
    const res = await fetch(accessToken ? url : urlObj.toString(), { method: m, headers, body: requestBody });
    executed = true;
    status = res.status;

    if (extractJsonPaths && extractJsonPaths.length) {
      try {
        const j = await res.json();
        extracted = extractJson(j, extractJsonPaths);
      } catch {
        extracted = null;
      }
    }
  } catch {
    executed = true;
    status = 0;
  } finally {
    if (executed) {
      xb.recordSpend({
        amount: estimateUsd,
        metadata: { actionId: newActionId(), actionType: actionType || 'other', method: m, endpoint: ep, status },
      });
    }
  }

  return { status, extracted };
}

async function xCall({ actionType, method, endpoint, body, details, costUsdOverride, extractJsonPaths }) {
  const actionId = newActionId();

  const m = String(method || 'GET').toUpperCase();
  const ep = normalizeEndpoint(endpoint);
  const estimateUsd = estimateCost({ actionType, endpoint: ep, method: m, costUsdOverride });

  xb.ensureLedgerFile();
  xb.ensureQueueFile();

  const gate = xb.guardOrQueue({
    actionType,
    method: m,
    endpoint: ep,
    details: details || '',
  });

  // Note: guardOrQueue uses its own estimate; we keep ours for reporting/ledger.
  if (!gate.ok) {
    return { ok: false, blocked: true, reason: 'blocked_by_budget', estimateUsd, actionId };
  }

  const envObj = mergedEnv();

  let { status, extracted } = await doRequest({
    actionType,
    method: m,
    endpoint: ep,
    body,
    extractJsonPaths,
    envObj,
    estimateUsd,
  });

  if (status === 401) {
    const refreshed = await refreshAccessToken(envObj);
    if (refreshed.ok) {
      const retryGate = xb.guardOrQueue({
        actionType: `${actionType || 'other'}:retry`,
        method: m,
        endpoint: ep,
        details: 'retry-after-refresh',
      });
      if (!retryGate.ok) {
        return { ok: false, blocked: true, reason: 'blocked_by_budget', estimateUsd, actionId };
      }

      const envObjRetry = mergedEnv();
      const retry = await doRequest({
        actionType,
        method: m,
        endpoint: ep,
        body,
        extractJsonPaths,
        envObj: envObjRetry,
        estimateUsd,
      });
      status = retry.status;
      extracted = retry.extracted;
    }
  }

  return { ok: true, status, estimateUsd, actionId, extracted };
}

module.exports = { xCall };
