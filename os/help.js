#!/usr/bin/env node

// Minimal, Telegram-safe help. No secrets.
// Derives hats + required envelope fields from memory/hats.md where possible.
// Derives skills from installed skill folders (SKILL.md frontmatter) where possible.

const fs = require('fs');
const path = require('path');

function line(s = '') {
  process.stdout.write(String(s) + '\n');
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function parseFrontmatter(md) {
  // very small YAML subset: key: value (single line)
  const out = {};
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return out;
  const block = m[1];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    // strip simple quotes
    v = v.replace(/^['"]|['"]$/g, '');
    out[k] = v;
  }
  return out;
}

function deriveFromHatsMd() {
  const hatsPath = path.join(process.cwd(), 'memory', 'hats.md');
  const md = safeRead(hatsPath);
  if (!md) {
    return { hats: [], requiredFields: [] };
  }

  // hats from line: "- hat: inbox | web | resale | ops-core"
  const hatsLine = md.split('\n').find((l) => l.trim().startsWith('- hat:'));
  const hats = hatsLine
    ? hatsLine
        .split(':')[1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // required fields: parse bullets under "## Envelope (required)" until blank line
  const requiredFields = [];
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === '## Envelope (required)');
  if (startIdx !== -1) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim().startsWith('### ') || l.trim().startsWith('---')) break;
      if (!l.trim()) continue;
      // Only top-level fields (no indentation). Avoid nested bullets like memoryScope.read/write.
      const m = l.match(/^-\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*:/);
      if (m) requiredFields.push(m[1]);
      if (l.trim().startsWith('### Rules')) break;
    }
  }

  return { hats, requiredFields };
}

function deriveSkills() {
  const skillsDir = '/usr/lib/node_modules/openclaw/skills';
  let dirs = [];
  try {
    dirs = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return { skills: [], total: 0 };
  }

  const skills = [];
  for (const d of dirs) {
    const p = path.join(skillsDir, d, 'SKILL.md');
    const md = safeRead(p);
    if (!md) continue;
    const fm = parseFrontmatter(md);
    const name = fm.name || d;
    const description = fm.description || '';
    skills.push({ name, description });
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { skills, total: skills.length };
}

const { hats, requiredFields } = deriveFromHatsMd();
const { skills, total } = deriveSkills();

line('Bort OS — help (safe)');
line('');

line('Hats (available):');
if (hats.length) {
  for (const h of hats) line(`- ${h}`);
} else {
  line('- (unknown; see memory/hats.md)');
}
line('');

line('Task Envelope (required fields):');
if (requiredFields.length) {
  for (const f of requiredFields) line(`- ${f}`);
} else {
  line('- (unknown; see memory/hats.md)');
}
line('');

line(`Skills (installed): ${total}`);
const MAX = 20;
for (const s of skills.slice(0, MAX)) {
  line(`- ${s.name}: ${s.description || '(no description)'}`);
}
if (total > MAX) line(`- ... (+${total - MAX} more)`);
line('');

line('Common approval commands:');
line('- approve_openrouter_setup: yes');
line('- approve_openrouter_routing_changes: yes');
line('- approve_state_report_update: yes');
line('- approve_help_command: yes');
line('- Pattern: approve_<thing>: yes');
line('');

line('Model inventory:');
line('- node os/models_inventory.js');
