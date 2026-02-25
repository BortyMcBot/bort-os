#!/usr/bin/env node

// Model watcher (safe): detects newly available OpenRouter models and recommends routing updates.
// - Never mutates OpenClaw config or routing.
// - Snapshot is stored in memory/logs.md as a fenced block tagged: models_snapshot_json
// - Telegram output is capped: max 15 new models + "+N more".

const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function sh(cmd) {
  try {
    return cp.execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function nowUtcStamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function appendModelsCheckLog({ ts, openrouterCount, newCount, notableIds, snapshotObj }) {
  const p = path.join(process.cwd(), 'memory', 'logs.md');
  const lines = [
    `## ${ts} — models_check`,
    '',
    `- openrouter catalog: ${openrouterCount}`,
    `- new models: ${newCount}`,
    `- notable: ${notableIds.length ? notableIds.join(', ') : '(none)'}`,
    '',
    '```models_snapshot_json',
    JSON.stringify(snapshotObj),
    '```',
    '',
  ].join('\n');
  fs.appendFileSync(p, `\n${lines}`);
}

function parseModelListPlain(out) {
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function lastSnapshotFromLogs() {
  const md = safeRead(path.join(process.cwd(), 'memory', 'logs.md'));
  // Find last fenced block: ```models_snapshot_json ... ```
  const re = /```models_snapshot_json\n([\s\S]*?)\n```/g;
  let m;
  let last = null;
  while ((m = re.exec(md)) !== null) {
    last = m[1];
  }
  if (!last) return null;
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

function detectNotables(newIds) {
  const notable = [];

  // Callout: any gpt-5.3* (any provider) or newer codex model (pattern-based)
  const gpt53 = newIds.filter((id) => /gpt-5\.3/i.test(id));
  for (const id of gpt53) notable.push({ kind: 'gpt-5.3+', id });

  const codexCandidates = newIds.filter((id) => /codex/i.test(id));
  for (const id of codexCandidates) {
    if (/5\.3|5\.4|5\.5|6\./.test(id)) notable.push({ kind: 'newer-codex', id });
  }

  // Dedup by id
  const seen = new Set();
  return notable.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
}

function recommendRouting({ routeModel }, openrouterIds) {
  // Recommendations only (no changes). Output only when different.

  const envBase = {
    hat: 'ops-core',
    intent: 'recommend',
    risk: 'low',
    dataSensitivity: 'medium',
    externalStateChange: false,
    identityContext: 'agent',
    actions: ['models_check'],
    approvalNeeded: false,
    taskSize: 'small',
  };

  function current(taskType, taskSize = 'small') {
    return routeModel({ ...envBase, taskType, taskSize }).model;
  }

  // Candidate picks (only if they exist in OpenRouter catalog, and never auto)
  function pickIfExists(id) {
    if (!id) return null;
    if (/openrouter\/(openrouter\/auto|auto)$/i.test(id)) return null;
    return openrouterIds.includes(id) ? id : null;
  }

  const rows = [];

  const curSumm = current('summarize');
  const curSpec = current('spec', 'large');
  const curResearch = current('research');
  const curCode = current('code');

  const recSumm = pickIfExists('openrouter/google/gemini-2.5-flash-lite') || curSumm;
  const recSpec = pickIfExists('openrouter/anthropic/claude-3.7-sonnet') || curSpec;
  const recResearch = pickIfExists('openrouter/openai/o3-mini-high') || curResearch;
  const recCode = curCode; // keep codex unless explicitly approved

  rows.push({ taskType: 'summarize|classify', current: curSumm, recommended: recSumm });
  rows.push({ taskType: 'spec', current: curSpec, recommended: recSpec });
  rows.push({ taskType: 'research', current: curResearch, recommended: recResearch });
  rows.push({ taskType: 'code|ops', current: curCode, recommended: recCode });

  return rows;
}

function main() {
  const cfgPath = '/root/.openclaw/openclaw.json';
  const cfg = readJson(cfgPath);
  const primary = cfg?.agents?.defaults?.model?.primary || '(unknown)';
  const fallbacks = cfg?.agents?.defaults?.model?.fallbacks || [];

  const routing = require('./model-routing');

  // OpenRouter catalog (IDs only)
  const out = sh('openclaw models list --all --provider openrouter --plain');
  const openrouterIds = parseModelListPlain(out);

  // Last snapshot from logs
  const last = lastSnapshotFromLogs();
  const lastIds = Array.isArray(last?.openrouterIds) ? last.openrouterIds : [];
  const lastSet = new Set(lastIds);

  const newIds = openrouterIds.filter((id) => !lastSet.has(id));

  const notable = detectNotables(newIds);
  const notableIds = notable.map((n) => n.id);

  // Telegram-safe output caps
  const TOP = 15;
  const head = newIds.slice(0, TOP);
  const more = Math.max(0, newIds.length - head.length);

  console.log('models_check');
  console.log('');
  const ts = nowUtcStamp();
  console.log(`- timestamp: ${ts}`);
  console.log(`- primary: ${primary}`);
  console.log(`- fallbacks: ${fallbacks.join(' | ') || '(none)'}`);
  console.log(`- openrouter catalog size: ${openrouterIds.length}`);
  console.log('');

  console.log('New models since last run:');
  if (newIds.length === 0) {
    console.log('- (none)');
  } else {
    for (const id of head) console.log(`- ${id}`);
    if (more) console.log(`- (+${more} more)`);
  }
  console.log('');

  if (notable.length) {
    console.log('Notable models detected:');
    for (const n of notable) console.log(`- ${n.kind}: ${n.id}`);
    console.log('');
  }

  const recs = recommendRouting(routing, openrouterIds);
  const changes = recs.filter((r) => r.current !== r.recommended);

  if (changes.length === 0) {
    console.log('Routing recommendations: no changes recommended');
  } else {
    console.log('Routing recommendations (no changes applied):');
    for (const r of changes) {
      console.log(`- ${r.taskType}: ${r.current} -> ${r.recommended}`);
    }
  }

  // Persist snapshot in logs as tagged fenced block for deterministic parsing.
  const snapshotObj = {
    ts,
    openrouterCount: openrouterIds.length,
    openrouterIds,
    newCount: newIds.length,
    notable: notableIds,
  };

  appendModelsCheckLog({
    ts,
    openrouterCount: openrouterIds.length,
    newCount: newIds.length,
    notableIds,
    snapshotObj,
  });
}

main();
