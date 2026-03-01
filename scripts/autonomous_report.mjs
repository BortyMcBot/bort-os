#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const WORKSPACE = '/root/.openclaw/workspace'
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')
const REPORT_PATH = path.join(WORKSPACE, 'memory', 'autonomous_report.md')

function run(cmd, cwd) {
  const r = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8' })
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}

function collectPrs() {
  const bort = run('gh pr list --limit 10 --json number,title,headRefName,url --repo BortyMcBot/bort-os', WORKSPACE)
  const site = run('gh pr list --limit 10 --json number,title,headRefName,url', path.join(WORKSPACE, 'external', 'personal-website'))

  return {
    bort: bort.out || '[]',
    site: site.out || '[]',
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

  const msg = `Autonomous run completed. PR report generated at ${REPORT_PATH}.`
  run(`openclaw message send --channel telegram --target 8374853956 --message ${JSON.stringify(msg)}`, WORKSPACE)
}

main()
