#!/usr/bin/env node

// Project 1 skeleton: Weekly system healthcheck (read-only)

const { execSync } = require('child_process');
const { validateEnvelope, executionHeader } = require('../os/preflight');
const { appendLog, appendHatLog, nowUtcStamp } = require('../os/memory-log');

const envelope = {
  hat: 'ops-core',
  intent: 'diagnose',
  taskType: 'ops',
  taskSize: 'small',
  risk: 'low',
  dataSensitivity: 'medium',
  externalStateChange: false,
  identityContext: 'agent',
  actions: ['collect CPU/RAM/swap/disk snapshots'],
  approvalNeeded: false,
};

const v = validateEnvelope(envelope);
if (!v.ok) {
  console.log(v.ask);
  process.exit(2);
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

let mem, disk, uptime;
try {
  mem = sh('free -h');
  disk = sh('df -h /');
  uptime = sh('uptime');
} catch (e) {
  console.log('Healthcheck failed (read-only).');
  console.log(`- error: ${String(e.message || e)}`);
  process.exit(1);
}

console.log(executionHeader(envelope));
console.log('');
console.log('Snapshot (read-only):');
console.log(`- uptime: ${uptime}`);
console.log('- free -h:');
console.log(mem.split('\n').slice(0, 3).join('\n'));
console.log('- df -h /:');
console.log(disk.split('\n').slice(0, 2).join('\n'));

const heading = `${nowUtcStamp()} — weekly_healthcheck (skeleton)`;
appendLog({ heading, lines: ['Collected resource snapshot (read-only).'] });
appendHatLog({ hat: envelope.hat, dataSensitivity: envelope.dataSensitivity, heading, lines: ['Collected resource snapshot (read-only).'] });
