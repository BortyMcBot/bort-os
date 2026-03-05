#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const WORKSPACE = '/root/.openclaw/workspace'
const LOG_PATH = path.join(WORKSPACE, 'logs', 'pr-review.log')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const silent = args.has('--silent')
const repoArg = process.argv.find((a) => a.startsWith('--repo='))
const REPO = repoArg ? repoArg.split('=')[1] : (process.env.BORT_OS_REPO || 'BortyMcBot/bort-os')

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function gh(cmd) {
  return run(`gh ${cmd}`)
}

function ghJson(cmd) {
  const out = gh(`${cmd} --json`) // not used; placeholder
  return JSON.parse(out)
}

function ghJsonFields(cmd, fields) {
  const out = gh(`${cmd} --json ${fields}`)
  return JSON.parse(out)
}

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function logLine(line) {
  ensureLogDir()
  fs.appendFileSync(LOG_PATH, line + '\n')
}

function now() {
  return new Date().toISOString()
}

function getViewerLogin() {
  try {
    const out = gh('api user --jq .login')
    return out.replace(/"/g, '').trim()
  } catch {
    return 'BortyMcBot'
  }
}

function parseDiffByFile(diff) {
  const files = new Map()
  let current = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/([^\s]+) b\/([^\s]+)$/)
      if (match) {
        current = match[2]
        if (!files.has(current)) files.set(current, [])
      } else {
        current = null
      }
      continue
    }
    if (current) files.get(current).push(line)
  }
  return files
}

function countDiffLines(diff) {
  return diff
    .split('\n')
    .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .length
}

function isMarkdownFence(line) {
  return line.trim().startsWith('```')
}

function isExampleLine(line) {
  const trimmed = line.replace(/^\+/, '').trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('>') ||
    trimmed.includes('`') ||
    /\b(example|e\.g\.)\b/i.test(trimmed)
  )
}

function detectSecrets(diff) {
  const lines = diff.split('\n')
  let inFence = false

  // Token-like patterns require value length (avoid matching docs/variable names)
  const tokenPatterns = [
    new RegExp('gh' + 'p_' + '[A-Za-z0-9]{20,}'), // GitHub PATs should include long suffix
    new RegExp('sk' + '-' + '[A-Za-z0-9]{20,}'), // Secret keys should include long suffix
    new RegExp('AK' + 'IA' + '[0-9A-Z]{16}'), // AWS access key id format
  ]

  for (const line of lines) {
    if (isMarkdownFence(line)) {
      inFence = !inFence
      continue
    }

    const added = line.startsWith('+') && !line.startsWith('+++')
    if (!added || inFence || isExampleLine(line)) continue

    // Only flag PRIVATE KEY when in PEM context (BEGIN/END) on added lines
    if (/^\+-----BEGIN .*PRIVATE KEY-----$/.test(line) || /^\+-----END .*PRIVATE KEY-----$/.test(line)) return true

    // Token patterns must appear on added lines outside code fences
    if (tokenPatterns.some((re) => re.test(line))) return true
  }

  return false
}

function safeZonesOnly(files, headRefName) {
  if (!files.length) return false
  return files.every((f) =>
    f.startsWith('scripts/') ||
    f.startsWith('integrations/') ||
    f.startsWith('hats/') ||
    f.startsWith('docs/') ||
    (headRefName.startsWith('bort/') && (f.startsWith('project_source/') || f.startsWith('skills/') || f === 'CLAUDE.md'))
  )
}

function hasProjectSourceMd(files) {
  return files.some((f) => f.startsWith('project_source/') && f.endsWith('.md'))
}

function hasArchDrift(files) {
  return files.some((f) => f.endsWith('.arch_drift_baseline.json') || f === 'project_source/.arch_drift_baseline.json')
}

function hasConflictMarkers(diff) {
  const lines = diff.split('\n')
  let inFence = false
  for (const line of lines) {
    if (isMarkdownFence(line)) {
      inFence = !inFence
      continue
    }
    const added = line.startsWith('+') && !line.startsWith('+++')
    if (!added || inFence || isExampleLine(line)) continue
    if (/^\+<{7}/.test(line) || /^\+={7}/.test(line) || /^\+>{7}/.test(line)) return true
  }
  return false
}

