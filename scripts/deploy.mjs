#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { TELEGRAM_CHAT_ID, BORT_WORKSPACE } from '../os/constants.js'

const WORKSPACE = BORT_WORKSPACE
const LOG_PATH = path.join(WORKSPACE, 'logs', 'deploy.log')

const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (idx === -1) return null
  const arg = args[idx]
  if (arg.includes('=')) return arg.split('=').slice(1).join('=')
  return args[idx + 1] || null
}

const prNumber = getArg('--pr-number')
const prTitle = getArg('--pr-title')
const dryRun = args.includes('--dry-run')

if (!prNumber || !prTitle) {
  console.error('Missing required args: --pr-number and --pr-title')
  process.exit(1)
}

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function logLine(obj) {
  ensureLogDir()
  fs.appendFileSync(LOG_PATH, JSON.stringify(obj) + '\n')
}

function now() {
  return new Date().toISOString()
}

function run(cmd, opts = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`)
    return ''
  }
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim()
}

function runReadOnly(cmd, opts = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`)
  }
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim()
}

function sendTelegram(message) {
  const cmd = `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} --message ${JSON.stringify(message)}`
  return run(cmd)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollHealth(maxAttempts = 20, intervalMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (dryRun) {
        console.log(`[dry-run] openclaw gateway status (attempt ${attempt}/${maxAttempts})`)
        return { healthy: true, attempts: attempt }
      }
      run('openclaw gateway status', { stdio: 'pipe' })
      return { healthy: true, attempts: attempt }
    } catch (err) {
      if (attempt === maxAttempts) return { healthy: false, attempts: attempt, error: err }
      await sleep(intervalMs)
    }
  }
  return { healthy: false, attempts: maxAttempts }
}

async function main() {
  const context = {
    ts: now(),
    prNumber,
    prTitle,
    dryRun,
  }

  // Pull latest (mutating)
  try {
    if (dryRun) {
      run('git pull origin main', { cwd: WORKSPACE })
    } else {
      run('git pull origin main', { cwd: WORKSPACE })
    }
  } catch (err) {
    const msg = `🚨 Deploy failed for PR #${prNumber}: git pull failed. Manual intervention required.`
    if (!dryRun) sendTelegram(msg)
    logLine({ ...context, action: 'pull-failed', error: err.message })
    process.exit(1)
  }

  // Determine changed files (read-only)
  const diffOut = runReadOnly('git diff --name-only HEAD~1 HEAD', { cwd: WORKSPACE })
  const changedFiles = diffOut ? diffOut.split('\n').filter(Boolean) : []
  const restartRequired = changedFiles.some((f) => f.startsWith('os/') || f.startsWith('scripts/'))

  console.log(`Changed files: ${changedFiles.length ? changedFiles.join(', ') : '(none)'}`)
  console.log(`Restart required: ${restartRequired}`)

  if (!restartRequired) {
    const msg = `🚀 Deployed PR #${prNumber}: ${prTitle} (no restart needed)`
    if (!dryRun) sendTelegram(msg)
    logLine({ ...context, action: 'no-restart', changedFiles, outcome: 'ok' })
    return
  }

  const prevCommit = runReadOnly('git rev-parse HEAD~1', { cwd: WORKSPACE })

  const restartStart = Date.now()
  run('openclaw gateway restart')
  const health = await pollHealth(20, 3000)
  const restartDurationMs = Date.now() - restartStart

  if (health.healthy) {
    const msg = `🚀 Deployed PR #${prNumber}: ${prTitle} (OpenClaw restarted)`
    if (!dryRun) sendTelegram(msg)
    logLine({
      ...context,
      action: 'restart',
      changedFiles,
      restartDurationMs,
      outcome: 'ok',
      healthAttempts: health.attempts,
    })
    return
  }

  // Rollback
  run(`git reset --hard ${prevCommit}`, { cwd: WORKSPACE })
  const rollbackStart = Date.now()
  run('openclaw gateway restart')
  const rollbackHealth = await pollHealth(20, 3000)
  const rollbackDurationMs = Date.now() - rollbackStart

  if (rollbackHealth.healthy) {
    const msg = `🚨 Deploy failed PR #${prNumber}: ${prTitle} — rolled back to previous commit. OpenClaw is healthy.`
    if (!dryRun) sendTelegram(msg)
    logLine({
      ...context,
      action: 'rollback',
      changedFiles,
      restartDurationMs,
      rollbackDurationMs,
      outcome: 'rolled-back-healthy',
      healthAttempts: health.attempts,
      rollbackHealthAttempts: rollbackHealth.attempts,
    })
    return
  }

  const msg = `🚨 CRITICAL: Deploy failed PR #${prNumber} and rollback failed. OpenClaw may be down. Immediate attention required.`
  if (!dryRun) sendTelegram(msg)
  logLine({
    ...context,
    action: 'rollback-failed',
    changedFiles,
    restartDurationMs,
    rollbackDurationMs,
    outcome: 'critical',
    healthAttempts: health.attempts,
    rollbackHealthAttempts: rollbackHealth.attempts,
  })
  process.exit(1)
}

main()
