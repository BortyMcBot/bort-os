#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { TELEGRAM_CHAT_ID, BORT_WORKSPACE } from '../os/constants.js'

const WORKSPACE = BORT_WORKSPACE
const REPO = process.env.BORT_OS_REPO || 'BortyMcBot/bort-os'
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const phaseArg = process.argv.find((a) => a.startsWith('--phase='))
const onlyPhase = phaseArg ? phaseArg.split('=')[1] : null

const TODAY = new Date().toISOString().slice(0, 10)
const SELF_REVIEW_DIR = path.join(WORKSPACE, 'docs', 'self-review')
const FINDINGS_DIR = path.join(SELF_REVIEW_DIR, 'findings')
const RESEARCH_DIR = path.join(SELF_REVIEW_DIR, 'research')
const PLANS_DIR = path.join(SELF_REVIEW_DIR, 'plans')
const STALENESS_STATE_PATH = '/tmp/pr-staleness-state.json'

const LEARNINGS_DIR = path.join(WORKSPACE, '.learnings')

const HIGH_RISK_FILES = ['os/preflight.js', 'os/model-routing.js', 'os/hat-profiles.json']

const REVIEW_DIRS = ['scripts/', 'integrations/', 'hats/', 'os/', 'skills/']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  if (dryRun && !opts.allowDryRun) {
    console.log(`[dry-run] ${cmd}`)
    return ''
  }
  return execSync(cmd, { encoding: 'utf8', cwd: WORKSPACE, ...opts }).trim()
}

function sendTelegram(message) {
  const cmd = `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} --message ${JSON.stringify(message)}`
  run(cmd)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function now() {
  return new Date().toISOString()
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function collectFiles() {
  const files = []
  for (const dir of REVIEW_DIRS) {
    const full = path.join(WORKSPACE, dir)
    if (!fs.existsSync(full)) continue
    walkDir(full, files)
  }
  return files
}

function walkDir(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walkDir(full, out)
    } else {
      out.push(full)
    }
  }
}

function relPath(absPath) {
  return path.relative(WORKSPACE, absPath)
}

function isHighRisk(filePath) {
  const rel = relPath(filePath)
  return HIGH_RISK_FILES.includes(rel)
}

// Group files by directory for batch review
function groupFiles(files) {
  const groups = new Map()
  for (const f of files) {
    const rel = relPath(f)
    const dir = path.dirname(rel)
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir).push(f)
  }
  return groups
}

// ---------------------------------------------------------------------------
// .learnings/ integration (self-improving-agent)
// ---------------------------------------------------------------------------

function loadLearnings() {
  const files = ['LEARNINGS.md', 'ERRORS.md']
  const sections = []

  for (const file of files) {
    const filePath = path.join(LEARNINGS_DIR, file)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf8').trim()
    // Skip files that only have the header template
    const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#') && l !== '---')
    if (lines.length === 0) continue
    sections.push(`=== .learnings/${file} ===\n${content}`)
  }

  return sections.length > 0 ? sections.join('\n\n') : ''
}

// ---------------------------------------------------------------------------
// Phase 1 — Code Review Pass
// ---------------------------------------------------------------------------

