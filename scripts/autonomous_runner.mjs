#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const WORKSPACE = '/root/.openclaw/workspace'
const STATE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_state.json')
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')
const RUN_QUEUE = path.join(WORKSPACE, 'memory', 'autonomous_queue.md')

function nowPhoenix() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date()).replace(',', '')
}

function readState() {
  if (!fs.existsSync(STATE_PATH)) return null
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) } catch { return null }
}

function log(line) {
  fs.appendFileSync(LOG_PATH, `${line}\n`)
}

function ensureQueue() {
  if (fs.existsSync(RUN_QUEUE)) return
  const seed = [
    '# AUTONOMOUS_QUEUE.md',
    '',
    '## Bort‑OS candidates',
    '- Add X token refresh hardening (PR‑only)',
    '- Add model availability audit job (PR‑only)',
    '- Improve repo hygiene automation (PR‑only)',
    '',
    '## Personal‑website candidates',
    '- UX polish: spacing/typography cleanup (PR‑only)',
    '- Add “Now” or “Highlights” section (PR‑only)',
    '- Performance: lazy‑load heavy components (PR‑only)',
    '',
  ].join('\n')
  fs.writeFileSync(RUN_QUEUE, seed + '\n')
}

function main() {
  const state = readState()
  if (!state || state.active !== true) return

  // Generate a fresh queue at start of each autonomous window
  spawnSync('node', ['/root/.openclaw/workspace/scripts/autonomous_generate_queue.mjs'], { stdio: 'inherit' })

  ensureQueue()
  log(`## ${nowPhoenix()} — autonomous runner tick`)
  log('- status: queue_generated')
  log('- note: execution will be added to consume queue without human prompts')
}

main()
