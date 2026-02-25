import express from 'express'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const app = express()

const HOST = '127.0.0.1'
const PORT = process.env.PORT ? Number(process.env.PORT) : 18790

// --- Strict allowlist ---
const ALLOWED_FILES = new Map([
  ['x_post_queue.md', '/root/.openclaw/workspace/memory/x_post_queue.md'],
  ['x_post_results.log.md', '/root/.openclaw/workspace/memory/x_post_results.log.md'],
  ['x_digest.log.md', '/root/.openclaw/workspace/memory/x_digest.log.md'],
  ['x_digest_state.json', '/root/.openclaw/workspace/memory/x_digest_state.json'],
  ['x_queue.md', '/root/.openclaw/workspace/memory/x_queue.md'],
  ['x_budget_ledger.json', '/root/.openclaw/workspace/memory/x_budget_ledger.json'],
])

const LOG_DIR = '/tmp/openclaw'

function phoenixFormat(ms) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const parts = dtf.formatToParts(new Date(ms))
    const get = (t) => parts.find((p) => p.type === t)?.value
    // Example: Feb 25, 2026 • 7:14 PM
    return `${get('month')} ${get('day')}, ${get('year')} • ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
  } catch {
    return 'Unknown time'
  }
}

function minutesAgo(ms) {
  const d = Date.now() - ms
  if (!Number.isFinite(d)) return null
  const m = Math.floor(d / 60000)
  if (m < 0) return null
  if (m === 0) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function statSafe(filePath) {
  const st = fs.statSync(filePath)
  return {
    path: filePath,
    size: st.size,
    mtimeMs: st.mtimeMs,
    mtimePhoenix: phoenixFormat(st.mtimeMs),
    mtimeRelative: minutesAgo(st.mtimeMs),
  }
}

function redactLine(line) {
  // Basic redaction to avoid accidentally returning secrets in logs.
  // This is intentionally conservative and will over-redact.
  const patterns = [
    /(api[_-]?key\s*[:=]\s*)([^\s"']+)/ig,
    /(bearer\s+)([^\s"']+)/ig,
    /(authorization\s*[:=]\s*)([^\s"']+)/ig,
    /(token\s*[:=]\s*)([^\s"']+)/ig,
    /(secret\s*[:=]\s*)([^\s"']+)/ig,
  ]
  let out = line
  for (const re of patterns) {
    out = out.replace(re, (_, a) => `${a}[REDACTED]`)
  }
  return out
}

function readAllowedFile(key) {
  const p = ALLOWED_FILES.get(key)
  if (!p) {
    const err = new Error('File not allowed')
    err.status = 400
    throw err
  }
  return fs.readFileSync(p, 'utf8')
}

function parseMarkdownListItems(md) {
  // Best-effort parser: treats lines starting with '-' as items.
  const lines = md.split(/\r?\n/)
  const items = []
  for (const raw of lines) {
    const m = raw.match(/^\s*-\s+(.*)$/)
    if (m) items.push(m[1].trim())
  }
  return items
}

function parseResults(md) {
  // Best-effort: split into blocks by headings '##'
  const blocks = md.split(/\n##\s+/).map((b) => b.trim()).filter(Boolean)
  return blocks.slice(0, 50).map((b) => {
    const [firstLine, ...rest] = b.split(/\r?\n/)
    return {
      title: firstLine.trim(),
      lines: rest.filter(Boolean).slice(0, 10),
    }
  })
}

function serviceStatus(serviceName) {
  // Read-only: systemctl show
  const cmd = `systemctl --user show ${serviceName} --no-pager --property=Id,ActiveState,SubState,ExecMainPID,Description,UnitFileState,StateChangeTimestamp,ActiveEnterTimestamp`
  const out = execSync(cmd, { encoding: 'utf8' })
  const obj = {}
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('=')) continue
    const [k, v] = line.split('=')
    obj[k] = v
  }

  // systemctl provides human strings like: "Wed 2026-02-25 07:47:45 UTC"
  // We never return raw UTC strings to the UI.
  const ts = obj.ActiveEnterTimestamp || obj.StateChangeTimestamp || ''
  let sinceMs = null
  if (ts) {
    const parsed = Date.parse(ts)
    if (!Number.isNaN(parsed)) sinceMs = parsed
  }

  return {
    id: obj.Id || serviceName,
    description: obj.Description || '',
    unitFileState: obj.UnitFileState || '',
    activeState: obj.ActiveState || 'unknown',
    subState: obj.SubState || 'unknown',
    execMainPid: obj.ExecMainPID ? Number(obj.ExecMainPID) : null,
    sincePhoenix: sinceMs ? phoenixFormat(sinceMs) : null,
    sinceRelative: sinceMs ? minutesAgo(sinceMs) : null,
  }
}


app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/services', (req, res) => {
  const services = [
    'openclaw-gateway.service',
    'openclaw-x-digest.service',
    'openclaw-x-post.service',
  ]
  const data = services.map((s) => {
    try {
      return { ok: true, ...serviceStatus(s) }
    } catch (e) {
      return { ok: false, id: s, error: 'unavailable' }
    }
  })
  res.json({ services: data })
})

app.get('/api/artifacts', (req, res) => {
  const artifacts = []
  for (const [key, filePath] of ALLOWED_FILES.entries()) {
    try {
      artifacts.push({ key, ...statSafe(filePath) })
    } catch {
      artifacts.push({ key, path: filePath, missing: true })
    }
  }
  res.json({ artifacts })
})

app.get('/api/queue', (req, res) => {
  const a = readAllowedFile('x_post_queue.md')
  const b = readAllowedFile('x_queue.md')
  res.json({
    xPostQueue: parseMarkdownListItems(a).slice(0, 200),
    xQueue: parseMarkdownListItems(b).slice(0, 200),
  })
})

app.get('/api/results', (req, res) => {
  const md = readAllowedFile('x_post_results.log.md')
  res.json({ results: parseResults(md) })
})

app.get('/api/digest', (req, res) => {
  const md = readAllowedFile('x_digest.log.md')
  let state = null
  try {
    state = JSON.parse(readAllowedFile('x_digest_state.json'))
  } catch {
    state = null
  }

  // Basic summary: first ~40 non-empty lines.
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length)
    .slice(0, 40)
    .map(redactLine)

  res.json({ state, previewLines: lines })
})

app.get('/api/logs', (req, res) => {
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith('openclaw-') && f.endsWith('.log'))
    .map((f) => {
      const p = path.join(LOG_DIR, f)
      try {
        const st = statSafe(p)
        return {
          filename: f,
          size: st.size,
          mtimeMs: st.mtimeMs,
          mtimePhoenix: st.mtimePhoenix,
          mtimeRelative: st.mtimeRelative,
        }
      } catch {
        return { filename: f, missing: true }
      }
    })
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))

  res.json({ files, default: files[0]?.filename || null })
})

app.get('/api/logs/:filename', (req, res) => {
  const filename = String(req.params.filename || '')
  if (!/^openclaw-[A-Za-z0-9\-]+\.log$/.test(filename)) {
    return res.status(400).json({ error: 'invalid filename' })
  }

  const p = path.join(LOG_DIR, filename)
  // Ensure we never leave LOG_DIR
  if (!p.startsWith(LOG_DIR + path.sep)) {
    return res.status(400).json({ error: 'invalid path' })
  }

  const tailN = Math.min(Math.max(Number(req.query.tail || 500), 50), 5000)
  const grep = typeof req.query.grep === 'string' ? req.query.grep : null

  const raw = fs.readFileSync(p, 'utf8')
  const lines = raw.split(/\r?\n/)
  const sliced = lines.slice(Math.max(0, lines.length - tailN))

  const filtered = (grep ? sliced.filter((l) => l.includes(grep)) : sliced).map(redactLine)

  res.json({ filename, tail: tailN, grep, lines: filtered })
})

app.use((err, req, res, next) => {
  const status = err?.status || 500
  res.status(status).json({ error: status === 500 ? 'internal error' : err.message })
})

app.listen(PORT, HOST, () => {
  console.log(`bort-ui server listening on http://${HOST}:${PORT}`)
})