function runCodeReview() {
  console.log(`\n=== Phase 1: Code Review Pass (${now()}) ===\n`)

  const files = collectFiles()
  console.log(`Found ${files.length} files to review.`)

  const learnings = loadLearnings()
  if (learnings) {
    console.log(`Loaded runtime learnings from .learnings/ for review context.`)
  }

  const groups = groupFiles(files)
  const allFindings = []

  for (const [dir, groupFiles_] of groups) {
    const fileList = groupFiles_.map(relPath).join('\n  ')
    console.log(`Reviewing group: ${dir}/ (${groupFiles_.length} files)`)

    const prompt = [
      'You are a code reviewer for the bort-os project, an AI agent runtime.',
      'Review the following files for:',
      '- Dead code or unreachable branches',
      '- Redundant logic that can be consolidated',
      '- Missing error handling',
      '- Hardcoded values that should be config-driven',
      '- Performance inefficiencies',
      '- Inconsistencies with established patterns in the codebase',
      '',
      `Files in ${dir}/:`,
      `  ${fileList}`,
      '',
      'For each finding, output EXACTLY this format (one block per finding):',
      '---FINDING---',
      'FILE: <relative path>',
      'SEVERITY: HIGH|MEDIUM|LOW',
      'DESCRIPTION: <one-line description>',
      'SUGGESTION: <one-line fix suggestion>',
      '---END---',
      '',
      'If no findings, output: ---NO-FINDINGS---',
    ].join('\n')

    try {
      const fileContents = groupFiles_.map((f) => {
        const rel = relPath(f)
        const content = fs.readFileSync(f, 'utf8')
        return `=== ${rel} ===\n${content}`
      }).join('\n\n')

      const learningsSection = learnings
        ? `\n\nRuntime learnings (from self-improving-agent — use these as additional context for your review, especially recurring errors or known issues):\n${learnings}\n`
        : ''
      const combinedPrompt = `${prompt}${learningsSection}\n\nFile contents:\n${fileContents}`
      const tmpPrompt = `/tmp/self-review-prompt-${slugify(dir)}.txt`
      fs.writeFileSync(tmpPrompt, combinedPrompt)

      const result = run(
        `openclaw agent run --prompt-file ${tmpPrompt}`,
        { timeout: 120_000 }
      )

      const reviewedSet = new Set(groupFiles_.map(relPath))
      const findings = parseFindings(result, dir, reviewedSet)
      allFindings.push(...findings)

      try { fs.unlinkSync(tmpPrompt) } catch { /* ignore */ }
    } catch (err) {
      console.log(`  Warning: review failed for ${dir}/: ${err.message}`)
    }
  }

  console.log(`\nTotal findings: ${allFindings.length}`)
  return { findings: allFindings, fileCount: files.length }
}

function parseFindings(output, dir, reviewedSet) {
  const findings = []
  const blocks = output.split('---FINDING---')
  for (const block of blocks) {
    if (!block.includes('---END---')) continue
    const content = block.split('---END---')[0]
    const file = content.match(/FILE:\s*(.+)/)?.[1]?.trim()
    const severity = content.match(/SEVERITY:\s*(HIGH|MEDIUM|LOW)/)?.[1]?.trim()
    const description = content.match(/DESCRIPTION:\s*(.+)/)?.[1]?.trim()
    const suggestion = content.match(/SUGGESTION:\s*(.+)/)?.[1]?.trim()
    if (!file || !severity || !description) continue

    // Validate the file was actually in the reviewed set — reject hallucinated paths
    if (!reviewedSet.has(file)) {
      console.log(`  Skipping finding for ${file} — not in reviewed file set for ${dir}/`)
      continue
    }

    findings.push({ file, severity, description, suggestion: suggestion || '', dir })
  }
  return findings
}

