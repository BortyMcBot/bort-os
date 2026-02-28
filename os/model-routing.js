// Deterministic task-based model routing (workspace OS layer)
//
// Design goals:
// - Deterministic routing from Task Envelope fields (taskType/taskSize/etc.)
// - Codex-first for code/ops whenever available
// - Cheapest model that is still expected to succeed for a task class
// - Explicit allowlist + availability gating
// - Safe, best-effort logging (routing must never throw)
// - No mutation of the input envelope

const fs = require('fs');
const path = require('path');
const { appendHatLog, nowUtcStamp } = require('./memory-log');

/* ------------------------------
   Provider / Model Health Tables
-------------------------------- */

// NOTE: These tables are a conservative allowlist.
// Only list models we explicitly intend to route to.
const providerHealth = {
  openai: { configured: true, verified: true },
  'openai-codex': { configured: true, verified: true },
  openrouter: { configured: true, verified: true },
};

// Explicit blacklist: if referenced, treat as unavailable.
const blacklistedModels = new Set(['openrouter/openrouter/auto', 'openrouter/auto']);

const modelHealth = {
  // Codex-first for code/ops
  'openai-codex/gpt-5.3-codex': { provider: 'openai-codex', verified: true },
  'openai-codex/gpt-5.2': { provider: 'openai-codex', verified: true },
  'openai-codex/gpt-5.2-codex': { provider: 'openai-codex', verified: true },

  // OpenAI general
  'openai/codex-mini-latest': { provider: 'openai', verified: true },
  'openai/gpt-5.2': { provider: 'openai', verified: true },
  'openai/gpt-5.2-pro': { provider: 'openai', verified: true },
  'openai/gpt-5.2-chat-latest': { provider: 'openai', verified: true },
  'openai/gpt-4.1': { provider: 'openai', verified: true },
  'openai/gpt-4.1-mini': { provider: 'openai', verified: true },
  'openai/gpt-4.1-nano': { provider: 'openai', verified: true },

  // OpenRouter (use when cheaper or when explicitly requested)
  'openrouter/google/gemini-2.5-flash-lite': { provider: 'openrouter', verified: true },
  'openrouter/anthropic/claude-3.7-sonnet': { provider: 'openrouter', verified: true },
  'openrouter/anthropic/claude-opus-4.1': { provider: 'openrouter', verified: true },
  'openrouter/openai/o3-mini-high': { provider: 'openrouter', verified: true },
};

/* ------------------------------
   Helpers
-------------------------------- */

function isModelAvailable(modelId, envelope = {}) {
  if (!modelId) return false;
  if (blacklistedModels.has(modelId)) return false;

  const m = modelHealth[modelId];
  if (!m) return false;

  const p = providerHealth[m.provider];
  if (!p || !p.configured) return false;

  // If you later want to enforce stricter rules based on dataSensitivity,
  // do it here deterministically (do not infer from prompt text).
  return m.verified === true;
}

function pickFirstAvailable(models, envelope) {
  for (const id of models) {
    if (isModelAvailable(id, envelope)) return id;
  }
  return null;
}

function safeHatLog(envelope, heading, lines) {
  const hat = envelope?.hat;
  const dataSensitivity = envelope?.dataSensitivity;
  if (!hat || !dataSensitivity) return;

  try {
    appendHatLog({ hat, dataSensitivity, heading, lines });
  } catch {
    // Best-effort only: routing must never throw.
  }
}

function normalizeTaskType(taskType) {
  if (!taskType) return 'unknown';
  return String(taskType).toLowerCase();
}

function normalizeTaskSize(taskSize) {
  if (!taskSize) return 'unknown';
  return String(taskSize).toLowerCase();
}

function isExplicitOpenRouterOpenAIRequest(envelope = {}) {
  return (
    typeof envelope.preferredModel === 'string' &&
    envelope.preferredModel.startsWith('openrouter/openai/')
  );
}

