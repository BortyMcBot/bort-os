// Project 1: Router Enforcement (lightweight)
// Preflight runs before hat validation/execution.
// No OpenClaw core changes; this is a workspace-level enforcement layer.
//
// Current behavior:
// - invokes workspace source check in drift-check mode only
// - does NOT refresh/export project_source artifacts from preflight

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runProjectSourceCheck() {
  try {
    // Quiet when no changes; prints the update block only if changes are detected.
    spawnSync('node', ['/root/.openclaw/workspace/scripts/run-project-source-check.mjs'], {
      stdio: 'inherit',
    });
  } catch {
    // Never block preflight on source check.
  }
}

// Run before any hat executes.
runProjectSourceCheck();

const HAT_PROFILES_PATH = path.join(__dirname, 'hat-profiles.json');

function loadHatProfiles() {
  try {
    const j = JSON.parse(fs.readFileSync(HAT_PROFILES_PATH, 'utf8'));
    const hats = j?.hats || {};
    if (!hats || typeof hats !== 'object') throw new Error('invalid hats object');
    return hats;
  } catch {
    return {
      inbox: {
        allowedIdentityContexts: ['human'],
        allowedTaskTypes: ['classify', 'summarize', 'research', 'ops'],
        defaultDataSensitivity: 'medium',
      },
      web: {
        allowedIdentityContexts: ['agent'],
        allowedTaskTypes: ['research', 'summarize', 'classify'],
        defaultDataSensitivity: 'low',
      },
      resale: {
        allowedIdentityContexts: ['agent'],
        allowedTaskTypes: ['research', 'summarize', 'classify', 'ops'],
        defaultDataSensitivity: 'medium',
      },
      'ops-core': {
        allowedIdentityContexts: ['human', 'agent'],
        allowedTaskTypes: ['ops', 'code', 'spec', 'research', 'summarize', 'classify'],
        defaultDataSensitivity: 'medium',
      },
    };
  }
}

const HATS = loadHatProfiles();

const REQUIRED_FIELDS = [
  'hat',
  'intent',
  'taskType',
  'taskSize',
  'risk',
  'dataSensitivity',
  'externalStateChange',
  'identityContext',
  'actions',
  'approvalNeeded',
];

function parseActionTags(actions = []) {
  const cmds = [];
  const skills = [];
  for (const raw of actions.map(String)) {
    const s = raw.trim();
    if (s.toLowerCase().startsWith('cmd:')) cmds.push(s.slice(4).trim());
    if (s.toLowerCase().startsWith('skill:')) skills.push(s.slice(6).trim());
  }
  return { cmds, skills };
}

// In-process consecutive validation failure counter.
// Deterministic + lightweight; resets on process exit.
let consecutiveFailures = 0;

function envelopeTemplate() {
  return [
    '{',
    '  hat: "inbox|web|resale|ops-core",',
    '  intent: "triage|build|research|maintain|report|backup|restore|diagnose|audit",',
    '  taskType: "classify|summarize|code|spec|research|ops",',
    '  taskSize: "small|medium|large",',
    '  risk: "low|medium|high",',
    '  dataSensitivity: "low|medium|high",',
    '  externalStateChange: true|false,',
    '  identityContext: "human|agent",',
    '  actions: ["...", "cmd:<exact>", "skill:<id>"],',
    '  approvalNeeded: true|false,',
    '  // optional override when policy tags are blocked:',
    '  policyOverride: true|false,',
    '  policyOverrideReason: "why override is needed"',
    '}',
  ].join('\n');
}

function isBoolean(v) {
  return v === true || v === false;
}

function shortAsk(missingOrBad) {
  return `Need: ${missingOrBad.join(', ')}`;
}

function askWithFallback(missingOrBad) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 2) {
    return `${shortAsk(missingOrBad)}\n\nTask Envelope template:\n${envelopeTemplate()}`;
  }
  return shortAsk(missingOrBad);
}

