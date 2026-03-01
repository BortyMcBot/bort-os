#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const WORKSPACE = '/root/.openclaw/workspace'
const STATE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_state.json')
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')

function nowPhoenixIso() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date()).replace(',', '')
}

function parseUntilArg() {
  const args = process.argv.slice(2)
  const idx = args.indexOf('until')
  if (idx === -1 || !args[idx + 1]) return null
  return args[idx + 1]
}

async function main() {
  const until = parseUntilArg()
  if (!until) {
    console.error('Usage: autonomous_start.mjs until HH:MM')
    process.exit(2)
  }

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  const state = {
    active: true,
    startedAtPhoenix: nowPhoenixIso(),
    stopAtPhoenix: until,
    hat: 'autonomous',
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n')

  const log = `## ${nowPhoenixIso()} — autonomous start\n- stopAtPhoenix: ${until}\n- hat: autonomous\n`
  fs.appendFileSync(LOG_PATH, log + '\n')

  // Start guard process (self-terminates after stop time)
  const { spawn } = await import('child_process')
  const guard = spawn('node', ['/root/.openclaw/workspace/scripts/autonomous_guard.mjs'], {
    detached: true,
    stdio: 'ignore',
  })
  guard.unref()

  console.log('autonomous mode started')
}

main().catch(() => process.exit(1))
