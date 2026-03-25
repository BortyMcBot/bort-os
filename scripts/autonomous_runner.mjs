#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import constants from '../os/constants.js'

const { BORT_WORKSPACE: WORKSPACE } = constants
const STATE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_state.json')
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')

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

function mainLoop() {
  const state = readState()
  if (!state || state.active !== true) return

  runOnce()
  setInterval(runOnce, 10 * 60 * 1000)
}

function runOnce() {
  const state = readState()
  if (!state || state.active !== true) return

  // Generate a fresh queue at start of each autonomous window
  const gen = spawnSync('node', [path.join(WORKSPACE, 'scripts', 'autonomous_generate_queue.mjs')], { stdio: 'inherit' })

  log(`## ${nowPhoenix()} — autonomous runner tick`)
  if ((gen.status ?? 1) !== 0) {
    log(`- status: queue_generate_failed (code=${gen.status ?? 1})`)
    return
  }
  log('- status: queue_generated')

  const exec = spawnSync('node', [path.join(WORKSPACE, 'scripts', 'autonomous_execute_queue.mjs')], { stdio: 'inherit' })
  if ((exec.status ?? 1) !== 0) {
    log(`- status: queue_execute_failed (code=${exec.status ?? 1})`)
    return
  }
  log('- status: queue_executed')
}


mainLoop()
