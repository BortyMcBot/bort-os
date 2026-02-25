#!/usr/bin/env node

// Safe models inventory (no secrets).

const { inventory } = require('./model-routing');

const inv = inventory();

console.log('Providers (configured/verified):');
for (const p of inv.providers) {
  console.log(`- ${p.provider}: configured=${p.configured ? 'yes' : 'no'}, verified=${p.verified ? 'yes' : 'no'}`);
}

console.log('---');
console.log('Models (verified allowlist):');
for (const m of inv.models) {
  console.log(`- ${m.id} (provider=${m.provider}, verified=${m.verified ? 'yes' : 'no'})`);
}

console.log('---');
console.log('OpenAI fallback chain:');
for (const id of inv.openaiFallbackChain) {
  console.log(`- ${id}`);
}
