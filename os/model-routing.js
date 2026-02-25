// Project 1: Deterministic task-based model routing (design + enforcement helper)
//
// Goals:
// - taskType + taskSize in Task Envelope
// - deterministic routing
// - availability gating via verified provider/model table
// - silent fallback to OpenAI chain; log warnings to hat memory file
// - research: require Brave web_search first, then synthesize

const { appendHatLog, nowUtcStamp } = require('./memory-log');

// Providers/models that are configured + verified.
// Keep conservative: only mark verified=true when we have a working auth profile + probe.
const providerHealth = {
  openai: { configured: true, verified: true },
  'openai-codex': { configured: true, verified: true },

  // OpenRouter (single key) provides access to Claude/Gemini/Grok/etc.
  openrouter: { configured: true, verified: true },

  // Placeholders (not wired here):
  anthropic: { configured: false, verified: false },
  google: { configured: false, verified: false },
  xai: { configured: false, verified: false },
};

// Explicit blacklist: if referenced anywhere, treat as unavailable and fall back silently.
const blacklistedModels = new Set([
  'openrouter/openrouter/auto',
  'openrouter/auto',
]);

// Model availability table (explicit allowlist).
// Only list models we know the runtime can call.
const modelHealth = {
  // OpenAI / Codex
  'openai-codex/gpt-5.2': { provider: 'openai-codex', verified: true },
  'openai/gpt-5.2-pro': { provider: 'openai', verified: true },
  'openai/gpt-5.2-chat-latest': { provider: 'openai', verified: true },

  // OpenRouter verified starters (explicit; no auto routing)
  'openrouter/google/gemini-2.5-flash-lite': { provider: 'openrouter', verified: true },
  'openrouter/anthropic/claude-3.7-sonnet': { provider: 'openrouter', verified: true },
  'openrouter/openai/o3-mini-high': { provider: 'openrouter', verified: true },
};

const openaiFallbackChain = [
  'openai-codex/gpt-5.2',
  'openai/gpt-5.2-pro',
  'openai/gpt-5.2-chat-latest',
];

function isModelAvailable(modelId, { dataSensitivity }) {
  if (!modelId) return false;
  if (blacklistedModels.has(modelId)) return false;

  const m = modelHealth[modelId];
  if (!m) return false;

  const p = providerHealth[m.provider];
  if (!p || !p.configured) return false;

  // For high-sensitivity, only allow non-OpenAI providers if provider verified=true.
  if (dataSensitivity === 'high') {
    const isOpenAIish = m.provider === 'openai' || m.provider === 'openai-codex';
    if (!isOpenAIish && !p.verified) return false;
  }

  // Model itself must be marked verified.
  return m.verified === true;
}

function pickFirstAvailable(models, envelope) {
  for (const id of models) {
    if (isModelAvailable(id, envelope)) return id;
  }
  return null;
}

function routeModel(envelope) {
  // Envelope required fields are validated in preflight.
  const { hat, taskType, taskSize, dataSensitivity } = envelope;

  // preferredModel override (availability gated). If unavailable, silently fall back.
  if (envelope.preferredModel) {
    if (isModelAvailable(envelope.preferredModel, envelope)) {
      return { model: envelope.preferredModel, reason: 'preferredModel' };
    }

    appendHatLog({
      hat,
      dataSensitivity,
      heading: `${nowUtcStamp()} — model routing warning`,
      lines: [`preferredModel unavailable → falling back (model id suppressed)`],
    });
  }

  // code|ops: keep Codex as primary.
  if (taskType === 'code' || taskType === 'ops') {
    return { model: 'openai-codex/gpt-5.2', reason: 'code/ops default' };
  }

  // summarize|classify → Gemini flash-lite (if verified) else fallback.
  if (taskType === 'summarize' || taskType === 'classify') {
    const model =
      pickFirstAvailable(['openrouter/google/gemini-2.5-flash-lite'], envelope) ||
      pickFirstAvailable(['openai/gpt-5.2-chat-latest'], envelope) ||
      'openai/gpt-5.2-chat-latest';
    return { model, reason: 'summarize/classify' };
  }

  // spec → Claude (especially for large) else OpenAI pro.
  if (taskType === 'spec') {
    const preferred = pickFirstAvailable(['openrouter/anthropic/claude-3.7-sonnet'], envelope);
    if (preferred) {
      return { model: preferred, reason: taskSize === 'large' ? 'spec large' : 'spec' };
    }
    const model = pickFirstAvailable(['openai/gpt-5.2-pro'], envelope) || 'openai/gpt-5.2-pro';
    return { model, reason: 'spec fallback' };
  }

  // research → ALWAYS web_search first, then synthesize with o3-mini-high (if verified)
  if (taskType === 'research') {
    const model =
      pickFirstAvailable(['openrouter/openai/o3-mini-high'], envelope) ||
      pickFirstAvailable(['openai/gpt-5.2-pro'], envelope) ||
      'openai/gpt-5.2-pro';
    return { model, reason: 'research synth', requiresWebSearch: true };
  }

  // Catch-all
  return { model: 'openai-codex/gpt-5.2', reason: 'fallback' };
}

function inventory() {
  const providers = Object.entries(providerHealth).map(([k, v]) => ({ provider: k, ...v }));
  const models = Object.entries(modelHealth).map(([id, v]) => ({ id, ...v }));
  return {
    providers,
    models,
    openaiFallbackChain,
    blacklistedModels: Array.from(blacklistedModels),
  };
}

module.exports = {
  providerHealth,
  modelHealth,
  openaiFallbackChain,
  blacklistedModels,
  isModelAvailable,
  routeModel,
  inventory,
};
