#!/usr/bin/env node

// Routing self-test: prints chosen model ids and flags.

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
  { taskType: 'code', taskSize: 'small' },
  { taskType: 'ops', taskSize: 'small' },
  { taskType: 'summarize', taskSize: 'small' },
  { taskType: 'classify', taskSize: 'small' },
  { taskType: 'triage', taskSize: 'small' },
  { taskType: 'spec', taskSize: 'small' },
  { taskType: 'spec', taskSize: 'large' },
  { taskType: 'research', taskSize: 'medium' },
  { taskType: 'web', taskSize: 'medium' },
  { taskType: 'social', taskSize: 'small' },
  { taskType: 'research', taskSize: 'medium', preferredModel: 'openrouter/openai/o3-mini-high' },
];

for (const c of cases) {
  const r = routeModel({ ...base, ...c });
  console.log(
    JSON.stringify(
      {
        taskType: c.taskType,
        taskSize: c.taskSize,
        preferredModel: c.preferredModel || null,
        model: r.model,
        reason: r.reason,
        requiresWebSearch: r.requiresWebSearch,
      },
      null,
      0
    )
  );
}
