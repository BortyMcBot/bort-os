#!/usr/bin/env node

// Routing self-test: prints chosen model ids and flags for the current routing policy.
// Keep this aligned with os/model-routing.js; do not assume legacy Gemini/OpenAI Pro expectations.

const { routeModel } = require('./model-routing');

const base = {
  hat: 'ops-core',
  intent: 'selftest',
  risk: 'low',
  dataSensitivity: 'medium',
  externalStateChange: false,
  identityContext: 'agent',
  actions: ['selftest'],
  approvalNeeded: false,
};

const cases = [
  { taskType: 'code', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'ops', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'summarize', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'classify', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'triage', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'spec', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'spec', taskSize: 'large', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'research', taskSize: 'medium', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'web', taskSize: 'medium', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'social', taskSize: 'small', expectedModel: 'openai-codex/gpt-5.4' },
  { taskType: 'research', taskSize: 'medium', preferredModel: 'openrouter/openai/o3-mini-high', expectedModel: 'openai-codex/gpt-5.4' },
];

for (const c of cases) {
  const r = routeModel({ ...base, ...c });
  console.log(
    JSON.stringify(
      {
        taskType: c.taskType,
        taskSize: c.taskSize,
        preferredModel: c.preferredModel || null,
        expectedModel: c.expectedModel || null,
        model: r.model,
        reason: r.reason,
        requiresWebSearch: r.requiresWebSearch,
      },
      null,
      0
    )
  );
}
