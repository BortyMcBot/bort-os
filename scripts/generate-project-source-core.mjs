#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const WORKSPACE = '/root/.openclaw/workspace'
const PROJECT_SOURCE = path.join(WORKSPACE, 'project_source')

const PRE = path.join(WORKSPACE, 'os', 'preflight.js')
const ROUTER = path.join(WORKSPACE, 'os', 'model-routing.js')
const HAT_PROFILES = path.join(WORKSPACE, 'os', 'hat-profiles.json')
const OPENCLAW_JSON = '/root/.openclaw/openclaw.json'

function read(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return '' }
}

function nowPhoenixStamp() {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return dtf.format(new Date()) + ' (America/Phoenix)'
}

function readHatProfiles() {
  try {
    const j = JSON.parse(fs.readFileSync(HAT_PROFILES, 'utf8'))
    return j?.hats || {}
  } catch {
    return {}
  }
}

function extractHatKeys(pre) {
  const hats = readHatProfiles()
  const keys = Object.keys(hats)
  if (keys.length) return keys.sort()

  const m = pre.match(/const\s+HATS\s*=\s*\{([\s\S]*?)\n\};/)
  if (!m) return []
  const parsed = []
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*\{\s*$/)
    if (mm) parsed.push(mm[1] || mm[2] || mm[3])
  }
  return Array.from(new Set(parsed)).sort()
}

function extractRequiredFields(pre) {
  const m = pre.match(/const\s+REQUIRED_FIELDS\s*=\s*\[([\s\S]*?)\];/)
  if (!m) return []
  const out = []
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/'([^']+)'/)
    if (mm) out.push(mm[1])
  }
  return out
}

function extractRoutes(router) {
  const m = router.match(/const\s+ROUTES\s*=\s*\{([\s\S]*?)\n\};/)
  if (!m) return {}
  const body = m[1]
  const routes = {}
  let current = null
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    const cat = line.match(/^([A-Za-z0-9_]+)\s*:\s*\[$/)
    if (cat) {
      current = cat[1]
      routes[current] = []
      continue
    }
    if (current) {
      if (line.startsWith(']')) { current = null; continue }
      const mm = line.match(/^'([^']+)'\s*,?$/)
      if (mm) routes[current].push(mm[1])
    }
  }
  return routes
}

function readDefaultChain() {
  try {
    const j = JSON.parse(fs.readFileSync(OPENCLAW_JSON, 'utf8'))
    const m = j?.agents?.defaults?.model || {}
    return { primary: m.primary || 'unknown', fallbacks: Array.isArray(m.fallbacks) ? m.fallbacks : [] }
  } catch {
    return { primary: 'unknown', fallbacks: [] }
  }
}

