#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const WORKSPACE = '/root/.openclaw/workspace'
const QUEUE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_queue.json')
const LOG_PATH = path.join(WORKSPACE, 'memory', 'autonomous_log.md')

const PR_BODY_PATH = '/tmp/autonomy_pr_body.md'

function nowPhoenix() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date()).replace(',', '')
}

function log(line) {
  fs.appendFileSync(LOG_PATH, `${line}\n`)
}

function run(cmd, cwd) {
  const r = spawnSync(cmd, { shell: true, cwd, stdio: 'inherit' })
  return r.status ?? 1
}

function ensureQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return null
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')) } catch { return null }
}

function readPolicy() {
  const p = path.join(WORKSPACE, 'autonomous_policy.json')
  if (!fs.existsSync(p)) {
    return { prCap: 3, requireTests: true, noTouch: [], scoringWeights: { impact: 0.5, risk: 0.3, effort: 0.2 } }
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch {
    return { prCap: 3, requireTests: true, noTouch: [], scoringWeights: { impact: 0.5, risk: 0.3, effort: 0.2 } }
  }
}

function scoreTask(task, weights) {
  const impact = task.impact ?? 0.5
  const risk = task.risk ?? 0.5
  const effort = task.effort ?? 0.5
  return impact * weights.impact - risk * weights.risk - effort * weights.effort
}

function writePRBody({ summary, testing }) {
  const body = `## Summary\n${summary}\n\n## Testing\n${testing || 'Not run.'}\n`
  fs.writeFileSync(PR_BODY_PATH, body)
}

function execBortOsTask(task, policy) {
  if (task.id === 'bort-os:secrets-policy') {
    const repo = WORKSPACE
    run('git checkout -b autonomous/secrets-policy', repo)
    const secrets = [
      '# SECRETS.md',
      '',
      '## Rules',
      '- Never commit secrets or tokens.',
      '- Store secrets only in approved env/config paths.',
      '- Rotate keys if exposure is suspected.',
      '',
      '## Where secrets should live',
      '- /root/.openclaw/openclaw.json (env.vars)',
      '- /root/.openclaw/secrets/* (file-based tokens)',
      '',
      '## Guardrails',
      '- Run `git status` before commits.',
      '- Use `.gitignore` to block secret paths.',
      '- Avoid logging env vars in chat.',
      '',
    ].join('\n')
    fs.writeFileSync(path.join(WORKSPACE, 'SECRETS.md'), secrets)

    run('git add SECRETS.md SECURITY.md', repo)
    run('git commit -m "docs(security): add secrets handling policy"', repo)

    if (policy.requireTests) {
      // docs-only; no tests required
    }

    run('git push -u origin autonomous/secrets-policy', repo)

    writePRBody({
      summary: 'Adds SECRETS.md with explicit guardrails and references.',
      testing: 'Not run (docs only).',
    })
    run(`gh pr create --title "Security: add secrets handling policy" --body-file ${PR_BODY_PATH} --base main --head autonomous/secrets-policy`, repo)
    return
  }
}

function execPersonalWebsiteTask(task, policy) {
  const repo = path.join(WORKSPACE, 'external', 'personal-website')
  if (task.id === 'personal-website:now-section') {
    run('git checkout -b autonomous/now-section', repo)

    const nowSection = `import { site } from '@/lib/site';\nimport { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';\n\nexport function NowSection() {\n  if (!site.now || site.now.length === 0) return null;\n  return (\n    <Card>\n      <CardHeader>\n        <CardTitle className=\"text-base font-normal tracking-tight\">Now</CardTitle>\n        <CardDescription>What I'm focused on right now</CardDescription>\n      </CardHeader>\n      <CardContent>\n        <ul className=\"list-disc pl-5\">\n          {site.now.map((item) => (\n            <li key={item}>{item}</li>\n          ))}\n        </ul>\n      </CardContent>\n    </Card>\n  );\n}\n`;
    fs.writeFileSync(path.join(repo, 'src/components/home/nowSection.tsx'), nowSection)

    const sitePath = path.join(repo, 'src/lib/site.ts')
    const site = fs.readFileSync(sitePath, 'utf8')
    const patch = site.replace(
      /\n};\n$/,
      `\n  now: [\n    "Working on autonomous agent workflows",\n    "Tuning model routing and reliability",\n    "Building a durable personal site",\n  ],\n};\n`
    )
    fs.writeFileSync(sitePath, patch)

    const pagePath = path.join(repo, 'src/app/page.tsx')
    let page = fs.readFileSync(pagePath, 'utf8')
    if (!page.includes('NowSection')) {
      page = page.replace(
        "import { DaysAlive } from '@/components/home/daysAlive';",
        "import { DaysAlive } from '@/components/home/daysAlive';\nimport { NowSection } from '@/components/home/nowSection';"
      )
      page = page.replace(
        '</div>\n            </div>\n            <div>',
        '</div>\n            </div>\n            <div className=\"mb-4\">\n              <NowSection />\n            </div>\n            <div>'
      )
    }
    fs.writeFileSync(pagePath, page)

    run('git add src/components/home/nowSection.tsx src/lib/site.ts src/app/page.tsx', repo)
    run('git commit -m "feat(ui): add configurable Now section"', repo)

    if (policy.requireTests) {
      // UI-only; no tests required
    }

    run('git push -u origin autonomous/now-section', repo)

    writePRBody({
      summary: 'Adds a configurable “Now” section driven by site config.',
      testing: 'Not run (UI changes only).',
    })
    run(`gh pr create --title "UI: add configurable Now section" --body-file ${PR_BODY_PATH} --base main --head autonomous/now-section`, repo)
  }
}

function main() {
  const queue = ensureQueue()
  if (!queue || !Array.isArray(queue.tasks)) return

  const policy = readPolicy()
  const weights = policy.scoringWeights || { impact: 0.5, risk: 0.3, effort: 0.2 }

  const tasks = queue.tasks
    .map((t) => ({ ...t, _score: scoreTask(t, weights) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, policy.prCap || 3)

  log(`## ${nowPhoenix()} — autonomous execute queue`)
  log(`- prCap: ${policy.prCap || 3}`)

  for (const task of tasks) {
    log(`- executing: ${task.id}`)
    if (task.repo === 'bort-os') execBortOsTask(task, policy)
    if (task.repo === 'personal-website') execPersonalWebsiteTask(task, policy)
  }
}

main()
