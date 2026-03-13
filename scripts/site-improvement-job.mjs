#!/usr/bin/env node
// Cron: to be registered by Bort — suggested: weekly, Sunday 8am Phoenix

import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { TELEGRAM_CHAT_ID, BORT_WORKSPACE } from '../os/constants.js'

const WORKSPACE = BORT_WORKSPACE
const AGENT_ID = process.env.BORT_AGENT_ID || 'main'
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')

const TODAY = new Date().toISOString().slice(0, 10)
const SITE_URL = 'https://bryanduckworth.com'
const REVIEW_DIR = '/tmp/site-review'
const PR_DIR = '/tmp/site-prs'
const TODO_DIR = path.join(WORKSPACE, 'docs', 'site-review')
const LOG_PATH = path.join(WORKSPACE, 'logs', 'site-improvement.log')
const PINCHTAB_PID = '/tmp/pinchtab.pid'
const PINCHTAB_ENV = `${process.env.HOME}/.pinchtab/.env`
const PINCHTAB_BASE = 'http://127.0.0.1:9867'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date().toISOString()
}

function run(cmd, opts = {}) {
  if (dryRun && !opts.allowDryRun) {
    console.log(`[dry-run] ${cmd}`)
    return ''
  }
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim()
}

function runGit(args, opts = {}) {
  if (dryRun && !opts.allowDryRun) {
    console.log(`[dry-run] git ${args.join(' ')}`)
    return ''
  }
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim()
}

function runOpenClaw(args, opts = {}) {
  if (dryRun && !opts.allowDryRun) {
    console.log(`[dry-run] openclaw ${args.join(' ')}`)
    return ''
  }
  return execFileSync('openclaw', args, { encoding: 'utf8', cwd: WORKSPACE, ...opts }).trim()
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function ensureLogDir() {
  ensureDir(path.dirname(LOG_PATH))
}

function logLine(line) {
  ensureLogDir()
  fs.appendFileSync(LOG_PATH, line + '\n')
}

function sendTelegram(message) {
  const cmd = `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} --message ${JSON.stringify(message)}`
  run(cmd)
}

function loadBridgeToken() {
  if (!fs.existsSync(PINCHTAB_ENV)) return null
  const content = fs.readFileSync(PINCHTAB_ENV, 'utf8')
  const match = content.match(/^BRIDGE_TOKEN=(.+)$/m)
  return match ? match[1].trim() : null
}

// ---------------------------------------------------------------------------
// Phase 1 — Reconnaissance
// ---------------------------------------------------------------------------

function discoverSiteRepo() {
  console.log(`\n=== Phase 1a: Discover site repo (${now()}) ===\n`)

  const listJson = run(
    'gh repo list NewWorldOrderly --limit 20 --json name,url,description',
    { allowDryRun: true }
  )
  const repos = JSON.parse(listJson)

  // Look for bryanduckworth.com repo by name or description
  const siteRepo = repos.find((r) => {
    const n = r.name.toLowerCase()
    const d = (r.description || '').toLowerCase()
    return (
      n.includes('bryanduckworth') ||
      n.includes('personal-website') ||
      n.includes('personal-site') ||
      d.includes('bryanduckworth.com') ||
      d.includes('personal website') ||
      d.includes('personal site')
    )
  })

  if (!siteRepo) {
    console.error('Could not find bryanduckworth.com repo in NewWorldOrderly repos.')
    sendTelegram('[SITE_REVIEW] ❌ Could not find bryanduckworth.com repo via gh repo list. Aborting.')
    logLine(`${now()} ABORT — site repo not found`)
    process.exit(1)
  }

  const repoRef = `NewWorldOrderly/${siteRepo.name}`
  console.log(`  Found site repo: ${repoRef}`)
  return { repoRef, repoName: siteRepo.name }
}

function cloneOrPullSiteRepo(repoRef) {
  console.log(`\n=== Phase 1b: Clone/pull site repo (${now()}) ===\n`)

  ensureDir(REVIEW_DIR)
  const repoDir = path.join(REVIEW_DIR, 'repo')

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    console.log('  Repo already cloned — pulling latest...')
    runGit(['pull', '--ff-only'], { cwd: repoDir })
  } else {
    console.log(`  Cloning ${repoRef}...`)
    run(`gh repo clone ${repoRef} ${repoDir}`)
  }

  return repoDir
}

