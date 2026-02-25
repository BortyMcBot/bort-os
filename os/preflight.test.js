#!/usr/bin/env node

// Project 1 — Router/Preflight test harness
// Deterministic, read-only (no external state changes).

const fs = require('fs');
const path = require('path');

const { validateEnvelope, enforceHighSensitivityOutput } = require('./preflight');
const { appendLog, appendHatLog, nowUtcStamp } = require('./memory-log');

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function tail(p, n = 40) {
  const s = readText(p);
  const lines = s.split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

function contains(str, needle) {
  return String(str).includes(String(needle));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const results = [];
  const pass = (name) => results.push({ name, ok: true });
  const fail = (name, err) => results.push({ name, ok: false, err: String(err && err.message ? err.message : err) });

  // --- Preflight validation
  try {
    const env = {
      hat: 'ops-core',
      intent: 'diagnose',
      taskType: 'ops',
      taskSize: 'small',
      risk: 'low',
      dataSensitivity: 'medium',
      externalStateChange: false,
      identityContext: 'agent',
      actions: ['test'],
      approvalNeeded: false,
    };
    const v = validateEnvelope(env);
    assert(v.ok === true, 'expected ok=true');
    pass('preflight: valid envelope passes');
  } catch (e) {
    fail('preflight: valid envelope passes', e);
  }

  try {
    const envMissing = {
      hat: 'ops-core',
      // intent missing
      taskType: 'ops',
      taskSize: 'small',
      risk: 'low',
      dataSensitivity: 'medium',
      externalStateChange: false,
      identityContext: 'agent',
      actions: ['test'],
      approvalNeeded: false,
    };
    const v1 = validateEnvelope(envMissing);
    assert(v1.ok === false, 'expected ok=false');
    assert(/^Need:/.test(v1.ask), 'expected ask to start with Need:');
    assert(!contains(v1.ask, 'Task Envelope template:'), 'expected shortest ask (no template)');
    pass('preflight: missing required field triggers shortest Need');

    const v2 = validateEnvelope(envMissing);
    assert(v2.ok === false, 'expected ok=false');
    assert(contains(v2.ask, 'Task Envelope template:'), 'expected template on 2nd consecutive failure');
    pass('preflight: 2nd consecutive failure includes template');
  } catch (e) {
    fail('preflight: missing field / second failure behavior', e);
  }

  // --- High-sensitivity enforcement
  const sensitiveCases = [
    { name: 'bearer', s: 'Authorization: Bearer abcdef.12345' },

    // Construct token-like strings at runtime so they do not appear as literals in git history.
    { name: 'openai', s: 'sk-' + 'a'.repeat(30) },

    { name: 'google', s: 'AI' + 'zaSyD-' + 'a'.repeat(30) },
    { name: 'github', s: 'gh' + 'p_' + 'a'.repeat(30) },
    { name: 'cookie', s: 'Cookie: sessionid=abcdef' },
    { name: 'set-cookie', s: 'Set-Cookie: sid=abcdef; HttpOnly' },

    // Construct key block markers at runtime (no literal "-----BEGIN ... PRIVATE KEY-----" sequence).
    {
      name: 'pem',
      s:
        '-----BE' +
        'GIN ' +
        'PRIVATE KEY-----\n' +
        'MIIBVwIBADANBg...\n' +
        '-----END ' +
        'PRIVATE KEY-----',
    },

    { name: 'base64run', s: 'X'.repeat(10) + 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0NTY3ODkwQUJDREVGR0g=' + 'Y'.repeat(10) },
  ];

  for (const c of sensitiveCases) {
    try {
      const r = enforceHighSensitivityOutput(c.s);
      assert(r.ok === false, 'expected ok=false');
      assert(typeof r.pointer === 'string' && r.pointer.length > 0, 'expected pointer string');
      // Confirm no raw sensitive string appears in pointer.
      assert(!contains(r.pointer, c.s.slice(0, 20)), 'pointer leaked raw content');
      pass(`high-sens: blocks ${c.name}`);
    } catch (e) {
      fail(`high-sens: blocks ${c.name}`, e);
    }
  }

  // --- Logging behavior
  try {
    const heading = `${nowUtcStamp()} — preflight.test appendLog`;
    const line = 'test harness wrote this (non-sensitive)';
    const { logsPath } = appendLog({ heading, lines: [line] });
    const t = tail(logsPath, 30);
    assert(contains(t, heading), 'logs missing heading');
    assert(contains(t, line), 'logs missing line');
    pass('logging: appendLog writes to memory/logs.md');
  } catch (e) {
    fail('logging: appendLog writes to memory/logs.md', e);
  }

  try {
    const heading = `${nowUtcStamp()} — preflight.test appendHatLog`;
    const line = 'hat log wrote this (non-sensitive)';
    const { filePath } = appendHatLog({ hat: 'inbox', dataSensitivity: 'medium', heading, lines: [line] });
    const t = tail(filePath, 40);
    assert(contains(t, heading), 'hat file missing heading');
    assert(contains(t, line), 'hat file missing line');
    pass('logging: appendHatLog writes to correct hat file');
  } catch (e) {
    fail('logging: appendHatLog writes to correct hat file', e);
  }

  try {
    const heading = `${nowUtcStamp()} — preflight.test appendHatLog high`;
    const payload = 'Authorization: Bearer SHOULD_NOT_APPEAR';
    const { filePath } = appendHatLog({ hat: 'ops-core', dataSensitivity: 'high', heading, lines: [payload] });
    const t = tail(filePath, 40);
    assert(contains(t, heading), 'ops file missing heading');
    assert(contains(t, 'details suppressed'), 'expected details suppressed marker');
    assert(!contains(t, 'SHOULD_NOT_APPEAR'), 'high-sens hat log leaked payload');
    pass('logging: high-sens hat log suppresses payload');
  } catch (e) {
    fail('logging: high-sens hat log suppresses payload', e);
  }

  // --- Print compact summary
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} - ${r.name}`);
    if (!r.ok) {
      // minimal debug info (no sensitive content)
      console.log(`  ${r.err}`);
    }
  }

  console.log('---');
  console.log(`Total: ${passed.length} passed / ${failed.length} failed`);

  process.exit(failed.length ? 1 : 0);
}

run();
