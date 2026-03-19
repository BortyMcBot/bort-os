// Shared constants for bort-os scripts.
// Single source of truth — import this instead of hardcoding values.

const fs = require('fs');

const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/root/.openclaw/openclaw.json';

function resolveTelegramChatId() {
  const fromEnv = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
    const fromCfg = String(cfg?.env?.vars?.TELEGRAM_CHAT_ID || '').trim();
    return fromCfg || '';
  } catch {
    return '';
  }
}

const TELEGRAM_CHAT_ID = resolveTelegramChatId();
const BORT_WORKSPACE = process.env.BORT_WORKSPACE || '/root/.openclaw/workspace';

module.exports = { TELEGRAM_CHAT_ID, BORT_WORKSPACE, OPENCLAW_CONFIG_PATH };