function createFixPRs(findings) {
  const prsOpened = []
  const actionable = findings.filter((f) => f.severity === 'HIGH' || f.severity === 'MEDIUM')

  // Group actionable findings by file to avoid multiple PRs for the same file
  const byFile = new Map()
  for (const f of actionable) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }

  for (const [file, fileFindings] of byFile) {
    const slug = slugify(file.replace(/[/\\]/g, '-'))
    const branch = `bort/self-review-${TODAY}-${slug}`
    const highRisk = isHighRisk(path.join(WORKSPACE, file))
    const riskTag = highRisk ? ' [HIGH RISK]' : ''

    const prTitle = `fix: [SELF-REVIEW] ${fileFindings[0].description.slice(0, 60)}`

    const bodyLines = [
      '## Self-Review Finding',
      '',
      `**Date:** ${TODAY}`,
      `**File:** ${file}`,
      highRisk ? `**⚠️ HIGH RISK FILE** — ${file} is a dangerous file per CLAUDE.md. Review with extra care.` : '',
      '',
      '## Findings',
      '',
      ...fileFindings.map((f, i) => [
        `### ${i + 1}. ${f.description}`,
        `- **Severity:** ${f.severity}`,
        `- **Suggestion:** ${f.suggestion}`,
        '',
      ].join('\n')),
      '## Risk Level',
      '',
      highRisk
        ? '⚠️ **HIGH RISK** — This PR modifies a dangerous file. Requires Bryan\'s explicit approval.'
        : `Standard risk (${fileFindings[0].severity})`,
      '',
      '## Rollback',
      '',
      `Revert this PR's merge commit to roll back changes.`,
      '',
      '---',
      '*Generated by Bort self-review pipeline*',
    ].filter(Boolean)

    const bodyPath = `/tmp/pr-body-${slug}.md`

    try {
      // Create branch from main
      run(`git checkout main`)
      run(`git pull --ff-only`)
      run(`git checkout -b ${branch}`)

      // Shell out to agent to implement the fix
      const fixPrompt = [
        `Fix the following issue in ${file}:`,
        ...fileFindings.map((f) => `- ${f.severity}: ${f.description}. Suggestion: ${f.suggestion}`),
        '',
        highRisk ? 'WARNING: This is a HIGH RISK file. Make minimal, targeted changes only.' : '',
        'Make the minimal change needed. Do not refactor surrounding code.',
      ].filter(Boolean).join('\n')

      const tmpFixPrompt = `/tmp/self-review-fix-${slug}.txt`
      fs.writeFileSync(tmpFixPrompt, fixPrompt)

      run(`openclaw agent run --prompt-file ${tmpFixPrompt}`, { timeout: 120_000 })

      // Enforce clean worktree: only the target file may be changed.
      // Use git status --porcelain to catch unstaged edits, staged changes,
      // AND untracked files the fixer agent may have created.
      const porcelain = run(`git status --porcelain`, { allowDryRun: true })
      if (porcelain) {
        const statusLines = porcelain.split('\n').filter((l) => l.trim())
        const unexpected = statusLines.filter((l) => {
          // porcelain format: XY <path> or XY <path> -> <path>
          const statusPath = l.slice(3).split(' -> ')[0]
          return statusPath !== file
        })
        if (unexpected.length > 0) {
          const unexpectedPaths = unexpected.map((l) => l.slice(3).split(' -> ')[0])
          console.log(`  Fixer touched files outside target, discarding: ${unexpectedPaths.join(', ')}`)
          // Restore tracked files (excluding target) and remove untracked files
          for (const p of unexpectedPaths) {
            const statusChar = statusLines.find((l) => l.slice(3).split(' -> ')[0] === p)?.[0]
            if (statusChar === '?') {
              // Untracked file — delete it
              try { fs.unlinkSync(path.join(WORKSPACE, p)) } catch { /* ignore */ }
            } else {
              // Tracked file — restore from HEAD
              run(`git checkout HEAD -- ${JSON.stringify(p)}`)
            }
          }
        }
      }

      // Stage only the target file
      run(`git add -- ${file}`)
      const hasChanges = run(`git diff --cached --name-only`)
      if (!hasChanges) {
        console.log(`  No changes produced for ${file}, skipping PR.`)
        run(`git checkout main`)
        run(`git branch -D ${branch}`)
        continue
      }

      run(`git commit -m "fix: [SELF-REVIEW] ${fileFindings[0].description.slice(0, 60)}"`)
      run(`git push -u origin ${branch}`)

      fs.writeFileSync(bodyPath, bodyLines.join('\n'))
      const prUrl = run(`gh pr create --repo ${REPO} --title ${JSON.stringify(prTitle)} --body-file ${bodyPath}`)

      prsOpened.push({ title: prTitle, url: prUrl, file, riskTag })
      console.log(`  PR opened: ${prUrl}`)

      try { fs.unlinkSync(tmpFixPrompt) } catch { /* ignore */ }
      try { fs.unlinkSync(bodyPath) } catch { /* ignore */ }
    } catch (err) {
      console.log(`  Warning: failed to create PR for ${file}: ${err.message}`)
    } finally {
      // Always return to main
      try { run(`git checkout main`) } catch { /* ignore */ }
    }
  }

  return prsOpened
}

// ---------------------------------------------------------------------------
// Phase 2 — PR Staleness Check
// ---------------------------------------------------------------------------