function loadHatProfiles() {
  try {
    const p = path.join(__dirname, 'hat-profiles.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j?.hats || {};
  } catch {
    return {};
  }
}

function hatDefaultChain(envelope = {}) {
  if (!envelope?.hat) return [];
  const hats = loadHatProfiles();
  const chain = hats?.[envelope.hat]?.defaultModelChain;
  return Array.isArray(chain) ? chain : [];
}

/* ------------------------------
   Routing Table (single source of truth)
-------------------------------- */

const ROUTES = {
  // Codex-first unless unavailable.
  code_ops: [
    'openai-codex/gpt-5.3-codex',
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],

  // Cheap-first while staying on Codex by default.
  lightweight: [
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openai-codex/gpt-5.3-codex',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],

  // Capability-first, codex primary, openrouter fallback.
  research_web: [
    'openai-codex/gpt-5.3-codex',
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openrouter/anthropic/claude-3.7-sonnet',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],

  social_drafting: [
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openai-codex/gpt-5.3-codex',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],

  spec_large: [
    'openai-codex/gpt-5.3-codex',
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openrouter/anthropic/claude-opus-4.1',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],

  default: [
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.2',
    'openai-codex/gpt-5.3-codex',
    'openrouter/nvidia/nemotron-nano-9b-v2:free',
  ],
};

function routeCategory(envelope = {}) {
  const t = normalizeTaskType(envelope.taskType);
  const s = normalizeTaskSize(envelope.taskSize);

  if (t === 'code' || t === 'ops') return { category: 'code_ops', requiresWebSearch: false };

  if (t === 'summarize' || t === 'classify' || t === 'triage') {
    return { category: 'lightweight', requiresWebSearch: false };
  }

  if (t === 'research' || t === 'web') return { category: 'research_web', requiresWebSearch: true };

  if (t === 'social' || t === 'draft' || t === 'copy') {
    return { category: 'social_drafting', requiresWebSearch: false };
  }

  if (t === 'spec' || s === 'large') return { category: 'spec_large', requiresWebSearch: false };

  return { category: 'default', requiresWebSearch: false };
}

/* ------------------------------
   Deterministic Routing
-------------------------------- */

function routeModel(envelope = {}) {
  const { category, requiresWebSearch } = routeCategory(envelope);

  // 1) Preferred override (only if available).
  if (envelope.preferredModel && isModelAvailable(envelope.preferredModel, envelope)) {
    safeHatLog(envelope, `${nowUtcStamp()} — model selection`, [
      `category: ${category}`,
      `model: ${envelope.preferredModel} (preferredModel)`,
    ]);

    return {
      model: envelope.preferredModel,
      reason: 'preferredModel',
      requiresWebSearch,
    };
  }

  // 2) Very complex coding path: codex first, then Claude Opus fallback.
  const isComplexCode =
    category === 'code_ops' &&
    (String(envelope.taskSize || '').toLowerCase() === 'large' ||
      ['high', 'xhigh'].includes(String(envelope.thinking || '').toLowerCase()));

  if (isComplexCode) {
    const complexChain = [
      'openai-codex/gpt-5.3-codex',
      'openrouter/anthropic/claude-opus-4.1',
      'openai-codex/gpt-5.2-codex',
      'openai-codex/gpt-5.2',
      'openrouter/nvidia/nemotron-nano-9b-v2:free',
    ];
    const complexModel = pickFirstAvailable(complexChain, envelope);
    if (complexModel) {
      safeHatLog(envelope, `${nowUtcStamp()} — model selection`, [
        `category: ${category}`,
        `model: ${complexModel} (complex_code_chain)`,
      ]);
      return {
        model: complexModel,
        reason: 'complex_code_chain',
        requiresWebSearch,
      };
    }
  }

  // 3) Hat-level default chain preference (from os/hat-profiles.json).
  const hatChain = hatDefaultChain(envelope);
  if (hatChain.length > 0) {
    const hatModel = pickFirstAvailable(hatChain, envelope);
    if (hatModel) {
      safeHatLog(envelope, `${nowUtcStamp()} — model selection`, [
        `category: ${category}`,
        `model: ${hatModel} (hat_default_chain)` ,
      ]);
      return {
        model: hatModel,
        reason: 'hat_default_chain',
        requiresWebSearch,
      };
    }
  }

  // 3) Deterministic category route.
  const route = ROUTES[category] || ROUTES.default;

  // Enforce the rule: only consider OpenRouter OpenAI models when explicitly requested.
  const filteredRoute = isExplicitOpenRouterOpenAIRequest(envelope)
    ? route
    : route.filter((m) => !String(m).startsWith('openrouter/openai/'));

  const model = pickFirstAvailable(filteredRoute, envelope) || pickFirstAvailable(ROUTES.default, envelope);

  safeHatLog(envelope, `${nowUtcStamp()} — model selection`, [
    `category: ${category}`,
    `model: ${model || '(none available)'} (${category})`,
    `requiresWebSearch: ${requiresWebSearch}`,
  ]);

  return {
    model: model || 'openai/gpt-5.2-chat-latest',
    reason: category,
    requiresWebSearch,
  };
}

/* ------------------------------
   Inventory
-------------------------------- */

function inventory() {
  return {
    providers: Object.entries(providerHealth).map(([k, v]) => ({ provider: k, ...v })),
    models: Object.entries(modelHealth).map(([id, v]) => ({ id, ...v })),
    routes: ROUTES,
    blacklistedModels: Array.from(blacklistedModels),
  };
}

module.exports = {
  providerHealth,
  modelHealth,
  blacklistedModels,
  isModelAvailable,
  routeModel,
  inventory,
};