function reviewPR(pr, viewerLogin) {
  const prNum = pr.number
  const prTitle = pr.title

  const prView = ghJsonFields(`pr view ${prNum} --repo ${REPO}`, 'author,headRefName,files,additions,deletions,changedFiles,reviews,url,title')
  const diff = gh(`pr diff ${prNum} --repo ${REPO}`)
  const diffByFile = parseDiffByFile(diff)
  const diffLines = countDiffLines(diff)

  const files = (prView.files || []).map((f) => f.path || f.name || f)

  const reasons = []
  const authorLogin = prView.author?.login || ''
  const headRefName = prView.headRefName || ''
  const isSelf = authorLogin === viewerLogin

  const alreadyReviewed = (prView.reviews || []).some((r) => r.author && r.author.login === viewerLogin)
  if (alreadyReviewed) {
    return { decision: 'SKIP', reason: `already reviewed by ${viewerLogin}`, prView, diff, isSelf }
  }

  // AUTO-REJECT rules
  if (authorLogin === 'NewWorldOrderly') reasons.push('author is NewWorldOrderly (direct commit)')
  if (headRefName.startsWith('claude/') && hasProjectSourceMd(files)) reasons.push('claude/ branch touches project_source/*.md')
  if (hasArchDrift(files)) reasons.push('touches .arch_drift_baseline.json')
  if (!(headRefName.startsWith('claude/') || headRefName.startsWith('bort/'))) reasons.push('branch not prefixed claude/ or bort/')
  if (detectSecrets(diff)) reasons.push('possible secret/token pattern detected')

  if (reasons.length) {
    return { decision: 'REQUEST_CHANGES', reason: reasons.join('; '), prView, diff, isSelf }
  }

  const escalateReasons = []
  if (files.includes('os/preflight.js')) {
    const lines = diffByFile.get('os/preflight.js') || []
    if (lines.some((l) => l.startsWith('-') && !l.startsWith('---'))) {
      escalateReasons.push('os/preflight.js removes lines (possible enforcement weakening)')
    }
  }
  if (files.includes('os/hat-profiles.json')) escalateReasons.push('os/hat-profiles.json modified (permission scope change)')
  if (files.includes('os/model-routing.js')) {
    const lines = diffByFile.get('os/model-routing.js') || []
    if (lines.some((l) => l.startsWith('+') && !l.startsWith('+++'))) {
      escalateReasons.push('os/model-routing.js adds lines (possible new model IDs)')
    }
  }
  if (diffLines > 1000) escalateReasons.push(`diff too large (${diffLines} lines)`)

  if (escalateReasons.length) {
    return { decision: 'ESCALATE', reason: escalateReasons.join('; '), prView, diff, isSelf }
  }

  if (!safeZonesOnly(files, headRefName)) {
    return { decision: 'REQUEST_CHANGES', reason: 'changes outside safe zones (scripts/, integrations/, hats/, docs/; project_source/ + skills/ + CLAUDE.md allowed for bort/)', prView, diff, isSelf }
  }

  if (hasConflictMarkers(diff)) {
    return { decision: 'REQUEST_CHANGES', reason: 'diff contains conflict markers', prView, diff, isSelf }
  }

  return { decision: 'APPROVE', reason: 'safe zones only and no policy flags', prView, diff, isSelf }
}

function sendTelegram(message) {
  const cmd = `openclaw message send --channel telegram --target 8374853956 --message ${JSON.stringify(message)}`
  run(cmd)
}

function reviewBody(reason) {
  return `Reviewed by Bort. Reason: ${reason}`
}

function runDeploy(prNumber, prTitle) {
  const cmd = `node /root/.openclaw/workspace/scripts/deploy.mjs --pr-number ${prNumber} --pr-title ${JSON.stringify(prTitle)}`
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`)
    return
  }
  execSync(cmd, { stdio: 'inherit' })
}

function main() {
  const viewerLogin = getViewerLogin()

  const list = gh(`pr list --repo ${REPO} --json number,title,headRefName,author,files --state open`)
  const prs = JSON.parse(list)

  if (!silent && !dryRun) {
    sendTelegram('🔍 PR review starting...')
  }

  if (!prs.length) {
    console.log('No open PRs found.')
    if (!silent && !dryRun) {
      sendTelegram('✅ PR review done — no open PRs')
    }
    return
  }

  let mergedCount = 0
  let flaggedCount = 0
  let skippedCount = 0

  for (const pr of prs) {
    if (pr.title.toLowerCase().startsWith('wip:')) {
      const summary = `#${pr.number} ${pr.title} → SKIPPED (WIP)`
      console.log(summary)
      logLine(`${now()} PR #${pr.number} SKIP - WIP title`)
      skippedCount++
      continue
    }

    const { decision, reason, prView, isSelf } = reviewPR(pr, viewerLogin)
    const line = `${now()} PR #${pr.number} ${decision} - ${reason}`
    logLine(line)

    const summary = `#${pr.number} ${pr.title} → ${decision} (${reason})`
    console.log(summary)

    if (decision === 'SKIP') {
      skippedCount++
      if (dryRun) continue
      continue
    }

    if (decision === 'APPROVE') {
      if (dryRun) {
        mergedCount++
        runDeploy(pr.number, pr.title)
        continue
      }
      try {
        if (!isSelf) {
          gh(`pr review ${pr.number} --approve --body ${JSON.stringify('Reviewed by Bort. Merging.')} --repo ${REPO}`)
        }
        gh(`pr merge ${pr.number} --squash --repo ${REPO}`)
        mergedCount++
        runDeploy(pr.number, pr.title)
      } catch (err) {
        logLine(`${now()} PR #${pr.number} MERGE_FAILED - ${err.message}`)
        sendTelegram(`⚠️ Merge failed for PR #${pr.number}: ${pr.title}`)
      }
      continue
    }

    if (decision === 'ESCALATE') {
      flaggedCount++
      if (dryRun) continue
      if (!isSelf) {
        gh(`pr review ${pr.number} --request-changes --body ${JSON.stringify(reviewBody(reason))} --repo ${REPO}`)
        sendTelegram(`⚠️ PR #${pr.number} needs your attention: ${reason}\n${prView.url}`)
      }
      continue
    }

    if (decision === 'REQUEST_CHANGES') {
      flaggedCount++
      if (dryRun) continue
      if (!isSelf) {
        gh(`pr review ${pr.number} --request-changes --body ${JSON.stringify(reviewBody(reason))} --repo ${REPO}`)
      }
    }
  }

  if (!silent && !dryRun) {
    sendTelegram(`✅ PR review done — ${mergedCount} merged, ${flaggedCount} flagged, ${skippedCount} skipped`)
  }
}

main()