function runStalenessCheck() {
  console.log(`\n=== Phase 2: PR Staleness Check (${now()}) ===\n`)

  const list = run(`gh pr list --repo ${REPO} --json number,title,createdAt,url --state open`, { allowDryRun: true })
  if (!list) return []

  const prs = JSON.parse(list)
  const nowMs = Date.now()
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000

  // Load staleness state
  let state = {}
  try {
    state = JSON.parse(fs.readFileSync(STALENESS_STATE_PATH, 'utf8'))
  } catch { /* first run */ }

  const notified = []

  for (const pr of prs) {
    if (pr.title.toLowerCase().startsWith('wip:')) continue

    const ageMs = nowMs - new Date(pr.createdAt).getTime()
    if (ageMs < threeDaysMs) continue

    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    const stateKey = `pr-${pr.number}`
    const lastNotified = state[stateKey]

    // Throttle: once per day per PR
    if (lastNotified && (nowMs - new Date(lastNotified).getTime()) < 24 * 60 * 60 * 1000) {
      console.log(`  PR #${pr.number} already notified today, skipping.`)
      continue
    }

    const message = `🔔 Bort: PR #${pr.number} '${pr.title}' has been open for ${ageDays} days and needs your review. ${pr.url}`
    console.log(`  Notifying: PR #${pr.number} (${ageDays} days old)`)

    if (!dryRun) {
      sendTelegram(message)
    }

    state[stateKey] = new Date().toISOString()
    notified.push({ number: pr.number, title: pr.title, ageDays })
  }

  // Save state
  fs.writeFileSync(STALENESS_STATE_PATH, JSON.stringify(state, null, 2))
  return notified
}

// ---------------------------------------------------------------------------
// Phase 3 — Web Research Pass
// ---------------------------------------------------------------------------

