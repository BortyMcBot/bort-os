# SOP.md — How Bort Operates (Standard Operating Procedure)

This document is the working SOP for Bort (OpenClaw) to stay consistently helpful and predictable.

## 0) Ground rules

- **No magic access.** I can only act on accounts you explicitly authorize (OAuth/API keys).
- **Safety > speed.** No destructive actions (delete/trash, unsubscribing broadly, config changes) without clear intent.
- **Write it down.** Preferences, rules, and repeatable workflows should be captured in files under the workspace.
- **Prefer reliable automation.** Use systemd timers for recurring tasks that must run even when the agent is idle.

---

## 1) Primary capabilities & how we implement them

### 1. Read/organize/reply to email (Gmail)

**Current integration:** Gmail API via OAuth (`gmail.modify`).

**Where secrets live (per account):**
- `~/.openclaw/secrets/gmail/<slug>/credentials.json`
- `~/.openclaw/secrets/gmail/<slug>/token.json`

**Core labeling model (mutually-exclusive buckets):**
- `Bort/Important` (starred)
- `Bort/Other`
- `Bort/Subscription`
- `Bort/SpamReview`

**Daily 6am Pacific summary:**
- Implemented via systemd user timer:
  - `~/.config/systemd/user/bort-gmail-daily.timer`
  - `~/.config/systemd/user/bort-gmail-daily.service`
  - Script: `integrations/gmail/daily-summary.sh`
- The job:
  - runs `integrations/gmail/daily-review.js` (max 50)
  - sends a Telegram summary
  - auto-unsubscribes + marks read for `Bort/SpamReview` (best-effort)

**When auth breaks:**
- Symptoms: `invalid_grant` or `insufficient authentication scopes`.
- Fix: regenerate `token.json` on a machine with a browser (Mac/PC) via `integrations/gmail/auth.js`, then upload to droplet.

**Replying to email:**
- Not yet automated end-to-end.
- Safe approach: draft replies + user approval; then send.

---

### 2. Internet search / research

**Preferred:** configure Brave Search tool for fast citations.
- Needs `BRAVE_API_KEY` (OpenClaw `configure --section web`).

**Fallbacks:**
- `web_fetch` for URLs you provide.
- Browser automation requires a supported browser engine installed.

---

### 3. Advice when requested

- Keep answers concise and actionable.
- Ask clarifying questions only when required.
- When uncertain, explicitly state uncertainty and propose a verification path.

---

### 4. Self-preservation (continuity)

**What must survive a droplet loss:**
- `~/.openclaw/openclaw.json` (gateway config)
- `/root/.openclaw/workspace/` (scripts + runbooks + memory)
- `~/.openclaw/secrets/` (OAuth tokens) — **should be encrypted if backed up**
- systemd user units: `~/.config/systemd/user/*bort*`

**Backup plan (pending):**
- Weekly backup bundle to Google Drive.
- Recommend two bundles:
  - Safe (workspace + config)
  - Secrets (encrypted)

---

## 2) Operating modes

### Mode A — Interactive assistance
Use when you’re present and want decision-making.

### Mode B — Scheduled “reporting” automation
Use systemd timers for:
- daily Gmail summary
- periodic backlog/sweep jobs (when needed)

---

## 3) Engineering standards for scripts

- Must be **resumable** if the task is long-running.
- Minimize Gmail API calls per thread.
- Keep logs to a known file.
- Never print secrets.

---

## 4) Files of record

- `MEMORY.md` — long-term identity and preferences.
- `memory/YYYY-MM-DD.md` — daily notes.
- `integrations/gmail/RUNBOOK.md` — Gmail playbook.
- `SOP.md` (this file).
- `TODO.md` — actionable items requiring Bryan’s help.
