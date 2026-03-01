#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const WORKSPACE = '/root/.openclaw/workspace'
const STATE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_state.json')
const STOP_SCRIPT = path.join(WORKSPACE, 'scripts', 'autonomous_stop.mjs')

function nowPhoenix() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date()).replace(',', '')
}

function toMinutes(hhmm) {
  const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '')
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function currentMinutes() {
  const stamp = nowPhoenix()
  const parts = stamp.split(' ')
  if (parts.length < 2) return null
  const [h, m] = parts[1].split(':').map((v) => parseInt(v, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function readState() {
  if (!fs.existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function stopAutonomous() {
  const { spawnSync } = require('child_process')
  spawnSync('node', [STOP_SCRIPT], { stdio: 'inherit' })
}

function tick() {
  const state = readState()
  if (!state || state.active !== true) return process.exit(0)
  const stopAt = toMinutes(state.stopAtPhoenix)
  const now = currentMinutes()
  if (stopAt == null || now == null) return
  if (now >= stopAt) {
    stopAutonomous()
    process.exit(0)
  }
}

function main() {
  tick()
  setInterval(tick, 5 * 60 * 1000)
}

main()
