#!/usr/bin/env node
import { spawnSync } from 'child_process'

function run(args) {
  const r = spawnSync('node', args, { stdio: 'inherit' })
  return r.status ?? 1
}

// Refresh generated project_source docs only (no export)
let code = run(['/root/.openclaw/workspace/scripts/generate-project-source-core.mjs'])
if (code !== 0) process.exit(code)

code = run(['/root/.openclaw/workspace/scripts/generate-state-of-bort.mjs'])
process.exit(code)
