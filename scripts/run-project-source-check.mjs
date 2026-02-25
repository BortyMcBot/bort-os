#!/usr/bin/env node
import { spawnSync } from 'child_process'

// Thin wrapper used by workspace-level hooks (no systemd).
// Enforces documentation integrity by classifying drift (cosmetic/structural/behavioral)
// and blocking silent reconciliation on HIGH-severity behavioral drift.
const r = spawnSync('node', ['/root/.openclaw/workspace/scripts/arch-drift-check.mjs'], {
  stdio: 'inherit',
})
process.exit(r.status ?? 0)