function runWebResearch() {
  console.log(`\n=== Phase 3: Web Research Pass (${now()}) ===\n`)

  const topics = [
    {
      id: 'ai-agent-tooling',
      label: 'AI/Agent Tooling Updates',
      query: 'Latest AI agent tooling updates: OpenAI Codex updates, agentic framework patterns, tool-use best practices for AI agents. Summarize 3-5 key findings. Flag actionable items with [ACTION].',
    },
    {
      id: 'ebay-resale',
      label: 'eBay/Resale Market Trends',
      query: 'eBay and resale market trends: category demand shifts, pricing strategy changes, seller API updates or deprecations. Summarize 3-5 key findings. Flag actionable items with [ACTION].',
    },
    {
      id: 'openclaw-ecosystem',
      label: 'OpenClaw/Skill Ecosystem',
      query: 'OpenClaw framework updates: new skill releases, clawhub updates, skill development patterns. Summarize 3-5 key findings. Flag actionable items with [ACTION].',
    },
    {
      id: 'general-tech',
      label: 'General Tech/Stack News',
      query: 'Node.js LTS updates, GitHub platform changes, VPS security advisories, developer tooling news. Summarize 3-5 key findings. Flag actionable items with [ACTION].',
    },
  ]

  const results = []

  for (const topic of topics) {
    console.log(`  Researching: ${topic.label}`)
    try {
      const tmpQuery = `/tmp/self-review-research-${topic.id}.txt`
      fs.writeFileSync(tmpQuery, topic.query)

      const result = run(
        `openclaw agent run --skill gemini --prompt-file ${tmpQuery}`,
        { timeout: 90_000 }
      )

      results.push({ ...topic, findings: result || 'No results returned.' })
      try { fs.unlinkSync(tmpQuery) } catch { /* ignore */ }
    } catch (err) {
      console.log(`    Warning: research failed for ${topic.label}: ${err.message}`)
      results.push({ ...topic, findings: `Research failed: ${err.message}` })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Phase 4 — Write docs/self-review/ notes
// ---------------------------------------------------------------------------

function writeDocsNotes({ findings, prsOpened, research, stalenessNotified }) {
  console.log(`\n=== Phase 4: Writing docs/self-review/ notes (${now()}) ===\n`)

  ensureDir(FINDINGS_DIR)
  ensureDir(RESEARCH_DIR)
  ensureDir(PLANS_DIR)

  // --- Findings log ---
  const findingsPath = path.join(FINDINGS_DIR, `${TODAY}-findings.md`)
  const findingsLines = [
    `# Self-Review Findings — ${TODAY}`,
    '',
    `Generated by \`self-review-job.mjs\` on ${now()}`,
    '',
    '## Findings',
    '',
  ]

  if (findings.length === 0) {
    findingsLines.push('No findings this run.')
  } else {
    for (const f of findings) {
      const disposition = (f.severity === 'HIGH' || f.severity === 'MEDIUM')
        ? (prsOpened.some((pr) => pr.file === f.file) ? 'PR opened' : 'PR attempted')
        : 'Logged only'
      findingsLines.push(
        `### ${f.file}`,
        `- **Severity:** ${f.severity}`,
        `- **Finding:** ${f.description}`,
        `- **Suggestion:** ${f.suggestion}`,
        `- **Disposition:** ${disposition}`,
        '',
      )
    }
  }
  fs.writeFileSync(findingsPath, findingsLines.join('\n'))
  console.log(`  Wrote: ${relPath(findingsPath)}`)

  // --- Research digest ---
  const digestPath = path.join(RESEARCH_DIR, `${TODAY}-digest.md`)
  const digestLines = [
    `# Web Research Digest — ${TODAY}`,
    '',
    `Generated by \`self-review-job.mjs\` on ${now()}`,
    '',
  ]

  for (const r of research) {
    digestLines.push(`## ${r.label}`, '', r.findings, '')
  }
  fs.writeFileSync(digestPath, digestLines.join('\n'))
  console.log(`  Wrote: ${relPath(digestPath)}`)

  // --- Plan ---
  const planPath = path.join(PLANS_DIR, `${TODAY}-plan.md`)

  // Check for previous plan
  let previousPlanRef = 'None (first run)'
  try {
    const planFiles = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('-plan.md')).sort()
    const prev = planFiles.filter((f) => f < `${TODAY}-plan.md`).pop()
    if (prev) previousPlanRef = `plans/${prev}`
  } catch { /* ignore */ }

  const lowFindings = findings.filter((f) => f.severity === 'LOW')
  const planLines = [
    `# Self-Review Plan — ${TODAY}`,
    '',
    `Generated by \`self-review-job.mjs\` on ${now()}`,
    `Previous plan: ${previousPlanRef}`,
    '',
    '## This Run Summary',
    '',
    `- **Files reviewed:** ${findings.length > 0 ? '(see findings log)' : 'all review directories scanned'}`,
    `- **Findings:** ${findings.length} total (${findings.filter((f) => f.severity === 'HIGH').length} HIGH, ${findings.filter((f) => f.severity === 'MEDIUM').length} MEDIUM, ${lowFindings.length} LOW)`,
    `- **PRs opened:** ${prsOpened.length}`,
    prsOpened.length > 0
      ? prsOpened.map((pr) => `  - ${pr.title}${pr.riskTag} — ${pr.url}`).join('\n')
      : '',
    `- **Staleness notifications sent:** ${stalenessNotified.length}`,
    '',
    '## Open Items',
    '',
    lowFindings.length > 0
      ? lowFindings.map((f) => `- **${f.file}** (LOW): ${f.description}`).join('\n')
      : '- No deferred items.',
    '',
    stalenessNotified.length > 0
      ? stalenessNotified.map((n) => `- PR #${n.number} '${n.title}' — ${n.ageDays} days old (notification sent)`).join('\n')
      : '',
    '',
    '## Proposed Next Actions',
    '',
    '1. Review and merge any self-review PRs opened this run',
    '2. Address any [ACTION] items from web research digest',
    '3. Revisit deferred LOW findings if patterns recur',
    '',
    '## Questions for Bryan',
    '',
    '- (none this run — will populate when findings require a decision)',
    '',
  ].filter((l) => l !== undefined)

  fs.writeFileSync(planPath, planLines.join('\n'))
  console.log(`  Wrote: ${relPath(planPath)}`)

  return { findingsPath, digestPath, planPath }
}

function commitAndPushNotes(docPaths) {
  console.log(`\n  Committing docs/self-review/ notes...`)

  const branch = `bort/self-review-notes-${TODAY}`

  try {
    run(`git checkout main`)
    run(`git pull --ff-only`)
    run(`git checkout -b ${branch}`)

    for (const p of Object.values(docPaths)) {
      run(`git add ${relPath(p)}`)
    }

    run(`git commit -m "docs: [SELF-REVIEW] weekly notes ${TODAY}"`)
    // bort/ branches push directly to main per CLAUDE.md
    run(`git checkout main`)
    run(`git merge ${branch} --ff-only`)
    run(`git push origin main`)
    run(`git branch -d ${branch}`)
    console.log(`  Notes pushed to main.`)
  } catch (err) {
    console.log(`  Warning: failed to push notes: ${err.message}`)
    try { run(`git checkout main`) } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Phase 5 — Telegram Summary
// ---------------------------------------------------------------------------

function sendSummary({ fileCount, findings, prsOpened, research, stalenessNotified, docPaths }) {
  console.log(`\n=== Phase 5: Telegram Summary (${now()}) ===\n`)

  const researchHighlights = research
    .map((r) => {
      const bullets = r.findings
        .split('\n')
        .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'))
        .slice(0, 3)
        .join('\n')
      return `📌 ${r.label}:\n${bullets || '  (no highlights)'}`
    })
    .join('\n\n')

  const prSection = prsOpened.length > 0
    ? prsOpened.map((pr) => `  • ${pr.title}${pr.riskTag}\n    ${pr.url}`).join('\n')
    : '  (none — codebase is clean)'

  // Extract questions for Bryan from the plan
  const planPath = docPaths.planPath
  let questions = ''
  try {
    const planContent = fs.readFileSync(planPath, 'utf8')
    const qSection = planContent.split('## Questions for Bryan')[1]
    if (qSection) {
      const qLines = qSection.split('\n').filter((l) => l.trim().startsWith('-')).join('\n')
      if (qLines) questions = `\n\n❓ Questions for Bryan:\n${qLines}`
    }
  } catch { /* ignore */ }

  const message = [
    `📋 Bort Self-Review Complete — ${TODAY}`,
    '',
    `📁 Files reviewed: ${fileCount}`,
    `🔍 Findings: ${findings.length} (${findings.filter((f) => f.severity === 'HIGH').length}H/${findings.filter((f) => f.severity === 'MEDIUM').length}M/${findings.filter((f) => f.severity === 'LOW').length}L)`,
    '',
    `🔧 PRs opened:`,
    prSection,
    '',
    `🌐 Research highlights:`,
    researchHighlights,
    '',
    ...(docPaths.findingsPath ? [
      `📝 Notes committed:`,
      `  • ${relPath(docPaths.findingsPath)}`,
      `  • ${relPath(docPaths.digestPath)}`,
      `  • ${relPath(docPaths.planPath)}`,
    ] : []),
    questions,
  ].join('\n')

  console.log(message)
  if (!dryRun) {
    sendTelegram(message)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function shouldRun(phase) {
  return !onlyPhase || onlyPhase === phase
}

function main() {
  console.log(`Bort Self-Review Job — ${now()}`)
  console.log(`Workspace: ${WORKSPACE}`)
  console.log(`Dry run: ${dryRun}`)
  if (onlyPhase) console.log(`Running phase only: ${onlyPhase}`)
  console.log('')

  let findings = []
  let fileCount = 0
  let prsOpened = []
  let stalenessNotified = []
  let research = []
  let docPaths = {}

  // Phase 1 — Code Review
  if (shouldRun('review')) {
    const result = runCodeReview()
    findings = result.findings
    fileCount = result.fileCount
    prsOpened = createFixPRs(findings)
  }

  // Phase 2 — PR Staleness
  if (shouldRun('staleness')) {
    stalenessNotified = runStalenessCheck()
  }

  // Phase 3 — Web Research
  if (shouldRun('research')) {
    research = runWebResearch()
  }

  // Phase 4 — Write notes
  if (shouldRun('notes')) {
    docPaths = writeDocsNotes({ findings, prsOpened, research, stalenessNotified })
    if (!dryRun) {
      commitAndPushNotes(docPaths)
    }
  }

  // Phase 5 — Telegram Summary
  if (shouldRun('summary')) {
    sendSummary({ fileCount, findings, prsOpened, research, stalenessNotified, docPaths })
  }

  console.log(`\nSelf-review job complete at ${now()}.`)
}

main()
