#!/usr/bin/env node
import { spawnSync } from 'child_process'

// Thin wrapper used by workspace-level hooks (no systemd). Suppresses “no changes” noise,
// but will still print the update block if changes are detected.
const r = spawnSync('node', ['/root/.openclaw/workspace/scripts/export-project-source.mjs', '--quiet-no-changes'], {
  stdio: 'inherit',
})
process.exit(r.status ?? 0)
