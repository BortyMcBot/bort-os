#!/usr/bin/env node

// Project 1 skeleton: Inbox daily triage (read-only)
// Does NOT change inbox state. Intended as a placeholder for future implementation.

const { validateEnvelope, executionHeader } = require('../os/preflight');
const { appendLog, appendHatLog, nowUtcStamp } = require('../os/memory-log');

const envelope = {
  hat: 'inbox',
  intent: 'triage',
  risk: 'medium',
  dataSensitivity: 'medium',
  externalStateChange: false,
  identityContext: 'human',
  actions: ['scan unread counts (dry)'],
  approvalNeeded: false,
};

const v = validateEnvelope(envelope);
if (!v.ok) {
  console.log(v.ask);
  process.exit(2);
}

console.log(executionHeader(envelope));
console.log('');
console.log('Triage skeleton only (dry-run): no Gmail state changes performed.');
console.log('Next (future): call daily-review.js with --dry-run and format summary.');

const heading = `${nowUtcStamp()} — inbox_daily_triage (skeleton)`;
appendLog({ heading, lines: ['Ran dry triage skeleton (no external changes).'] });
appendHatLog({ hat: envelope.hat, dataSensitivity: envelope.dataSensitivity, heading, lines: ['Ran dry triage skeleton.'] });
