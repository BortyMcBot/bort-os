function looksSpammy(subject, from) {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  const spamWords = ['winner', 'claim', 'bitcoin', 'crypto', 'loan', 'urgent', 'act now', 'limited time', 'congratulations'];
  if (spamWords.some((w) => s.includes(w))) return true;
  if (f.includes('noreply') && (s.includes('offer') || s.includes('deal'))) return true;
  return false;
}

function looksImportant({ fromEmail, subject }, prefs) {
  const from = (fromEmail || '').toLowerCase();
  const subj = (subject || '').toLowerCase();

  const block = (prefs?.unimportant?.senderBlocklist || []).map((s) => String(s).toLowerCase());
  if (block.includes(from)) return false;

  const allow = (prefs?.important?.senderAllowlist || []).map((s) => String(s).toLowerCase());
  if (allow.includes(from)) return true;

  const keys = (prefs?.important?.subjectKeywords || []).map((s) => String(s).toLowerCase());
  if (keys.some((k) => k && subj.includes(k))) return true;

  // Default: conservative (do NOT mark important unless we have a signal)
  return false;
}

module.exports = { looksSpammy, looksImportant };
