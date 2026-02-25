// Project 1: Router Enforcement (lightweight)
// Preflight MUST run before any hat executes.
// No OpenClaw core changes; this is a workspace-level enforcement layer.

const HATS = {
  inbox: {
    identityUsage: 'human_primary',
    allowedIdentityContexts: ['human'],
    defaultDataSensitivity: 'medium',
  },
  web: {
    identityUsage: 'agent_only',
    allowedIdentityContexts: ['agent'],
    defaultDataSensitivity: 'low',
  },
  resale: {
    identityUsage: 'agent_only',
    allowedIdentityContexts: ['agent'],
    defaultDataSensitivity: 'medium',
  },
  'ops-core': {
    identityUsage: 'mixed',
    allowedIdentityContexts: ['human', 'agent'],
    defaultDataSensitivity: 'medium',
  },
};

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
    '  actions: ["..."],',
    '  approvalNeeded: true|false',
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
  return [
    `Hat: ${hat}`,
    `dataSensitivity: ${ds}`,
    `actions: ${actions}`,
    `approvalNeeded: ${approvalNeeded}`,
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