function validateEnvelope(envelope) {
  const issues = [];

  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, ask: askWithFallback(['Task Envelope (object)']) };
  }

  for (const f of REQUIRED_FIELDS) {
    if (!(f in envelope)) issues.push(f);
  }

  // Basic enum checks
  if ('hat' in envelope && !(envelope.hat in HATS)) issues.push('hat');
  if (
    'taskType' in envelope &&
    !['classify', 'summarize', 'code', 'spec', 'research', 'ops'].includes(envelope.taskType)
  ) issues.push('taskType');
  if ('taskSize' in envelope && !['small', 'medium', 'large'].includes(envelope.taskSize)) issues.push('taskSize');
  if ('risk' in envelope && !['low', 'medium', 'high'].includes(envelope.risk)) issues.push('risk');
  if (
    'dataSensitivity' in envelope &&
    !['low', 'medium', 'high'].includes(envelope.dataSensitivity)
  ) issues.push('dataSensitivity');
  if ('externalStateChange' in envelope && !isBoolean(envelope.externalStateChange)) {
    issues.push('externalStateChange');
  }
  if ('identityContext' in envelope && !['human', 'agent'].includes(envelope.identityContext)) {
    issues.push('identityContext');
  }

  // Ensure actions/approvalNeeded are compact
  if ('actions' in envelope && !Array.isArray(envelope.actions)) issues.push('actions');
  if ('approvalNeeded' in envelope && !isBoolean(envelope.approvalNeeded)) issues.push('approvalNeeded');
  if ('policyOverride' in envelope && !isBoolean(envelope.policyOverride)) issues.push('policyOverride');
  if (
    'policyOverrideReason' in envelope &&
    typeof envelope.policyOverrideReason !== 'string'
  ) issues.push('policyOverrideReason');

  if (issues.length) {
    return { ok: false, ask: askWithFallback([...new Set(issues)]) };
  }

  // Hat membership rules: identity context
  const hat = HATS[envelope.hat];
  if (!hat.allowedIdentityContexts.includes(envelope.identityContext)) {
    return {
      ok: false,
      ask: askWithFallback([
        `identityContext (${hat.allowedIdentityContexts.join('|')}) for hat=${envelope.hat}`,
      ]),
    };
  }

  // Hat membership rules: task type policy
  if (Array.isArray(hat.allowedTaskTypes) && !hat.allowedTaskTypes.includes(envelope.taskType)) {
    return {
      ok: false,
      ask: askWithFallback([
        `taskType (${hat.allowedTaskTypes.join('|')}) for hat=${envelope.hat}`,
      ]),
    };
  }

  // Phase 2 policy enforcement: per-hat command/skill allowlists.
  // Action tags supported in envelope.actions:
  // - cmd:<exact command>
  // - skill:<skill-id>
  // Untagged actions remain descriptive and are not policy-checked.
  const { cmds, skills } = parseActionTags(envelope.actions || []);
  const allowedCommands = Array.isArray(hat.allowedCommands) ? hat.allowedCommands : [];
  const allowedSkills = Array.isArray(hat.allowedSkills) ? hat.allowedSkills : [];

  const blockedCmds = cmds.filter((c) => !allowedCommands.includes(c));
  const blockedSkills = skills.filter((s) => !allowedSkills.includes(s));

  const wantsOverride = envelope.policyOverride === true;
  const overrideReason = String(envelope.policyOverrideReason || '').trim();

  if ((blockedCmds.length > 0 || blockedSkills.length > 0) && !(wantsOverride && overrideReason)) {
    const parts = [];
    if (blockedCmds.length) parts.push(`blocked cmd tags: ${blockedCmds.join(', ')}`);
    if (blockedSkills.length) parts.push(`blocked skill tags: ${blockedSkills.join(', ')}`);
    parts.push('To override explicitly: set policyOverride=true and policyOverrideReason="..."');
    return { ok: false, ask: askWithFallback(parts) };
  }

  // Inbox hard rule: never use human Gmail for tool/platform registrations unless explicitly instructed.
  // Enforced via explicit action naming in envelope.
  if (envelope.hat === 'inbox') {
    const actions = envelope.actions.map(String);
    const looksLikeSignup = actions.some((a) => /sign\s*up|register|create\s*account/i.test(a));
    if (looksLikeSignup && envelope.identityContext === 'human') {
      return {
        ok: false,
        ask: askWithFallback([
          'confirm signup identityContext=agent (bort@…) OR explicit instruction to use human Gmail',
        ]),
      };
    }
  }

  // Approval gate: externalStateChange implies approvalNeeded.
  if (envelope.externalStateChange === true && envelope.approvalNeeded !== true) {
    return { ok: false, ask: askWithFallback(['approvalNeeded=true (externalStateChange=true)']) };
  }

  // Reset consecutive failure counter on success.
  consecutiveFailures = 0;
  return { ok: true };
}

