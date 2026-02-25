#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'

const WORKSPACE = '/root/.openclaw/workspace'
const PROJECT_SOURCE_DIR = path.join(WORKSPACE, 'project_source')
const BASELINE_PATH = path.join(PROJECT_SOURCE_DIR, '.arch_drift_baseline.json')
const CHANGELOG_PATH = path.join(PROJECT_SOURCE_DIR, 'CHANGELOG_AUTOGEN.md')
const TO_UPLOAD_PATH = path.join(WORKSPACE, 'memory', 'to_upload.md')

const WATCH_FILES = [
  'os/preflight.js',
  'os/model-routing.js',
  'bort-ui/vite.config.ts',
  'bort-ui/scripts/free-ports.mjs',
]

function nowPhoenixStamp() {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const parts = dtf.formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('month')} ${get('day')}, ${get('year')} • ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function sha256File(p) {
  return sha256(fs.readFileSync(p))
}

function readText(p) {
  return fs.readFileSync(p, 'utf8')
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function ensureFile(p, content = '') {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, content, 'utf8')
  }
}

function listTopLevelDirs() {
  const entries = fs.readdirSync(WORKSPACE, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n !== '.git')
    .sort()
}

function extractHatAllowlist(preflightText) {
  // Best-effort parse of: const HATS = { ... };
  const m = preflightText.match(/const\s+HATS\s*=\s*\{([\s\S]*?)\n\};/)
  if (!m) return null
  const body = m[1]
  const keys = []
  for (const line of body.split(/\r?\n/)) {
    const mm = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*\{\s*$/)
    if (mm) keys.push(mm[1] || mm[2] || mm[3])
  }
  return Array.from(new Set(keys)).sort()
}

function extractRoutingState(routingText) {
  // Extract ROUTES object categories and ordering. Best-effort; does not execute JS.
  const m = routingText.match(/const\s+ROUTES\s*=\s*\{([\s\S]*?)\n\};/)
  if (!m) return null
  const body = m[1]

  const categories = {}
  let current = null

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    // category: [
    const cat = line.match(/^([A-Za-z0-9_]+)\s*:\s*\[$/)
    if (cat) {
      current = cat[1]
      categories[current] = []
      continue
    }
    if (current) {
      if (line.startsWith(']')) {
        current = null
        continue
      }
      const mm = line.match(/^'([^']+)'\s*,?$/)
      if (mm) categories[current].push(mm[1])
    }
  }

  // Default hard-coded fallback model
  const fallback = (routingText.match(/model:\s*model\s*\|\|\s*'([^']+)'/) || [])[1] || null

  return {
    categories: Object.keys(categories).sort(),
    routes: categories,
    fallbackModel: fallback,
  }
}

function extractViteServer(viteText) {
  const host = (viteText.match(/host:\s*["']([^"']+)["']/) || [])[1] || null
  const port = (viteText.match(/port:\s*(\d+)/) || [])[1] ? Number((viteText.match(/port:\s*(\d+)/) || [])[1]) : null
  const strictPort = /strictPort:\s*true/.test(viteText)
  const proxyTarget = (viteText.match(/target:\s*["']([^"']+)["']/) || [])[1] || null
  return { host, port, strictPort, proxyTarget }
}

function extractFreePorts(freePortsText) {
  const m = freePortsText.match(/const\s+PORTS\s*=\s*\[([^\]]+)\]/)
  if (!m) return null
  const nums = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
  return Array.from(new Set(nums)).sort((a, b) => a - b)
}

function normalizeMdForCosmetic(md) {
  // Normalize whitespace-only changes: trim trailing spaces + normalize line endings.
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
}

function classifyProjectSourceChanges() {
  const canonical = [
    'FILE_INDEX.md',
    'SYSTEM_CONTEXT.md',
    'ARCHITECTURE_SUMMARY.md',
    'ROUTING_STATE.md',
    'OPERATIONS_STATE.md',
    'CHANGELOG_AUTOGEN.md',
  ]
  const out = []
  for (const f of canonical) {
    const p = path.join(PROJECT_SOURCE_DIR, f)
    if (!fs.existsSync(p)) continue
    const raw = readText(p)
    out.push({
      file: `project_source/${f}`,
      rawSha256: sha256(Buffer.from(raw, 'utf8')),
      normalizedSha256: sha256(Buffer.from(normalizeMdForCosmetic(raw), 'utf8')),
    })
  }
  return out
}

