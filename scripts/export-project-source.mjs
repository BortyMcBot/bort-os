#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const PROJECT_SOURCE_DIR = '/root/.openclaw/workspace/project_source'
const HASHES_PATH = path.join(PROJECT_SOURCE_DIR, '.hashes.json')
const EXPORT_PATH = path.join(PROJECT_SOURCE_DIR, 'EXPORT_LATEST.md')
const TO_UPLOAD_PATH = '/root/.openclaw/workspace/memory/to_upload.md'

const CANONICAL_FILES = [
  'FILE_INDEX.md',
  'SYSTEM_CONTEXT.md',
  'ARCHITECTURE_SUMMARY.md',
  'ROUTING_STATE.md',
  'OPERATIONS_STATE.md',
  'CHANGELOG_AUTOGEN.md',
]

function nowPhoenixStamp() {
  // Deterministic formatting (no ISO/UTC leakage): “Feb 25, 2026 • 7:14 PM”
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

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
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

function ensureFileExists(filePath, placeholder) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, placeholder, 'utf8')
  }
}

function tailLastLines(text, maxLines) {
  const lines = text.split(/\r?\n/)
  if (lines.length <= maxLines) return text
  return lines.slice(lines.length - maxLines).join('\n')
}

function buildExportMd({ changedFiles, fileContentsByName }) {
  const stamp = nowPhoenixStamp()
  const changedList = changedFiles.length ? changedFiles.map((f) => `- ${f}`).join('\n') : '- (none)'

  const ordered = CANONICAL_FILES

  const sections = ordered
    .map((name) => {
      const content = fileContentsByName.get(name) ?? ''
      return `## ${name}\n\n${content.trimEnd()}\n`
    })
    .join('\n')

  return [
    '# Project Source Export (UPLOAD THIS FILE)',
    '',
    `Generated: ${stamp} (America/Phoenix)`,
    '',
    'Changed files since last export:',
    changedList,
    '',
    '---',
    '',
    sections.trimEnd(),
    '',
  ].join('\n')
}

function notificationBlock(changedFiles) {
  const changedList = changedFiles.map((f) => `- ${f}`).join('\n')
  return [
    '[BORT_SOURCE_UPDATE]',
    'changed_files:',
    changedList || '- (none)',
    'export_bundle:',
    `- ${EXPORT_PATH}`,
    'next_step_for_bryan:',
    '- Upload EXPORT_LATEST.md into ChatGPT project',
  ].join('\n')
}

function prependUniqueToUpload(block) {
  ensureFileExists(TO_UPLOAD_PATH, '')
  const existing = fs.readFileSync(TO_UPLOAD_PATH, 'utf8')
  if (existing.startsWith(block + '\n') || existing.includes(block + '\n\n')) return false
  const next = `${block}\n\n${existing}`
  fs.writeFileSync(TO_UPLOAD_PATH, next, 'utf8')
  return true
}

function main() {
  const args = new Set(process.argv.slice(2))
  const force = args.has('--force')
  const quiet = args.has('--quiet')
  const quietNoChanges = args.has('--quiet-no-changes')

  fs.mkdirSync(PROJECT_SOURCE_DIR, { recursive: true })

  const hashesExisted = fs.existsSync(HASHES_PATH)

  // Load prior hashes
  const prev = readJsonSafe(HASHES_PATH) || { version: 1, files: {} }
  const prevFiles = prev.files || {}

  const nextFiles = {}
  const changed = []

  for (const name of CANONICAL_FILES) {
    const p = path.join(PROJECT_SOURCE_DIR, name)
    ensureFileExists(p, `# ${name}\n\n(TODO)\n`)

    const hash = sha256File(p)
    nextFiles[name] = { sha256: hash }

    const prevHash = prevFiles?.[name]?.sha256
    if (hashesExisted && prevHash && prevHash !== hash) changed.push(name)
  }

  // Always update hashes (baseline creation, and after change)
  writeJson(HASHES_PATH, { version: 1, updatedPhoenix: nowPhoenixStamp(), files: nextFiles })

  // Baseline: create hashes only; no export/notification.
  if (!hashesExisted && !force) {
    if (!quiet && !quietNoChanges) console.log('[BORT_SOURCE_UPDATE] baseline created (no changes)')
    return { changedFiles: [] }
  }

  const shouldExport = force || changed.length > 0
  if (!shouldExport) {
    if (!quiet && !quietNoChanges) console.log('[BORT_SOURCE_UPDATE] no changes')
    return { changedFiles: [] }
  }

  // Gather contents in fixed order.
  const contents = new Map()
  for (const name of CANONICAL_FILES) {
    const p = path.join(PROJECT_SOURCE_DIR, name)
    let text = fs.readFileSync(p, 'utf8')
    if (name === 'CHANGELOG_AUTOGEN.md') {
      text = tailLastLines(text, 200)
    }
    contents.set(name, text)
  }

  const exportMd = buildExportMd({ changedFiles: changed, fileContentsByName: contents })
  fs.writeFileSync(EXPORT_PATH, exportMd, 'utf8')

  if (changed.length > 0) {
    const block = notificationBlock(changed)
    if (!quiet) console.log(block)
    prependUniqueToUpload(block)
    return { changedFiles: changed }
  }

  // Forced export with no changes
  if (!quiet) console.log('[BORT_SOURCE_UPDATE] forced export (no changes)')
  return { changedFiles: [] }
}

main()