function main() {
  fs.mkdirSync(PROJECT_SOURCE, { recursive: true })
  const pre = read(PRE)
  const router = read(ROUTER)

  const hats = extractHatKeys(pre)
  const hatProfiles = readHatProfiles()
  const required = extractRequiredFields(pre)
  const routes = extractRoutes(router)
  const chain = readDefaultChain()

  const architecture = [
    '# ARCHITECTURE_SUMMARY.md',
    '',
    `Generated: ${nowPhoenixStamp()}`,
    '',
    '## Execution flow (workspace level)',
    '- os/preflight.js runs before hat execution and validates the Task Envelope contract.',
    '- scripts/run-project-source-check.mjs runs source checks and auto-generates project_source docs.',
    '- scripts/arch-drift-check.mjs classifies cosmetic/structural/behavioral drift and blocks silent HIGH-severity reconciliation.',
    '- scripts/export-project-source.mjs creates EXPORT_LATEST.md and dist/bort_source_bundle.tgz.',
    '',
    '## Enforcement highlights',
    `- hats allowlist: ${hats.length ? hats.join(', ') : '(none detected)'}`,
    `- required envelope fields: ${required.length ? required.join(', ') : '(none detected)'}`,
    '- externalStateChange=true requires approvalNeeded=true.',
    '- high sensitivity output suppression is enforced by explicit blocklist patterns in os/preflight.js.',
    '',
    '## Source of truth',
    '- Canonical shareable state is maintained in project_source/*.md and exported via EXPORT_LATEST.md.',
    '',
  ].join('\n')

  const routeLines = []
  for (const [cat, models] of Object.entries(routes)) {
    routeLines.push(`### ${cat}`)
    if (!models.length) routeLines.push('- (none)')
    else for (const m of models) routeLines.push(`- ${m}`)
    routeLines.push('')
  }

  const routing = [
    '# ROUTING_STATE.md',
    '',
    `Generated: ${nowPhoenixStamp()}`,
    '',
    '## Global configured defaults',
    `- primary: ${chain.primary}`,
    `- fallbacks: ${chain.fallbacks.length ? chain.fallbacks.join(', ') : '(none)'}`,
    '',
    '## Workspace routing categories (from os/model-routing.js ROUTES)',
    '',
    ...(routeLines.length ? routeLines : ['- (no ROUTES parsed)']),
    '## Notes',
    '- This file is regenerated automatically; manual edits may be overwritten.',
    '',
  ].join('\n')

  const operations = [
    '# OPERATIONS_STATE.md',
    '',
    `Generated: ${nowPhoenixStamp()}`,
    '',
    '## Operations checklist',
    '- Use openclaw models status --json to verify default/fallback chain.',
    '- Use openclaw cron list --json to verify recurring jobs.',
    '- Use scripts/export-project-source.mjs --force to produce export artifacts on demand.',
    '- Upload project_source/EXPORT_LATEST.md (or dist/bort_source_bundle.tgz) to external ideation threads.',
    '',
    '## Artifact paths',
    '- project_source/EXPORT_LATEST.md',
    '- dist/bort_source_bundle.tgz',
    '- memory/to_upload.md (notification log)',
    '',
  ].join('\n')

  const hatLines = []
  for (const name of Object.keys(hatProfiles).sort()) {
    const h = hatProfiles[name] || {}
    hatLines.push(`### ${name}`)
    hatLines.push(`- description: ${h.description || '(none)'}`)
    hatLines.push(`- allowedIdentityContexts: ${Array.isArray(h.allowedIdentityContexts) ? h.allowedIdentityContexts.join(', ') : '(none)'}`)
    hatLines.push(`- allowedTaskTypes: ${Array.isArray(h.allowedTaskTypes) ? h.allowedTaskTypes.join(', ') : '(none)'}`)
    hatLines.push(`- defaultDataSensitivity: ${h.defaultDataSensitivity || '(none)'}`)
    hatLines.push(`- allowedSkills: ${Array.isArray(h.allowedSkills) ? h.allowedSkills.join(', ') : '(none)'}`)
    hatLines.push(`- allowedCommands: ${Array.isArray(h.allowedCommands) && h.allowedCommands.length ? h.allowedCommands.join(' | ') : '(none)'}`)
    hatLines.push(`- defaultModelChain: ${Array.isArray(h.defaultModelChain) ? h.defaultModelChain.join(', ') : '(none)'}`)
    hatLines.push(`- outputStyle: ${h.outputStyle || '(none)'}`)
    hatLines.push('')
  }

  const hatState = [
    '# HAT_STATE.md',
    '',
    `Generated: ${nowPhoenixStamp()}`,
    '',
    `- profile_source: ${HAT_PROFILES}`,
    `- hat_count: ${Object.keys(hatProfiles).length}`,
    '',
    '## Hat profiles',
    '',
    ...(hatLines.length ? hatLines : ['- (no hat profiles found)', '']),
  ].join('\n')

  fs.writeFileSync(path.join(PROJECT_SOURCE, 'ARCHITECTURE_SUMMARY.md'), architecture + '\n', 'utf8')
  fs.writeFileSync(path.join(PROJECT_SOURCE, 'ROUTING_STATE.md'), routing + '\n', 'utf8')
  fs.writeFileSync(path.join(PROJECT_SOURCE, 'OPERATIONS_STATE.md'), operations + '\n', 'utf8')
  fs.writeFileSync(path.join(PROJECT_SOURCE, 'HAT_STATE.md'), hatState + '\n', 'utf8')
}

main()
