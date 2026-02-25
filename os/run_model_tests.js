#!/usr/bin/env node

// Self-tests for deterministic routing in os/model-routing.js
//
// Requirements:
// - Must pass without patching core OpenClaw
// - Must not require network
// - Must not throw on logging

const { routeModel } = require('./model-routing.js');

const mockEnvelope = (taskType, taskSize, dataSensitivity, promptText, preferredModel = null) => ({
  // Use a real/registered hat to avoid memory-log throws.
  hat: 'ops-core',
  taskType,
  taskSize,
  dataSensitivity,
  promptText: promptText || `This is a ${taskType} task.`,
  preferredModel,
  actions: [],
});

console.log('\n--- Self-Tests ---');

function assertEqual(name, got, expected) {
  if (got !== expected) {
    console.error(`${name} FAILED: expected ${expected} got ${got}`);
    process.exitCode = 1;
  }
}

function assertBool(name, got, expected) {
  if (Boolean(got) !== Boolean(expected)) {
    console.error(`${name} FAILED: expected ${expected} got ${got}`);
    process.exitCode = 1;
  }
}

// 1) summarize -> gemini flash-lite
{
  const env = mockEnvelope('summarize', 'medium', 'low');
  const r = routeModel(env);
  console.log(`Test 1 (Summarize): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 1', r.model, 'openrouter/google/gemini-2.5-flash-lite');
  assertBool('Test 1 requiresWebSearch', r.requiresWebSearch, false);
}

// 2) spec + large -> gpt-5.2-pro
{
  const env = mockEnvelope('spec', 'large', 'low');
  const r = routeModel(env);
  console.log(`Test 2 (Spec/Large): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 2', r.model, 'openai/gpt-5.2-pro');
  assertBool('Test 2 requiresWebSearch', r.requiresWebSearch, false);
}

// 3) explicit preferred OpenRouter OpenAI -> allow o3-mini-high
{
  const env = mockEnvelope(
    'research',
    'medium',
    'medium',
    'Analyze this request.',
    'openrouter/openai/o3-mini-high'
  );
  const r = routeModel(env);
  console.log(`Test 3 (Explicit OR OpenAI): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 3', r.model, 'openrouter/openai/o3-mini-high');
  assertBool('Test 3 requiresWebSearch', r.requiresWebSearch, true);
}

// 4) research default -> gpt-5.2-pro + requiresWebSearch
{
  const env = mockEnvelope('research', 'medium', 'low', 'Research the latest trends.');
  const r = routeModel(env);
  console.log(`Test 4 (Research): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 4', r.model, 'openai/gpt-5.2-pro');
  assertBool('Test 4 requiresWebSearch', r.requiresWebSearch, true);
}

// 5) code -> codex-first
{
  const env = mockEnvelope('code', 'large', 'high');
  const r = routeModel(env);
  console.log(`Test 5 (Code): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 5', r.model, 'openai-codex/gpt-5.2');
  assertBool('Test 5 requiresWebSearch', r.requiresWebSearch, false);
}

// 6) Explicit Preferred Model (available)
{
  const env = mockEnvelope('summarize', 'medium', 'low', 'Summarize this.', 'openrouter/anthropic/claude-3.7-sonnet');
  const r = routeModel(env);
  console.log(`Test 6 (Preferred Model - Available): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 6', r.model, 'openrouter/anthropic/claude-3.7-sonnet');
}

// 7) Explicit Preferred Model (unavailable) -> fallback to summarize primary
{
  const env = mockEnvelope('summarize', 'medium', 'low', 'Summarize this.', 'openrouter/nonexistent/model');
  const r = routeModel(env);
  console.log(`Test 7 (Preferred Model - Unavailable): Got ${r.model} (Reason: ${r.reason})`);
  assertEqual('Test 7', r.model, 'openrouter/google/gemini-2.5-flash-lite');
}

console.log('\nTests complete.');
