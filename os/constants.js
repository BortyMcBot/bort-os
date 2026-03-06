// Shared constants for bort-os scripts.
// Single source of truth — import this instead of hardcoding values.

const TELEGRAM_CHAT_ID = '8374853956';
const BORT_WORKSPACE = process.env.BORT_WORKSPACE || '/root/.openclaw/workspace';

module.exports = { TELEGRAM_CHAT_ID, BORT_WORKSPACE };
