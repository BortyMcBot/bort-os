#!/usr/bin/env node

// Optional Phase A (wrapper only): non-invasive wrapper around existing inbox entrypoint.
// This wrapper constructs an envelope + runs preflight, then (optionally) would exec the real script.
// Per current constraints, it DOES NOT call Gmail logic by default.

const { validateEnvelope, executionHeader } = require('../os/preflight');
const { appendLog, appendHatLog, nowUtcStamp } = require('../os/memory-log');

// This wrapper is intentionally conservative.
// If you want it to call the underlying script later, we’ll gate it behind explicit approval.
const envelope = {
  hat: 'inbox',
  intent: 'triage',
  risk: 'medium',
  dataSensitivity: 'medium',
  externalStateChange: false,
  identityContext: 'human',
  actions: ['preflight wrapper check (no-op)'],
  approvalNeeded: false,
};

const v = validateEnvelope(envelope);
if (!v.ok) {
  console.log(v.ask);
  process.exit(2);
}

console.log(executionHeader(envelope));
console.log('');
console.log('Wrapper check OK. No underlying inbox script executed (no-op by design).');

const heading = `${nowUtcStamp()} — inbox wrapper (no-op)`;
appendLog({ heading, lines: ['Validated envelope via wrapper (no-op).'] });
appendHatLog({ hat: envelope.hat, dataSensitivity: envelope.dataSensitivity, heading, lines: ['Validated envelope via wrapper (no-op).'] });
