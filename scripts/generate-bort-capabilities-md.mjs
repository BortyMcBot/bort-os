#!/usr/bin/env node
import fs from 'fs'

const SNAPSHOT_PATH = '/root/.openclaw/workspace/source/bort_registry.snapshot.json'
const OUT_PATH = '/root/.openclaw/workspace/source/BORT_CAPABILITIES.md'

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function mdEscapeInline(s) {
  return String(s).replace(/`/g, '\\`')
}

function main() {
  const snap = readJson(SNAPSHOT_PATH)

  const hats = (snap.hats || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const commands = (snap.commands || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const sops = (snap.sops || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const schema = snap.prompt_template_schema || {}
  const fields = (schema.fields || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const optional = (schema.optional_fields || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const lines = []
  lines.push('# BORT_CAPABILITIES.md')
  lines.push('')
  lines.push(`Generated from snapshot: \`${SNAPSHOT_PATH}\``)
  lines.push('')
  lines.push('Canonical truth:')
  lines.push(`- \`source/bort_registry.snapshot.json\``)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## How to choose a hat')
  lines.push('')
  lines.push('Hats are enforced by the workspace preflight allowlist in:')
  lines.push('')
  lines.push('- `/root/.openclaw/workspace/os/preflight.js`')
  lines.push('')
  lines.push('Available hats (alphabetical):')
  lines.push('')
  for (const h of hats) {
    lines.push(`- \`${mdEscapeInline(h.name)}\` — ${h.purpose || 'unknown'}`)
  }
  lines.push('')
  lines.push('Notes:')
  lines.push('')
  lines.push('- If anything is unknown, it is recorded as `unknown` in the JSON snapshot rather than guessed.')
  lines.push('')

  lines.push('## Command quick reference')
  lines.push('')
  for (const c of commands) {
    lines.push(`### ${mdEscapeInline(c.name)}`)
    lines.push('')
    lines.push(c.description || 'unknown')
    lines.push('')
    if (Array.isArray(c.examples) && c.examples.length) {
      lines.push('Examples:')
      lines.push('')
      for (const ex of c.examples) lines.push(`- \`${mdEscapeInline(ex)}\``)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('## SOP index')
  lines.push('')
  for (const s of sops) {
    lines.push(`- \`${mdEscapeInline(s.name)}\` — ${s.when_to_use || 'unknown'}`)
  }
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push('## Template schema overview')
  lines.push('')
  lines.push(`Schema source: ${schema.source || 'unknown'}`)
  lines.push('')
  lines.push('Required fields (alphabetical):')
  lines.push('')
  for (const f of fields) {
    const enumPart = f.enumeration ? ` enum=${Array.isArray(f.enumeration) ? f.enumeration.join('|') : String(f.enumeration)}` : ''
    lines.push(`- \`${mdEscapeInline(f.name)}\` (${mdEscapeInline(f.type || 'unknown')})${enumPart}`)
  }
  lines.push('')
  if (optional.length) {
    lines.push('Optional fields (alphabetical):')
    lines.push('')
    for (const f of optional) {
      const enumPart = f.enumeration ? ` enum=${Array.isArray(f.enumeration) ? f.enumeration.join('|') : String(f.enumeration)}` : ''
      lines.push(`- \`${mdEscapeInline(f.name)}\` (${mdEscapeInline(f.type || 'unknown')})${enumPart}`)
    }
    lines.push('')
  }

  fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')
}

main()
