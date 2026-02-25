# Gmail Cleanup Runbook (Bort)

This runbook captures the approach we used to triage and reduce a large unread Inbox backlog for a personal Gmail account.

## Goals

- Bucket emails into 4 mutually-exclusive labels:
  - `Bort/Important` (starred; left unread)
  - `Bort/Other` (left unread)
  - `Bort/Subscription` (marked read during cleanup)
  - `Bort/SpamReview` (marked read during cleanup)
- Only archive automatically for senders you explicitly unsubscribed from (opt-in list).
- Avoid deleting anything automatically.

## Gmail authorization

- Use Gmail API OAuth with scope `https://www.googleapis.com/auth/gmail.modify`.
- Store secrets per account under:
  - `~/.openclaw/secrets/gmail/<accountSlug>/credentials.json`
  - `~/.openclaw/secrets/gmail/<accountSlug>/token.json`

## Labels

Create once per account:

- `Bort/Important`
- `Bort/Other`
- `Bort/Subscription`
- `Bort/SpamReview`
- optional: `Bort/WaitingOn`

Script used: `setup-labels.js`

## Classification rules

### Subscription detection

- Treat as Subscription when the message contains a `List-Unsubscribe` header.

### SpamReview detection

- If it is a Subscription AND `looksSpammy(subject, from)` matches (keyword heuristics), label `Bort/SpamReview`.

### Important detection (conservative)

- ONLY label/star Important when `looksImportant()` matches.
- `looksImportant()` uses:
  - `prefs.important.senderAllowlist` (explicit allow)
  - `prefs.important.subjectKeywords` (signals like invoice/receipt/security/etc.)
  - `prefs.unimportant.senderBlocklist` (explicit *not* important)

Example: Experian `support@s.usa.experian.com` was explicitly marked NOT important.

### Other

- Non-subscription + not important => `Bort/Other`.

## Actions during cleanup phase (backlog sweep)

For query: `in:inbox is:unread`

Per thread:
- Always add one bucket label (`Bort/Important|Other|Subscription|SpamReview`).
- Star only if bucket=Important.
- Mark as read ONLY if bucket is Subscription or SpamReview (remove `UNREAD`).
- Leave Important and Other unread.
- Archive (remove `INBOX`) only if sender is in `prefs.archiveAfterUnsubscribe.senders`.

Backlog sweep script: `backlog-sweep.js`

### Performance note

Optimize to keep API calls low:
- 1x `threads.get` (metadata headers)
- 1x `threads.modify` that combines addLabelIds + removeLabelIds

## Daily review phase (ongoing)

Daily review should:
- Fetch `in:inbox is:unread` (limited sample)
- Apply bucket labels
- Star Important only
- Do **not** change read/unread status (unless you want it)

Script: `daily-review.js`

## Unsubscribe automation

`unsubscribe.js`:
- Extract targets from `List-Unsubscribe` header
- Prefer RFC8058 one-click POST when `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Else try HTTPS GET
- Else send mailto unsubscribe (via Gmail send)

**Caveat:** TLS/cert-chain issues can prevent some GET/POST from server-side environment; manual unsubscribe may be needed.

## State / progress

- Backlog sweep keeps state in `backlog-state-<account>.json` (processedThreads + offenders tallies).
- Accurate unread count requires paging; Gmail `resultSizeEstimate` can be misleading.

## Operational lessons

- Avoid relying on LLM-based cron jobs for long-running automation.
- Prefer OS-level timers (systemd) or a robust scheduler for repeated execution.
- Keep user updates at a sane cadence; avoid multiple overlapping update mechanisms.

## Porting to another inbox

1) Create new OAuth tokens for the other account.
2) Copy `prefs-gobuffs10.json` as a template and adjust allow/block lists.
3) Run `setup-labels.js` for that account.
4) Run `backlog-sweep.js` for that account in small batches.
5) Iterate on `looksImportant()` prefs as user provides feedback.
