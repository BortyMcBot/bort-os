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
  const token = must(envObj, 'X_ACCESS_TOKEN');

  const url = X_BASE + ep;
  const headers = {
    authorization: `Bearer ${token}`,
  };

  let requestBody;
  if (body !== undefined && body !== null) {
    headers['content-type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let status = 0;
  let executed = false;
  let extracted = null;

  try {
    const res = await fetch(url, {
      method: m,
      headers,
      body: requestBody,
    });
    executed = true;
    status = res.status;

    if (extractJsonPaths && extractJsonPaths.length) {
      // Parse JSON but only retain selected fields; never print body.
      try {
        const j = await res.json();
        extracted = extractJson(j, extractJsonPaths);
      } catch {
        extracted = null;
      }
    }
  } catch {
    // network error; still considered executed attempt
    executed = true;
    status = 0;
  } finally {
    if (executed) {
      xb.recordSpend({
        amount: estimateUsd,
        metadata: { actionId, actionType: actionType || 'other', method: m, endpoint: ep, status },
      });
    }
  }

  return { ok: true, status, estimateUsd, actionId, extracted };
}

module.exports = { xCall };