function buildDriftReport({ severity, impactAreas, changedFiles, details }) {
  const stamp = nowPhoenixStamp()
  const lines = []
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`## Drift Report — ${stamp} (America/Phoenix)`) 
  lines.push('')
  lines.push(`- severity: ${severity}`)
  if (impactAreas.length) lines.push(`- impact_area: ${impactAreas.join(', ')}`)
  lines.push('- changed_files:')
  for (const f of changedFiles) lines.push(`  - ${f}`)
  lines.push('')
  lines.push('Details:')
  for (const d of details) lines.push(`- ${d}`)
  lines.push('')
  return lines.join('\n')
}

function prependUniqueToUpload(block) {
  ensureFile(TO_UPLOAD_PATH, '')
  const existing = readText(TO_UPLOAD_PATH)
  if (existing.startsWith(block + '\n') || existing.includes(block + '\n\n')) return false
  fs.writeFileSync(TO_UPLOAD_PATH, `${block}\n\n${existing}`, 'utf8')
  return true
}

function main() {
  const args = new Set(process.argv.slice(2))
  const forceExport = args.has('--force-export')

  fs.mkdirSync(PROJECT_SOURCE_DIR, { recursive: true })
  ensureFile(CHANGELOG_PATH, '# CHANGELOG_AUTOGEN.md\n')

  const impl = {}
  const changedImplFiles = []

  for (const rel of WATCH_FILES) {
    const p = path.join(WORKSPACE, rel)
    if (!fs.existsSync(p)) continue
    const text = readText(p)
    impl[rel] = {
      sha256: sha256(Buffer.from(text, 'utf8')),
    }
    if (rel === 'os/preflight.js') {
      impl[rel].hatAllowlist = extractHatAllowlist(text)
    }
    if (rel === 'os/model-routing.js') {
      impl[rel].routing = extractRoutingState(text)
    }
    if (rel === 'bort-ui/vite.config.ts') {
      impl[rel].vite = extractViteServer(text)
    }
    if (rel === 'bort-ui/scripts/free-ports.mjs') {
      impl[rel].ports = extractFreePorts(text)
    }
  }

  const topDirs = listTopLevelDirs()
  const projectSourceState = classifyProjectSourceChanges()

  const baselineExisted = fs.existsSync(BASELINE_PATH)
  const baseline = readJsonSafe(BASELINE_PATH)

  const nextBaseline = {
    version: 1,
    updatedPhoenix: nowPhoenixStamp(),
    topLevelDirs: topDirs,
    impl,
    projectSource: projectSourceState,
  }

  // First run baseline: write baseline and allow normal export flow.
  if (!baselineExisted || !baseline) {
    writeJson(BASELINE_PATH, nextBaseline)
    // Proceed to normal export (cosmetic/structural drift detection requires a baseline).
    const r = spawnSync('node', [path.join(WORKSPACE, 'scripts', 'export-project-source.mjs'), '--quiet-no-changes'], { stdio: 'inherit' })
    process.exit(r.status ?? 0)
  }

  // Compare against baseline.
  const impactAreas = new Set()
  const details = []

  // Structural drift: new/removed top-level directories.
  const prevDirs = new Set((baseline.topLevelDirs || []).map(String))
  const curDirs = new Set(topDirs.map(String))
  const addedDirs = topDirs.filter((d) => !prevDirs.has(d))
  const removedDirs = (baseline.topLevelDirs || []).filter((d) => !curDirs.has(d))

  let hasStructural = addedDirs.length > 0 || removedDirs.length > 0
  if (hasStructural) {
    impactAreas.add('architecture')
    if (addedDirs.length) details.push(`top-level dirs added: ${addedDirs.join(', ')}`)
    if (removedDirs.length) details.push(`top-level dirs removed: ${removedDirs.join(', ')}`)
  }

  // Behavioral drift: any change in key implementation files OR extracted behavioral fields.
  let hasBehavioral = false

  for (const rel of WATCH_FILES) {
    const prev = baseline.impl?.[rel]
    const cur = nextBaseline.impl?.[rel]
    if (!prev || !cur) continue

    if (prev.sha256 !== cur.sha256) {
      hasBehavioral = true
      changedImplFiles.push(rel)
    }

    if (rel === 'os/preflight.js') {
      const a = JSON.stringify(prev.hatAllowlist || [])
      const b = JSON.stringify(cur.hatAllowlist || [])
      if (a !== b) {
        hasBehavioral = true
        impactAreas.add('enforcement')
        details.push(`hat allowlist changed: ${a} -> ${b}`)
      }
    }

    if (rel === 'os/model-routing.js') {
      const pa = prev.routing || {}
      const pb = cur.routing || {}
      const aCat = JSON.stringify(pa.categories || [])
      const bCat = JSON.stringify(pb.categories || [])
      if (aCat !== bCat) {
        hasBehavioral = true
        impactAreas.add('routing')
        details.push(`route categories changed: ${aCat} -> ${bCat}`)
      }
      const aFallback = pa.fallbackModel || null
      const bFallback = pb.fallbackModel || null
      if (aFallback !== bFallback) {
        hasBehavioral = true
        impactAreas.add('routing')
        details.push(`default fallback model changed: ${aFallback} -> ${bFallback}`)
      }
      // Compare ordering per category.
      const aRoutes = pa.routes || {}
      const bRoutes = pb.routes || {}
      for (const cat of Object.keys({ ...aRoutes, ...bRoutes })) {
        const aa = JSON.stringify(aRoutes[cat] || [])
        const bb = JSON.stringify(bRoutes[cat] || [])
        if (aa !== bb) {
          hasBehavioral = true
          impactAreas.add('routing')
          details.push(`route ordering changed for ${cat}`)
          break
        }
      }
    }

    if (rel === 'bort-ui/vite.config.ts') {
      const a = prev.vite || {}
      const b = cur.vite || {}
      if (a.host !== b.host || a.port !== b.port || a.strictPort !== b.strictPort) {
        hasBehavioral = true
        impactAreas.add('dev_ports')
        details.push(`vite server changed: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
      }
      if (a.proxyTarget !== b.proxyTarget) {
        hasBehavioral = true
        impactAreas.add('dev_ports')
        details.push(`vite proxy target changed: ${a.proxyTarget} -> ${b.proxyTarget}`)
      }
    }

    if (rel === 'bort-ui/scripts/free-ports.mjs') {
      const a = JSON.stringify(prev.ports || [])
      const b = JSON.stringify(cur.ports || [])
      if (a !== b) {
        hasBehavioral = true
        impactAreas.add('dev_ports')
        details.push(`free-ports target ports changed: ${a} -> ${b}`)
      }
    }
  }

  // Cosmetic drift: project_source files changed only by whitespace/format.
  let hasCosmetic = false
  const prevPS = new Map((baseline.projectSource || []).map((x) => [x.file, x]))
  const curPS = new Map(nextBaseline.projectSource.map((x) => [x.file, x]))
  for (const [file, cur] of curPS.entries()) {
    const prev = prevPS.get(file)
    if (!prev) continue
    if (prev.rawSha256 !== cur.rawSha256 && prev.normalizedSha256 === cur.normalizedSha256) {
      hasCosmetic = true
    }
  }

  // Decide classification.
  let classification = 'none'
  if (hasBehavioral) classification = 'behavioral'
  else if (hasStructural) classification = 'structural'
  else if (hasCosmetic) classification = 'cosmetic'

  // Persist baseline only if NOT behavioral drift.
  // Behavioral drift requires Bryan confirmation to accept a new baseline.
  if (!hasBehavioral) {
    writeJson(BASELINE_PATH, nextBaseline)
  }

  if (hasBehavioral) {
    // HIGH severity: emit drift notification + append drift report to changelog; do NOT auto-export.
    const severity = 'HIGH'
    if (!impactAreas.size) impactAreas.add('architecture')

    const changed = Array.from(new Set([...changedImplFiles]))
    const block = [
      '[BORT_ARCH_DRIFT]',
      `severity: ${severity}`,
      'changed_files:',
      ...(changed.length ? changed.map((f) => `- ${f}`) : ['- (none)']),
      'impact_area:',
      ...(impactAreas.size ? Array.from(impactAreas).map((a) => `- ${a}`) : ['- (unknown)']),
      'action_required:',
      '- Review project_source documentation before continuing',
      '- Reply with explicit confirmation to reconcile docs (do not do it silently)',
    ].join('\n')

    console.log(block)
    prependUniqueToUpload(block)

    const report = buildDriftReport({
      severity,
      impactAreas: Array.from(impactAreas),
      changedFiles: changed,
      details: details.length ? details : ['(no additional details)'],
    })

    // Append to CHANGELOG_AUTOGEN.md
    fs.appendFileSync(CHANGELOG_PATH, report, 'utf8')

    process.exit(0)
  }

  // Cosmetic/structural: proceed with normal export behavior.
  // (We do not embed classification into export; we just allow standard source update surfacing.)
  if (forceExport) {
    const r = spawnSync('node', [path.join(WORKSPACE, 'scripts', 'export-project-source.mjs'), '--force'], { stdio: 'inherit' })
    process.exit(r.status ?? 0)
  }

  const r = spawnSync('node', [path.join(WORKSPACE, 'scripts', 'export-project-source.mjs'), '--quiet-no-changes'], { stdio: 'inherit' })
  process.exit(r.status ?? 0)
}

main()