function executionHeader(envelope) {
  const hat = envelope.hat;
  const ds = envelope.dataSensitivity;
  const actions = (envelope.actions || []).join('; ') || 'none';
  const approvalNeeded = envelope.approvalNeeded ? 'yes' : 'no';
  const { cmds, skills } = parseActionTags(envelope.actions || []);
  const policyOverride = envelope.policyOverride === true ? 'yes' : 'no';
  const policyOverrideReason = envelope.policyOverrideReason ? String(envelope.policyOverrideReason) : 'n/a';
  return [
    `Hat: ${hat}`,
    `dataSensitivity: ${ds}`,
    `actions: ${actions}`,
    `taggedCommands: ${cmds.length ? cmds.join(' | ') : 'none'}`,
    `taggedSkills: ${skills.length ? skills.join(' | ') : 'none'}`,
    `approvalNeeded: ${approvalNeeded}`,
    `policyOverride: ${policyOverride}`,
    `policyOverrideReason: ${policyOverrideReason}`,
  ].join('\n');
}

function enforceHighSensitivityOutput(text) {
  // Deterministic, explicit blocklist patterns.
  // If triggered, caller must suppress output and show only a pointer message.
  const blocks = [
    // Bearer tokens / Authorization headers
    { id: 'auth_bearer', re: /Authorization:\s*Bearer\s+[^\s]+/i },

    // API keys (common families)
    { id: 'openai_key', re: /\bsk-(proj-)?[A-Za-z0-9\-_]{20,}\b/ },
    { id: 'google_api_key', re: /\bAIza[0-9A-Za-z\-_]{20,}\b/ },
    { id: 'github_pat', re: /\bghp_[A-Za-z0-9]{20,}\b/ },

    // OAuth tokens
    { id: 'google_oauth_access', re: /\bya29\.[0-9A-Za-z\-_]+\b/ },
    { id: 'token_kv', re: /\b(access_token|refresh_token|id_token)\b\s*[:=]/i },

    // Cookies / Set-Cookie
    { id: 'cookie_header', re: /\b(Set-Cookie|Cookie):\s*.+/i },

    // Private key blocks
    {
      id: 'private_key_block',
      re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/,
    },

    // Large base64-like runs (risk of tokens/attachments)
    {
      id: 'base64_run',
      // Match base64-like runs; threshold kept modest to catch common leakage.
      // Intentionally does NOT require non-base64 boundaries (can appear inline).
      re: /[A-Za-z0-9+/]{60,}={0,2}/,
    },

    // Raw email header-ish dumps
    { id: 'email_received_headers', re: /\nReceived:\s.+/i },
  ];

  const s = String(text || '');
  for (const b of blocks) {
    if (b.re.test(s)) {
      return {
        ok: false,
        blockId: b.id,
        pointer:
          'Suppressed output (dataSensitivity=high). Only a pointer is shown; see memory for the compact summary heading.',
      };
    }
  }
  return { ok: true };
}

module.exports = {
  HATS,
  validateEnvelope,
  executionHeader,
  enforceHighSensitivityOutput,
};
