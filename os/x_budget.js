#!/usr/bin/env node

// X API budget enforcement (Project: hard cap $0.25/day)
// - No X calls should be made without checking budget first.
// - If blocked, queue the action to memory/x_queue.md with reason=blocked_by_budget.
// - Spend is tracked in memory/x_budget_ledger.json.
// - No secrets/tokens/headers/bodies are ever logged by this module.

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const LEDGER_PATH = path.join(WORKSPACE, 'memory', 'x_budget_ledger.json');
const QUEUE_PATH = path.join(WORKSPACE, 'memory', 'x_queue.md');

const DAILY_CAP_USD = 0.25;

function ensureParent(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(p, obj) {
  ensureParent(p);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function getTodayKey() {
  // YYYY-MM-DD in America/Phoenix
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA yields YYYY-MM-DD
}

function loadLedger() {
  const raw = safeRead(LEDGER_PATH);
  if (!raw) return {};
  return safeJsonParse(raw, {});
}

function ensureLedgerFile() {
  const raw = safeRead(LEDGER_PATH);
  if (raw == null) {
    writeJsonAtomic(LEDGER_PATH, {});
  } else {
    // Validate JSON; if invalid, do not overwrite automatically.
    safeJsonParse(raw, {});
  }
}

function getTodaySpend() {
  const ledger = loadLedger();
  const key = getTodayKey();
  const day = ledger[key];
  if (!day || typeof day !== 'object') return 0;
  const entries = Array.isArray(day.entries) ? day.entries : [];
  return entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

// Conservative cost table (USD) for budgeting. Adjust later with real usage data.
// Unknown endpoints default to 0.01.
const COST_TABLE = [
  { match: { method: 'GET', endpoint: '/2/users/me' }, cost: 0.005 },
  { match: { method: 'POST', endpoint: '/2/tweets' }, cost: 0.02 },
  { match: { method: 'POST', endpoint: '/2/users/:id/following' }, cost: 0.02 },
  { match: { method: 'DELETE', endpoint: '/2/users/:id/following/:target_user_id' }, cost: 0.02 },
];

function estimateCost({ actionType, endpoint, method }) {
  // Endpoint should be a normalized path like '/2/users/me'
  const m = String(method || '').toUpperCase();
  const ep = String(endpoint || '');

  for (const row of COST_TABLE) {
    if (row.match.method !== m) continue;
    if (row.match.endpoint === ep) return row.cost;
  }

  // If not matched, return conservative default.
  // actionType is currently unused but kept for future refinement.
  return 0.01;
}

function canSpend(amount) {
  const spend = getTodaySpend();
  return spend + amount <= DAILY_CAP_USD;
}

function recordSpend({ amount, metadata }) {
  const ledger = loadLedger();
  const key = getTodayKey();
  ledger[key] = ledger[key] || { capUsd: DAILY_CAP_USD, entries: [] };
  ledger[key].capUsd = DAILY_CAP_USD;
  ledger[key].entries = Array.isArray(ledger[key].entries) ? ledger[key].entries : [];

  ledger[key].entries.push({
    ts: new Date().toISOString(),
    amount: Number(amount),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  });

  writeJsonAtomic(LEDGER_PATH, ledger);
}

function ensureQueueFile() {
  const raw = safeRead(QUEUE_PATH);
  if (raw != null) return;
  ensureParent(QUEUE_PATH);
  fs.writeFileSync(
    QUEUE_PATH,
    [
      '# X Action Queue',
      '',
      'Schema (append-only):',
      '',
      '```yaml',
      '- ts: <ISO-8601>',
      '  reason: blocked_by_budget|other',
      '  actionType: tweet|follow|unfollow|lookup|other',
      '  method: GET|POST|DELETE',
      '  endpoint: /2/...',
      '  estimateUsd: <number>',
      '  details: <short human-safe string; no secrets>',
      '```',
      '',
      '---',
      '',
    ].join('\n'),
    { flag: 'wx' }
  );
}

function queueAction({ reason, actionType, endpoint, method, estimateUsd, details }) {
  ensureQueueFile();
  const block = [
    '- ts: ' + new Date().toISOString(),
    '  reason: ' + (reason || 'blocked_by_budget'),
    '  actionType: ' + (actionType || 'other'),
    '  method: ' + (method || 'GET'),
    '  endpoint: ' + (endpoint || ''),
    '  estimateUsd: ' + String(estimateUsd ?? ''),
    '  details: ' + (details ? JSON.stringify(String(details)).slice(0, 240) : '""'),
    '',
  ].join('\n');

  fs.appendFileSync(QUEUE_PATH, block);
}

function guardOrQueue({ actionType, endpoint, method, details }) {
  const estimateUsd = estimateCost({ actionType, endpoint, method });
  if (!canSpend(estimateUsd)) {
    queueAction({
      reason: 'blocked_by_budget',
      actionType,
      endpoint,
      method,
      estimateUsd,
      details,
    });
    return { ok: false, blocked: true, reason: 'blocked_by_budget', estimateUsd };
  }
  return { ok: true, blocked: false, estimateUsd };
}

module.exports = {
  LEDGER_PATH,
  QUEUE_PATH,
  DAILY_CAP_USD,
  getTodayKey,
  getTodaySpend,
  estimateCost,
  canSpend,
  recordSpend,
  queueAction,
  guardOrQueue,
  ensureLedgerFile,
  ensureQueueFile,
};

// If invoked directly, run a tiny self-check without printing sensitive content.
if (require.main === module) {
  ensureLedgerFile();
  ensureQueueFile();
  const today = getTodayKey();
  const spend = getTodaySpend();
  console.log(`x_budget: ok (today=${today}, spend=$${spend.toFixed(3)}/$${DAILY_CAP_USD.toFixed(2)})`);
}