function capturePinchtab() {
  console.log(`\n=== Phase 1c: Pinchtab capture (${now()}) ===\n`)

  const bridgeToken = loadBridgeToken()
  if (!bridgeToken) {
    console.log('  Warning: BRIDGE_TOKEN not available — skipping Pinchtab capture.')
    return false
  }

  // Start Pinchtab
  try {
    run(`${WORKSPACE}/scripts/pinchtab-session.sh start`, { timeout: 30_000 })
  } catch (err) {
    console.log(`  Warning: Pinchtab failed to start: ${err.message}`)
    console.log('  Proceeding without screenshot/a11y capture.')
    return false
  }

  try {
    // Navigate to the site
    run(`pinchtab goto ${JSON.stringify(SITE_URL)}`, { timeout: 30_000 })

    // Wait for page load
    run('sleep 3')

    // Screenshot
    try {
      run(`pinchtab screenshot --output ${REVIEW_DIR}/screenshot.jpg`, { timeout: 15_000 })
      console.log('  Screenshot captured.')
    } catch (err) {
      console.log(`  Warning: screenshot failed: ${err.message}`)
    }

    // Text snapshot
    try {
      const pageText = run('pinchtab text', { timeout: 15_000 })
      fs.writeFileSync(path.join(REVIEW_DIR, 'page-text.txt'), pageText)
      console.log('  Text snapshot captured.')
    } catch (err) {
      console.log(`  Warning: text capture failed: ${err.message}`)
    }

    // A11y tree
    try {
      const a11y = run('pinchtab snap', { timeout: 15_000 })
      fs.writeFileSync(path.join(REVIEW_DIR, 'a11y.json'), a11y)
      console.log('  A11y snapshot captured.')
    } catch (err) {
      console.log(`  Warning: a11y capture failed: ${err.message}`)
    }

    return true
  } finally {
    // Always stop Pinchtab
    try {
      run(`${WORKSPACE}/scripts/pinchtab-session.sh stop`, { timeout: 15_000 })
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Analysis
// ---------------------------------------------------------------------------

function analyzeRepo(repoDir) {
  console.log(`\n=== Phase 2a: Repo analysis (${now()}) ===\n`)

  // File tree (max 2 levels)
  let fileTree = ''
  try {
    fileTree = run(`find ${repoDir} -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name '.git'`, { allowDryRun: true })
  } catch { /* ignore */ }

  // Key files
  const keyFiles = ['README.md', 'package.json', 'next.config.js', 'next.config.mjs', 'next.config.ts',
    'astro.config.mjs', 'gatsby-config.js', 'vite.config.js', 'vite.config.ts',
    'nuxt.config.ts', 'svelte.config.js', 'tsconfig.json']

  const fileContents = {}
  for (const f of keyFiles) {
    const fp = path.join(repoDir, f)
    if (fs.existsSync(fp)) {
      try {
        fileContents[f] = fs.readFileSync(fp, 'utf8').slice(0, 3000)
      } catch { /* ignore */ }
    }
  }

  // Detect framework
  let framework = 'unknown'
  if (fileContents['next.config.js'] || fileContents['next.config.mjs'] || fileContents['next.config.ts']) {
    framework = 'Next.js'
  } else if (fileContents['astro.config.mjs']) {
    framework = 'Astro'
  } else if (fileContents['gatsby-config.js']) {
    framework = 'Gatsby'
  } else if (fileContents['nuxt.config.ts']) {
    framework = 'Nuxt'
  } else if (fileContents['svelte.config.js']) {
    framework = 'SvelteKit'
  } else if (fileContents['vite.config.js'] || fileContents['vite.config.ts']) {
    framework = 'Vite'
  }

  // Parse package.json safely — the file content may have been read in full but could
  // still be malformed; guard against parse failures.
  let pkg = null
  if (fileContents['package.json']) {
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'))
    } catch { /* malformed package.json — skip deps extraction */ }
  }
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {}

  console.log(`  Framework: ${framework}`)
  console.log(`  Key files found: ${Object.keys(fileContents).join(', ') || '(none)'}`)

  return {
    framework,
    fileTree: fileTree.split('\n').slice(0, 100).join('\n'),
    keyFiles: fileContents,
    dependencies: Object.keys(deps).slice(0, 30).join(', '),
  }
}

function callGeminiAnalysis(repoSummary) {
  console.log(`\n=== Phase 2b: Gemini analysis (${now()}) ===\n`)

  if (dryRun) {
    console.log('[dry-run] Skipping Gemini analysis — returning stub findings.')
    return {
      summary: '(dry-run stub)',
      findings: [],
    }
  }

  // Gather available capture data
  let pageText = ''
  let a11yData = ''
  try { pageText = fs.readFileSync(path.join(REVIEW_DIR, 'page-text.txt'), 'utf8').slice(0, 5000) } catch { /* not available */ }
  try { a11yData = fs.readFileSync(path.join(REVIEW_DIR, 'a11y.json'), 'utf8').slice(0, 5000) } catch { /* not available */ }

  const prompt = `You are reviewing a personal website at ${SITE_URL}.

## Repo Summary
- Framework: ${repoSummary.framework}
- Dependencies: ${repoSummary.dependencies}
- File tree (truncated):
${repoSummary.fileTree.slice(0, 2000)}

## Key Files
${Object.entries(repoSummary.keyFiles).map(([k, v]) => `### ${k}\n\`\`\`\n${v.slice(0, 1500)}\n\`\`\``).join('\n\n')}

${pageText ? `## Live Page Text\n${pageText}` : '(No live page text available)'}

${a11yData ? `## Accessibility Tree\n${a11yData}` : '(No a11y data available)'}

## Task
Evaluate this personal website and return a JSON object with improvements. Evaluate:
1. Visual/UX quality (based on text content and structure)
2. Content quality and completeness
3. SEO basics (title, meta, headings structure)
4. Accessibility issues (from a11y snapshot if available)
5. Performance quick-wins (based on framework and dependencies)
6. Missing sections or features a personal site typically has (about, projects, contact, blog, resume, etc.)

Return ONLY valid JSON (no markdown fences, no explanation) with this exact schema:
{
  "summary": "Overall assessment in 2-3 sentences",
  "findings": [
    {
      "id": "SITE-001",
      "category": "ux|content|seo|a11y|perf|feature",
      "title": "Short title",
      "description": "Detailed description of the issue",
      "confidence": "high|medium|low",
      "effort": "trivial|small|medium|large",
      "pr_ready": false,
      "suggested_change": "Only if pr_ready is true — describe exact file and change"
    }
  ]
}

Rules for pr_ready:
- ONLY set true when confidence=high AND effort is trivial or small
- ONLY for cosmetic, copy, or config changes — NOT structural feature additions
- Include the exact file path and change description in suggested_change

Number findings starting from SITE-001. Include 5-15 findings.`

  const queryMessage = `Use the gemini skill if available. ${prompt}`

  let result
  try {
    result = runOpenClaw(
      ['agent', '--agent', AGENT_ID, '--message', queryMessage],
      { timeout: 120_000 }
    )
  } catch (err) {
    console.error(`  Gemini analysis failed: ${err.message}`)
    logLine(`${now()} ABORT — Gemini analysis failed: ${err.message}`)
    process.exit(1)
  }

  // Extract JSON from response (may be wrapped in markdown fences or text)
  let parsed
  try {
    // Try direct parse first
    parsed = JSON.parse(result)
  } catch {
    // Try extracting from markdown code fences
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim())
      } catch { /* fall through */ }
    }
    // Try finding JSON object in response
    if (!parsed) {
      const braceMatch = result.match(/\{[\s\S]*"findings"[\s\S]*\}/)
      if (braceMatch) {
        try {
          parsed = JSON.parse(braceMatch[0])
        } catch { /* fall through */ }
      }
    }
  }

  if (!parsed || !Array.isArray(parsed.findings)) {
    console.error('  Gemini returned invalid JSON. Raw response:')
    console.error(result.slice(0, 2000))
    logLine(`${now()} ABORT — Gemini returned invalid JSON`)
    const rawPath = path.join(REVIEW_DIR, 'gemini-raw-response.txt')
    ensureDir(REVIEW_DIR)
    fs.writeFileSync(rawPath, result)
    console.error(`  Raw response saved to ${rawPath}`)
    process.exit(1)
  }

  console.log(`  Analysis complete: ${parsed.findings.length} findings`)
  return parsed
}

// ---------------------------------------------------------------------------
// Phase 3 — TODO output
// ---------------------------------------------------------------------------

function writeTodo(analysis) {
  console.log(`\n=== Phase 3: Write TODO.md (${now()}) ===\n`)

  ensureDir(TODO_DIR)

  const prReady = analysis.findings.filter((f) => f.pr_ready)
  const lines = [
    `# Site Review — ${SITE_URL}`,
    '',
    `Generated: ${now()}`,
    '',
    '## Summary',
    '',
    analysis.summary,
    '',
  ]

  // PR-ready section at top
  if (prReady.length > 0) {
    lines.push('## Ready to PR', '')
    lines.push('| ID | Category | Title | Effort |')
    lines.push('|---|---|---|---|')
    for (const f of prReady) {
      lines.push(`| ${f.id} | ${f.category} | ${f.title} | ${f.effort} |`)
    }
    lines.push('')
  }

  // Full findings table
  lines.push('## All Findings', '')
  lines.push('| ID | Category | Confidence | Effort | PR Ready | Title |')
  lines.push('|---|---|---|---|---|---|')
  for (const f of analysis.findings) {
    lines.push(`| ${f.id} | ${f.category} | ${f.confidence} | ${f.effort} | ${f.pr_ready ? '✅' : '—'} | ${f.title} |`)
  }
  lines.push('')

  // Detail blocks
  lines.push('## Details', '')
  for (const f of analysis.findings) {
    lines.push(`### ${f.id}: ${f.title}`, '')
    lines.push(`- **Category:** ${f.category}`)
    lines.push(`- **Confidence:** ${f.confidence}`)
    lines.push(`- **Effort:** ${f.effort}`)
    lines.push(`- **PR Ready:** ${f.pr_ready ? 'Yes' : 'No'}`)
    lines.push('')
    lines.push(f.description)
    if (f.pr_ready && f.suggested_change) {
      lines.push('')
      lines.push(`**Suggested change:** ${f.suggested_change}`)
    }
    lines.push('')
  }

  const todoPath = path.join(TODO_DIR, 'TODO.md')
  fs.writeFileSync(todoPath, lines.join('\n'))
  console.log(`  Written to ${todoPath}`)
}

// ---------------------------------------------------------------------------
// Phase 4 — PR creation (high-confidence items only)
// ---------------------------------------------------------------------------

function createPRs(analysis, repoRef) {
  console.log(`\n=== Phase 4: Create PRs (${now()}) ===\n`)

  const prReady = analysis.findings.filter((f) => f.pr_ready)
  if (prReady.length === 0) {
    console.log('  No PR-ready findings — skipping.')
    return []
  }

  const prUrls = []

  for (const finding of prReady) {
    const slug = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    const branch = `bort/site-${finding.id.toLowerCase()}-${slug}`
    const prDir = path.join(PR_DIR, finding.id)

    console.log(`  Processing ${finding.id}: ${finding.title}`)

    // Check if branch already exists on remote
    try {
      const existing = run(
        `gh api repos/${repoRef}/branches/${encodeURIComponent(branch)} --jq .name 2>/dev/null || true`,
        { allowDryRun: true }
      )
      if (existing && existing.trim()) {
        console.log(`    Branch ${branch} already exists — skipping.`)
        continue
      }
    } catch { /* branch doesn't exist, proceed */ }

    try {
      // Clone fresh working copy
      ensureDir(PR_DIR)
      if (fs.existsSync(prDir)) {
        fs.rmSync(prDir, { recursive: true, force: true })
      }
      run(`gh repo clone ${repoRef} ${prDir}`)

      // Create branch
      runGit(['checkout', '-b', branch], { cwd: prDir })

      // Use openclaw agent with cwd set to the PR working copy so edits
      // land in the right checkout instead of bort-os workspace.
      const changePrompt = `Apply the following change to the repository in the current directory.

Finding: ${finding.title}
Description: ${finding.description}
Suggested change: ${finding.suggested_change}

Make the minimal edit required. Only modify the file(s) described. Do not add comments, do not refactor surrounding code.
After editing, respond with the exact file path(s) you changed, one per line.`

      const changeResult = execFileSync(
        'openclaw',
        ['agent', '--agent', AGENT_ID, '--message', changePrompt],
        { encoding: 'utf8', cwd: prDir, timeout: 60_000 }
      ).trim()

      // Check if any files were actually changed
      const status = runGit(['status', '--porcelain'], { cwd: prDir, allowDryRun: true })
      if (!status.trim()) {
        console.log(`    No files changed for ${finding.id} — skipping PR.`)
        continue
      }

      // Stage and commit
      runGit(['add', '-A'], { cwd: prDir })
      runGit(['commit', '-m', `fix: ${finding.title} [Bort site-improvement-job]`], { cwd: prDir })

      // Push branch
      runGit(['push', '-u', 'origin', branch], { cwd: prDir })

      // Create PR via --body-file
      const bodyPath = path.join(prDir, '.pr-body.md')
      const prBody = [
        `## ${finding.title}`,
        '',
        `**Category:** ${finding.category}`,
        `**Confidence:** ${finding.confidence}`,
        '',
        finding.description,
        '',
        '---',
        'Generated by Bort site-improvement-job',
      ].join('\n')
      fs.writeFileSync(bodyPath, prBody)

      const prUrl = run(
        `gh pr create --repo ${repoRef} --title ${JSON.stringify(`fix: ${finding.title}`)} --body-file ${bodyPath} --head ${branch}`
      )

      if (prUrl) {
        prUrls.push(prUrl.trim())
        console.log(`    PR created: ${prUrl.trim()}`)
      }
    } catch (err) {
      console.log(`    Warning: PR creation failed for ${finding.id}: ${err.message}`)
    }
  }

  return prUrls
}

// ---------------------------------------------------------------------------
// Phase 5 — Notification & cleanup
// ---------------------------------------------------------------------------

function notifyAndCleanup(analysis, prUrls) {
  console.log(`\n=== Phase 5: Notify & cleanup (${now()}) ===\n`)

  const findingCount = analysis.findings.length
  const prCount = prUrls.length
  const prList = prUrls.length > 0 ? '\nPRs:\n' + prUrls.join('\n') : ''

  const message = `[SITE_REVIEW] bryanduckworth.com\n📋 ${findingCount} findings | ✅ ${prCount} PRs opened\nTODO: docs/site-review/TODO.md${prList}`
  sendTelegram(message)

  // Cleanup temp dirs
  try { fs.rmSync(REVIEW_DIR, { recursive: true, force: true }) } catch { /* ignore */ }
  try { fs.rmSync(PR_DIR, { recursive: true, force: true }) } catch { /* ignore */ }

  // Log summary
  logLine(`${now()} findings=${findingCount} prs=${prCount}`)

  console.log(`\nDone. ${findingCount} findings, ${prCount} PRs opened.`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  console.log(`\n=== Site Improvement Job — ${now()} ===\n`)

  // Phase 1
  const { repoRef } = discoverSiteRepo()
  const repoDir = cloneOrPullSiteRepo(repoRef)
  capturePinchtab()

  // Phase 2
  const repoSummary = analyzeRepo(repoDir)
  const analysis = callGeminiAnalysis(repoSummary)

  // Phase 3
  writeTodo(analysis)

  // Phase 4
  const prUrls = createPRs(analysis, repoRef)

  // Phase 5
  notifyAndCleanup(analysis, prUrls)
})().catch((e) => {
  console.error('FATAL:', e?.message || e)
  logLine(`${now()} FATAL: ${e?.message || e}`)
  try {
    sendTelegram(`[SITE_REVIEW] ❌ Job failed: ${e?.message || 'unknown error'}`)
  } catch { /* ignore */ }
  process.exit(1)
})
