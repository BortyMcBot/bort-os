// Minimal memory/log writer for Project 1 Router Enforcement.
// Writes concise, dated entries (1–3 lines) to memory/logs.md
// AND hat-scoped entries to memory/<hat>.md.
//
// Rules:
// - No secrets.
// - For dataSensitivity=high: never write raw payload content.

const fs = require('fs');
const path = require('path');

function isoDateUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function nowUtcStamp(d = new Date()) {
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function ensure1to3(lines) {
  const safe = lines.map((l) => String(l)).filter(Boolean);
  return safe.slice(0, 3);
}

function hatFilePath(hat) {
  const map = {
    inbox: 'inbox.md',
    web: 'web.md',
    resale: 'resale.md',
    'ops-core': 'ops.md',
  };
  const file = map[hat];
  if (!file) throw new Error(`unknown hat for logging: ${hat}`);
  return path.join(process.cwd(), 'memory', file);
}

function appendBlock(filePath, heading, lines) {
  const block = `\n## ${heading}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
  fs.appendFileSync(filePath, block, 'utf8');
}

function appendLog({ lines, heading }) {
  const logsPath = path.join(process.cwd(), 'memory', 'logs.md');
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('lines required');

  const date = isoDateUtc();
  const hdr = heading || `${date} — skill`;
  appendBlock(logsPath, hdr, ensure1to3(lines));
  return { logsPath, heading: hdr };
}

function appendHatLog({ hat, dataSensitivity = 'medium', heading, lines }) {
  if (!hat) throw new Error('hat required');

  // High sensitivity: only allow meta lines.
  const safeLines = ensure1to3(lines || []);
  const filtered =
    dataSensitivity === 'high'
      ? safeLines.map(() => 'Logged high-sensitivity event (details suppressed).')
      : safeLines;

  const filePath = hatFilePath(hat);
  const hdr = heading || `${nowUtcStamp()} — ${hat} event`;
  appendBlock(filePath, hdr, filtered.length ? filtered : ['(no details)']);
  return { filePath, heading: hdr };
}

module.exports = { appendLog, appendHatLog, nowUtcStamp };
