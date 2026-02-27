#!/usr/bin/env node
import { spawnSync } from 'child_process'

// Thin wrapper used by workspace-level hooks (no systemd).
// Preflight mode: drift-check only (no refresh/export side effects).
const r = spawnSync('node', ['/root/.openclaw/workspace/scripts/arch-drift-check.mjs'], {
  stdio: 'inherit',
})
process.exit(r.status ?? 0)
