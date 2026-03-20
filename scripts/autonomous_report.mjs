#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import constants from '../os/constants.js'

const { TELEGRAM_CHAT_ID, BORT_WORKSPACE } = constants
const WORKSPACE = BORT_WORKSPACE
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')
const REPORT_PATH = path.join(WORKSPACE, 'memory', 'autonomous_report.md')

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8' })
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}

function collectPrs() {
  const bort = run('gh', ['pr', 'list', '--limit', '10', '--json', 'number,title,headRefName,url', '--repo', 'BortyMcBot/bort-os'], WORKSPACE)
  const siteRepo = process.env.PERSONAL_WEBSITE_REPO || path.join(WORKSPACE, 'tmp', 'site-review', 'repo')
  const site = fs.existsSync(siteRepo)
    ? run('gh', ['pr', 'list', '--limit', '10', '--json', 'number,title,headRefName,url'], siteRepo)
    : { out: '[]' }

  return {
    bort: bort.code === 0 ? (bort.out || '[]') : `ERROR: gh pr list failed (${bort.code})${bort.err ? ` — ${bort.err}` : ''}`,
    site: site.code === 0 ? (site.out || '[]') : `ERROR: gh pr list failed (${site.code})${site.err ? ` — ${site.err}` : ''}`,
  }
}

function main() {
  const prs = collectPrs()
  const content = [
    '# Autonomous Mode Report',
    '',
    '## Bort‑OS PRs',
    prs.bort,
    '',
    '## Personal‑website PRs',
    prs.site,
    '',
  ].join('\n')

  fs.writeFileSync(REPORT_PATH, content + '\n')

  if (fs.existsSync(LOG_PATH)) {
    fs.appendFileSync(LOG_PATH, `\n## report generated\n- path: ${REPORT_PATH}\n`)
  }

  let bortList = []
  let siteList = []
  try { bortList = JSON.parse(prs.bort) } catch {}
  try { siteList = JSON.parse(prs.site) } catch {}

  const fmt = (arr) =>
    arr.length
      ? arr.map((p) => `- #${p.number} ${p.title}\n  ${p.url}`).join('\n')
      : '- (none)'

  const msg = [
    'Autonomous run completed. PR report:',
    '',
    'Bort‑OS PRs:',
    prs.bort.startsWith('ERROR:') ? prs.bort : fmt(bortList),
    '',
    'Personal‑website PRs:',
    prs.site.startsWith('ERROR:') ? prs.site : fmt(siteList),
  ].join('\n')

  run('openclaw', ['message', 'send', '--channel', 'telegram', '--target', String(TELEGRAM_CHAT_ID), '--message', String(msg)], WORKSPACE)
}

main()
