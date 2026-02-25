#!/usr/bin/env node

// Project 1 skeleton: Web repo audit checklist (read-only)
// No git writes, no network pushes.

const { execSync } = require('child_process');
const { validateEnvelope, executionHeader } = require('../os/preflight');
const { appendLog, appendHatLog, nowUtcStamp } = require('../os/memory-log');

const repoPath = process.env.WEB_REPO_PATH || '';

const envelope = {
  hat: 'web',
  intent: 'audit',
  risk: 'low',
  dataSensitivity: 'low',
  externalStateChange: false,
  identityContext: 'agent',
  actions: ['check git status/log/branches (read-only)'],
  approvalNeeded: false,
};

const v = validateEnvelope(envelope);
if (!v.ok) {
  console.log(v.ask);
  process.exit(2);
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

console.log(executionHeader(envelope));
console.log('');

if (!repoPath) {
  console.log('Need: WEB_REPO_PATH (path to BryanDuckworth.com repo)');
  process.exit(2);
}

console.log(`Repo: ${repoPath}`);
console.log('');
console.log('Checklist:');
console.log('- uncommitted changes?');
console.log('- current branch?');
console.log('- last commit?');
console.log('- remotes configured?');
console.log('');

try {
  const status = sh(`git -C ${repoPath} status --porcelain`);
  const branch = sh(`git -C ${repoPath} rev-parse --abbrev-ref HEAD`);
  const last = sh(`git -C ${repoPath} log -1 --oneline`);
  const remotes = sh(`git -C ${repoPath} remote -v | head`);

  console.log(`- branch: ${branch}`);
  console.log(`- last commit: ${last}`);
  console.log(`- uncommitted files: ${status ? status.split('\n').length : 0}`);
  console.log('- remotes:');
  console.log(remotes || '(none)');
} catch (e) {
  console.log('Repo audit failed (read-only).');
  console.log(String(e.stderr || e.message || e));
  process.exit(1);
}

const heading = `${nowUtcStamp()} — web_repo_audit (skeleton)`;
appendLog({ heading, lines: ['Ran web repo audit skeleton (read-only).'] });
appendHatLog({ hat: envelope.hat, dataSensitivity: envelope.dataSensitivity, heading, lines: ['Ran web repo audit skeleton (read-only).'] });
