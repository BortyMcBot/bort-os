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

async function main() {
  if (fs.existsSync(STATE_PATH)) {
    const cur = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    cur.active = false
    cur.stoppedAtPhoenix = nowPhoenixIso()
    fs.writeFileSync(STATE_PATH, JSON.stringify(cur, null, 2) + '\n')
  }

  const log = `## ${nowPhoenixIso()} — autonomous stop\n`
  fs.appendFileSync(LOG_PATH, log + '\n')

  // Generate report at stop
  const { spawnSync } = await import('child_process')
  spawnSync('node', ['/root/.openclaw/workspace/scripts/autonomous_report.mjs'], { stdio: 'inherit' })

  console.log('autonomous mode stopped')
}

main().catch(() => process.exit(1))
