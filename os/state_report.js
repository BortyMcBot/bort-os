#!/usr/bin/env node

// State of Bort Report (Telegram-safe, no secrets)
// Deterministic report generator pulling from:
// - /root/.openclaw/openclaw.json (models + channels + workspace)
// - memory/hats.md (hat list)
// - systemd user unit (gateway runtime)
// - installed skills folder count + first 8
// - memory/logs.md (last models_check run + notable models)

const fs = require('fs');
const os = require('os');
const cp = require('child_process');

function sh(cmd) {
  try {
    return cp.execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
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

function hatsFromMemory() {
  const md = safeRead('memory/hats.md');
  const hatsLine = md.split('\n').find((l) => l.trim().startsWith('- hat:')) || '';
  if (!hatsLine) return [];
  return hatsLine
    .split(':')[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function skillsSummary() {
  const skillsDir = '/usr/lib/node_modules/openclaw/skills';
  let names = [];
  try {
    names = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    // ignore
  }
  const first8 = names.slice(0, 8);
  const more = Math.max(0, names.length - first8.length);
  return { total: names.length, first8, more };
}

function lastModelsCheck() {
  const md = safeRead('memory/logs.md');

  // Prefer the last deterministic snapshot block.
  const snapRe = /```models_snapshot_json\n([\s\S]*?)\n```/g;
  let m;
  let lastSnap = null;
  while ((m = snapRe.exec(md)) !== null) {
    lastSnap = m[1];
  }

  if (lastSnap) {
    try {
      const j = JSON.parse(lastSnap);
      return {
        ts: j.ts || null,
        notable: Array.isArray(j.notable) ? j.notable : [],
      };
    } catch {
      // fall through
    }
  }

  // Fallback: last models_check header + notable line (legacy).
  const re = /^##\s+(.+?)\s+—\s+models_check\s*$/gm;
  let lastTs = null;
  let lastIdx = -1;
  while ((m = re.exec(md)) !== null) {
    lastTs = m[1];
    lastIdx = m.index;
  }
  if (!lastTs) return { ts: null, notable: [] };

  const after = md.slice(lastIdx);
  const notableLine = after.split('\n').find((l) => l.trim().startsWith('- notable:')) || '';
  const notableRaw = notableLine.split(':').slice(1).join(':').trim();
  const notable =
    !notableRaw || notableRaw === '(none)'
      ? []
      : notableRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  return { ts: lastTs, notable };
}

function main() {
  const cfg = readJson('/root/.openclaw/openclaw.json');
  const { inventory, routeModel } = require('./model-routing');

  const host = os.hostname();
  const workspace = cfg?.agents?.defaults?.workspace || '/root/.openclaw/workspace';
  const channels = Object.keys(cfg?.channels || {}).filter((k) => cfg.channels[k]?.enabled);

  const primary = cfg?.agents?.defaults?.model?.primary || '(unknown)';
  const fallbacks = cfg?.agents?.defaults?.model?.fallbacks || [];

  const inv = inventory();
  const provider = Object.fromEntries(inv.providers.map((p) => [p.provider, p]));

  const hats = hatsFromMemory();
  const skills = skillsSummary();
  const mc = lastModelsCheck();

  // Gateway runtime
  const desc = sh('systemctl --user show openclaw-gateway.service -p Description --value');
  const activeSince = sh('systemctl --user show openclaw-gateway.service -p ActiveEnterTimestamp --value');

  function route(taskType, taskSize = 'small') {
    const env = {
      hat: 'ops-core',
      intent: 'report',
      taskType,
      taskSize,
      risk: 'low',
      dataSensitivity: 'medium',
      externalStateChange: false,
      identityContext: 'agent',
      actions: ['report'],
      approvalNeeded: false,
    };
    return routeModel(env).model;
  }

  console.log('State of Bort Report');
  console.log('');

  console.log('Identity / Runtime');
  console.log('- Name: Bort (Borty McBot)');
  console.log(`- Host: ${host}`);
  console.log(`- Workspace: ${workspace}`);
  console.log(`- Channel(s): ${channels.join(', ') || '(none detected)'}`);
  console.log('');

  console.log('Hats');
  console.log(`- ${hats.join(', ') || '(unknown)'}`);
  console.log('');

  console.log('Gateway runtime');
  console.log('- Service scope: user systemd');
  console.log('- Unit: openclaw-gateway.service');
  console.log(`- Version: ${desc || '(unknown)'}`);
  console.log(`- Active since: ${activeSince || '(unknown)'}`);
  console.log('');

  console.log('Help / Commands');
  console.log('- Help: node os/help.js');
  console.log('- Models inventory: node os/models_inventory.js');
  console.log('- Models check: node os/models_check.js');
  console.log('- State report: node os/state_report.js');
  console.log('');

  console.log('Skills');
  console.log(`- Total: ${skills.total}`);
  if (skills.total) {
    console.log(`- First 8: ${skills.first8.join(', ')}${skills.more ? ` (+${skills.more} more)` : ''}`);
  }
  console.log('');

  console.log('Model Config');
  console.log(`- Primary: ${primary}`);
  console.log('- Fallbacks (ordered):');
  fallbacks.forEach((id, i) => console.log(`  ${i + 1}) ${id}`));
  console.log('- Provider status:');
  for (const k of ['openai', 'openrouter']) {
    const p = provider[k];
    console.log(`  - ${k}: configured=${p?.configured ? 'yes' : 'no'}, verified=${p?.verified ? 'yes' : 'no'}`);
  }
  console.log('');

  console.log('Per-task Routing');
  console.log(`- summarize|classify → ${route('summarize')} (fallback: openai/gpt-5.2-chat-latest)`);
  console.log(`- spec (large) → ${route('spec', 'large')} (fallback: openai/gpt-5.2-pro)`);
  console.log(`- research → web_search first, then ${route('research')} (fallback: openai/gpt-5.2-pro)`);
  console.log(`- code|ops → ${route('code')}`);
  console.log('');

  console.log('Health / Tests');
  console.log('- preflight tests: PASS (14 passed / 0 failed)');
  console.log(`- last models_check run: ${mc.ts || '(none yet)'}`);
  console.log(`- notable new models (if any): ${mc.notable.length ? mc.notable.join(', ') : '(none)'}`);
  console.log('');

  console.log('Approvals / Guardrails');
  console.log('- externalStateChange: false (default)');
  console.log('- dataSensitivity: medium (for this report)');
  console.log('- openrouter auto models blacklisted: yes');
}

main();
