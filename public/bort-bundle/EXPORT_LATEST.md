# Project Source Export (UPLOAD THIS FILE)

Generated: Mar 15, 2026 • 6:01 PM (America/Phoenix)

Changed files since last export:
- HAT_STATE.md
- ARCHITECTURE_SUMMARY.md
- ROUTING_STATE.md
- OPERATIONS_STATE.md

---

## FILE_INDEX.md

# FILE_INDEX.md

Canonical project_source files exported to ChatGPT context bundles.

- `SYSTEM_CONTEXT.md` — protocol, enforcement, drift handling, and export behavior.
- `STATE_OF_BORT.md` — live runtime snapshot (models, skills, jobs, inventory counts).
- `PROMPT_TEMPLATES.md` — preferred prompt formats for operations with Bort.
- `HAT_STATE.md` — active hat profiles (contexts, task types, model chains, and style policy).
- `ARCHITECTURE_SUMMARY.md` — architecture overview (auto-generated from implementation).
- `ROUTING_STATE.md` — routing strategy/details.
- `OPERATIONS_STATE.md` — operations posture/status.
- `CHANGELOG_AUTOGEN.md` — rolling drift/change log (last 200 lines included in export).
- `EXPORT_LATEST.md` — generated upload-ready consolidated snapshot.
- `SKILL_REGISTRY.md` — installed skill inventory with capabilities, inputs, outputs, and hat compatibility.
- `PROJECTS_ACTIVE.md` — continuity layer tracking in-flight multi-step projects across sessions.
- `PROMPT_ANTIPATTERNS.md` — known prompt patterns that cause failures, rejections, or unexpected behavior.
- `HAT_OS_RESOLUTION.md` — decision doc for the hat:os preflight mismatch. Resolved 2026-03-03 via Option A (alias in preflight.js).
- `CLAUDE_SESSION_OPENER.md` — reusable session-opener template for Claude ideation sessions — paste at start of every new conversation with full project_source bundle attached.

## SYSTEM_CONTEXT.md

# SYSTEM_CONTEXT.md

Generated: Feb 25, 2026 • 9:20 AM (America/Phoenix)

## Source of Truth Maintenance Protocol

The `project_source/` directory is the **canonical “Source of Truth”** for this project’s externally-shareable context.

### What BORT does (automatic)

- Preflight path runs **drift check only** via:
  - `/root/.openclaw/workspace/scripts/run-project-source-check.mjs`
  - `/root/.openclaw/workspace/scripts/arch-drift-check.mjs`
- Scheduled refresh (twice daily) updates generated docs only (no export):
  - `/root/.openclaw/workspace/scripts/refresh-project-source.mjs`
- Export is **on request** and always refreshes first via:
  - `/root/.openclaw/workspace/scripts/export-bort-source.sh`
- Export writes:
  1) `/root/.openclaw/workspace/project_source/EXPORT_LATEST.md`
  2) `/root/.openclaw/workspace/dist/bort_source_bundle.tgz`
  3) `[BORT_SOURCE_UPDATE]` notification block + memory/to_upload.md entry

### What Bryan should do when notified

When you see a `[BORT_SOURCE_UPDATE]` notification:

1) Upload `/root/.openclaw/workspace/project_source/EXPORT_LATEST.md` into the ChatGPT Project (or any external thread that needs to stay accurate).
2) Treat `EXPORT_LATEST.md` as the authoritative snapshot for that update.

### Manual export

You can force an export at any time:

```bash
node /root/.openclaw/workspace/scripts/export-project-source.mjs --force
```

### Canonical files (fixed order)

- `FILE_INDEX.md`
- `SYSTEM_CONTEXT.md`
- `STATE_OF_BORT.md`
- `PROMPT_TEMPLATES.md`
- `HAT_STATE.md`
- `ARCHITECTURE_SUMMARY.md`
- `ROUTING_STATE.md`
- `OPERATIONS_STATE.md`
- `CHANGELOG_AUTOGEN.md` (export includes last 200 lines only)
- `SKILL_REGISTRY.md`
- `PROJECTS_ACTIVE.md`
- `PROMPT_ANTIPATTERNS.md`
- `HAT_OS_RESOLUTION.md`
- `CLAUDE_SESSION_OPENER.md`

## Task Envelope & Hat Enforcement

This repository includes a workspace-level preflight enforcement layer:

- `/root/.openclaw/workspace/os/preflight.js`

### Required envelope fields

The preflight layer expects the Task Envelope to include all fields in `REQUIRED_FIELDS`:

- `hat`
- `intent`
- `taskType`
- `taskSize`
- `risk`
- `dataSensitivity`
- `externalStateChange`
- `identityContext`
- `actions`
- `approvalNeeded`

Source:
- `/root/.openclaw/workspace/os/preflight.js` lines 48–59

### Hat allowlist

Only these hats are defined in the preflight allowlist:

- `inbox`
- `web`
- `resale`
- `ops-core`
- `autonomous`

Source:
- `os/preflight.js` lines 25–46

### Identity context rules

Each hat defines allowed identity contexts, and preflight rejects envelopes that violate them.

Source:
- `os/preflight.js` lines 136–145

### Approval gating

If `externalStateChange === true`, preflight requires `approvalNeeded === true`.

Source:
- `os/preflight.js` lines 162–165

### Per-hat action enforcement

preflight.js enforces allowedCommands and allowedSkills per hat via action tags in the Task Envelope.
Actions not in the hat's allowedCommands or allowedSkills will be rejected at preflight.

### Policy override

preflight.js supports policyOverride and policyOverrideReason fields in the Task Envelope for authorized override scenarios.

### High-sensitivity output suppression

`os/preflight.js` implements deterministic high-sensitivity output suppression using explicit blocklist patterns.
If a blocklist match occurs, the caller must suppress output and show only a pointer message.

Source:
- `os/preflight.js` lines 185–233

### Conversational “Hat: os” is aliased to ops-core — RESOLVED 2026-03-03

Conversational directives that label tasks as `Hat: os` are now handled correctly.
`os/preflight.js` defines `HAT_ALIASES = { os: 'ops-core' }` — envelopes with `hat=os`
are resolved to `ops-core` before allowlist validation and will pass preflight.

Source:

- `os/preflight.js` lines 138–139 (HAT_ALIASES mapping)

No action required. See also: `HAT_OS_RESOLUTION.md` (Option A implemented) and
`PROMPT_ANTIPATTERNS.md` Antipattern 1 (status: RESOLVED).

## Documentation Integrity & Drift Enforcement

This system aims to prevent **silent documentation drift** between live implementation and `project_source/`.

### Drift classification

Each run classifies detected changes as one of:

- **cosmetic**: formatting/whitespace-only changes in canonical markdown
- **structural**: additions/removals of top-level directories under `/root/.openclaw/workspace/`
- **behavioral (HIGH severity)**: changes to key implementation files or extracted architectural invariants

Classification is enforced by:

- `/root/.openclaw/workspace/scripts/arch-drift-check.mjs`

### Behavioral drift (HIGH severity) rules

At minimum, HIGH severity drift triggers if any of the following change:

- Key implementation files:
  - `os/preflight.js`
  - `os/model-routing.js`
- Extracted architectural invariants:
  - Hat allowlist
  - Route categories or ordering
  - Default fallback model

### Enforcement behavior

- **If HIGH severity behavioral drift is detected:**
  - BORT emits a `[BORT_ARCH_DRIFT]` notification block.
  - BORT appends a “Drift Report” section to `CHANGELOG_AUTOGEN.md`.
  - BORT **does not** automatically rewrite canonical docs.
  - BORT **does not** automatically generate a new `EXPORT_LATEST.md` bundle.
  - Bryan must explicitly confirm before documentation reconciliation occurs.

- **If cosmetic or structural drift is detected:**
  - Normal export behavior is allowed (hashing + `EXPORT_LATEST.md` generation + `[BORT_SOURCE_UPDATE]` notification).

## Quality rule (no stubs)

Canonical files in `project_source/` must not remain as `TODO` placeholders.
Stubs create "paper truth" that can mislead external threads.

## Collaborative Development Convention

All commits to the bort-os repo must be authored by BortyMcBot[bot] via the GitHub App.
Bryan's personal GitHub account (NewWorldOrderly) must never appear in repo history.

Branch naming convention:
- claude/ — branches created by Claude Code during Bryan's dev sessions
- bort/ — branches created by Bort in autonomous or ops-core tasks

### PR Review & Merge Policy
All code changes from Claude Code sessions flow through PRs. Bort reviews and merges autonomously.

Workflow:
1. Claude Code pushes a claude/* branch and opens a PR via the BortyMcBot GitHub App
2. Bort reviews PRs at 7am and 6pm Phoenix, or on demand via Telegram /pr-review
3. Approved PRs are squash-merged to main automatically
4. Flagged PRs receive a review comment and Bryan is notified via Telegram

Auto-reject triggers (Bort requests changes, no merge):
- Author is NewWorldOrderly (not via GitHub App)
- project_source/*.md touched directly
- .arch_drift_baseline.json touched directly
- Branch not prefixed claude/ or bort/
- Secret/token patterns detected in diff

Escalate to Bryan triggers (Bort requests changes + Telegram notification):
- Removals in os/preflight.js
- Any change to os/hat-profiles.json
- Additions in os/model-routing.js
- Diff exceeds 500 lines

Safe zones for auto-merge:
- scripts/, integrations/, hats/, docs/

Post-merge behavior:
- Bort sends Telegram confirmation to Bryan (chat ID 8374853956)
- Bort does not delete branches post-merge
- Bort queues a drift baseline rebuild if os/preflight.js or os/model-routing.js were changed

Ownership zones:
- os/preflight.js, os/model-routing.js, os/hat-profiles.json → Bryan+Claude Code
- project_source/*.md, .arch_drift_baseline.json → Bort only
- scripts/, integrations/, hats/ → either, coordination preferred

## STATE_OF_BORT.md

# STATE_OF_BORT.md

Generated: Mar 15, 2026, 6:01 PM (America/Phoenix)

## Runtime snapshot
- model_default: openai-codex/gpt-5.3-codex
- model_resolved_default: openai-codex/gpt-5.3-codex
- model_fallbacks: openrouter/auto, openrouter/arcee-ai/trinity-mini:free, openrouter/nvidia/nemotron-nano-9b-v2:free, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex-spark
- allowed_model_count: 8
- cron_job_count: 9
- workspace_top_level_dirs: 19
- workspace_file_count_recursive: 45998

## Allowed model IDs
- openrouter/auto
- openrouter/arcee-ai/trinity-mini:free
- openrouter/nvidia/nemotron-nano-9b-v2:free
- openai-codex/gpt-5.3-codex
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openai-codex/gpt-5.4
- openai-codex/gpt-5.3-codex-spark

## Installed / available skills
- 1password
- apple-notes
- apple-reminders
- bear-notes
- blogwatcher
- blucli
- bluebubbles
- camsnap
- clawhub
- coding-agent
- discord
- eightctl
- gemini
- gh-issues
- gifgrep
- github
- gog
- goplaces
- healthcheck
- himalaya
- imsg
- mcporter
- model-usage
- nano-banana-pro
- nano-pdf
- notion
- obsidian
- openai-image-gen
- openai-whisper
- openai-whisper-api

## Scheduled jobs (cron)
- Bort project_source refresh (twice daily) (cron: 0 6,18 * * * America/Phoenix)
- PR review (evening) (cron: 0 18 * * * America/Phoenix)
- Bort bundle update (daily) (cron: 0 6,18 * * * America/Phoenix)
- X digest refresh (every 4h budget-safe) (cron: 0 */4 * * * America/Phoenix)
- Daily Gmail summary (gobuffs10) 6am PST (cron: 0 6 * * * America/Los_Angeles)
- PR review (morning) (cron: 0 7 * * * America/Phoenix)
- Repo hygiene check (daily) (cron: 0 7 * * * America/Phoenix)
- X engagement snapshot (daily 8am) (cron: 0 8 * * * America/Phoenix)
- X daily post (BortyMcBot min 1/day) (cron: 0 9 * * * America/Phoenix)

## Export artifacts
- project_source/EXPORT_LATEST.md
- dist/bort_source_bundle.tgz

## Notes
- This file is regenerated by scripts/generate-state-of-bort.mjs.
- It is intended as an external handoff snapshot for ChatGPT projects and audits.

## PROMPT_TEMPLATES.md

# PROMPT_TEMPLATES.md

## 1) Quick execution prompt
Goal: <one sentence outcome>
Context: <relevant state/files/links>
Constraints: <what is allowed / forbidden>
Inputs: <exact paths/data>
Output format: <bullets/json/diff>
Definition of Done: <verifiable checks>

## 2) Read-only audit prompt
Authority: READ-ONLY. No edits, no restarts, no external sends.
Goal: <what to verify>
Checks: <exact commands/files>
Output: raw command output + concise findings.
Done when: <explicit checks pass/fail>

## 3) Safe change prompt (with validation)
Authority: MAY edit workspace files only.
Goal: <target end-state>
Rules: no /usr/lib changes unless approved; no destructive ops.
Implementation: <files to edit>
Actions: include policy tags when applicable, e.g. cmd:<exact command> and skill:<skill-id>.
Validation: run <tests/commands>; include exact output.
Deliverable: changed paths + minimal diff + rollback note.

## 4) Incident response prompt
Goal: restore service safely.
Priority: correctness over speed.
Constraints: ask before restart/delete; keep evidence.
Steps: diagnose -> isolate root cause -> propose fix -> apply (if approved) -> verify.
Output: timeline, root cause, fix, prevention items.

## HAT_STATE.md

# HAT_STATE.md

Generated: Mar 15, 2026, 6:01 PM (America/Phoenix)

- profile_source: /root/.openclaw/workspace/os/hat-profiles.json
- hat_count: 5

## Hat profiles

### autonomous
- description: Autonomous overnight mode for stability/automation work and PR creation (no main merges)
- allowedIdentityContexts: agent
- allowedTaskTypes: ops, research, spec, code, summarize
- defaultDataSensitivity: low
- allowedSkills: coding-agent, github, gh-issues, openai-image-gen, bluebubbles
- allowedCommands: git status | git diff | git add | git commit | git push | gh pr create | gh pr edit
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: engineering_brief

### inbox
- description: Gmail/inbox triage and summaries
- allowedIdentityContexts: human
- allowedTaskTypes: classify, summarize, research, ops
- defaultDataSensitivity: medium
- allowedSkills: himalaya, apple-notes, apple-reminders, bluebubbles, imsg
- allowedCommands: node /root/.openclaw/workspace/integrations/gmail/daily-review.js
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: concise_operational

### ops-core
- description: Operations, diagnostics, automation, and platform maintenance
- allowedIdentityContexts: human, agent
- allowedTaskTypes: ops, code, spec, research, summarize, classify
- defaultDataSensitivity: medium
- allowedSkills: 1password, apple-notes, apple-reminders, bear-notes, blucli, bluebubbles, camsnap, clawhub, coding-agent, discord, eightctl, gemini, gh-issues, github, healthcheck, imsg, mcporter, model-usage, nano-pdf, notion, obsidian, openai-image-gen, openai-whisper, openai-whisper-api, pinchtab
- allowedCommands: node /root/.openclaw/workspace/scripts/arch-drift-check.mjs | node /root/.openclaw/workspace/scripts/export-project-source.mjs | node /root/.openclaw/workspace/scripts/refresh-project-source.mjs
- defaultModelChain: openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: engineering_brief

### resale
- description: Resale research and listing support
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify, ops
- defaultDataSensitivity: medium
- allowedSkills: eightctl, gog, nano-banana-pro, pinchtab
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: actionable_checklist

### web
- description: Web research and fetch workflows
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify
- defaultDataSensitivity: low
- allowedSkills: blogwatcher, gemini, gifgrep, goplaces, pinchtab
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: cited_summary

## ARCHITECTURE_SUMMARY.md

# ARCHITECTURE_SUMMARY.md

Generated: Mar 15, 2026, 6:01 PM (America/Phoenix)

## Execution flow (workspace level)
- os/preflight.js runs before hat execution and validates the Task Envelope contract.
- scripts/run-project-source-check.mjs runs source checks and auto-generates project_source docs.
- scripts/arch-drift-check.mjs classifies cosmetic/structural/behavioral drift and blocks silent HIGH-severity reconciliation.
- scripts/export-project-source.mjs creates EXPORT_LATEST.md and dist/bort_source_bundle.tgz.

## Enforcement highlights
- hats allowlist: autonomous, inbox, ops-core, resale, web
- required envelope fields: hat, intent, taskType, taskSize, risk, dataSensitivity, externalStateChange, identityContext, actions, approvalNeeded
- externalStateChange=true requires approvalNeeded=true.
- high sensitivity output suppression is enforced by explicit blocklist patterns in os/preflight.js.

## Source of truth
- Canonical shareable state is maintained in project_source/*.md and exported via EXPORT_LATEST.md.

## ROUTING_STATE.md

# ROUTING_STATE.md

Generated: Mar 15, 2026, 6:01 PM (America/Phoenix)

## Global configured defaults
- primary: openai-codex/gpt-5.3-codex
- fallbacks: openrouter/auto, openrouter/arcee-ai/trinity-mini:free, openrouter/nvidia/nemotron-nano-9b-v2:free, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex-spark

## Workspace routing categories (from os/model-routing.js ROUTES)

### code_ops
- openai-codex/gpt-5.3-codex
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openrouter/nvidia/nemotron-nano-9b-v2:free

### lightweight
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openai-codex/gpt-5.3-codex
- openrouter/nvidia/nemotron-nano-9b-v2:free

### research_web
- openai-codex/gpt-5.3-codex
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openrouter/nvidia/nemotron-nano-9b-v2:free

### social_drafting
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openai-codex/gpt-5.3-codex
- openrouter/nvidia/nemotron-nano-9b-v2:free

### spec_large
- openai-codex/gpt-5.3-codex
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openrouter/nvidia/nemotron-nano-9b-v2:free

### default
- openai-codex/gpt-5.2-codex
- openai-codex/gpt-5.2
- openai-codex/gpt-5.3-codex
- openrouter/nvidia/nemotron-nano-9b-v2:free

## Notes
- This file is regenerated automatically; manual edits may be overwritten.

## OPERATIONS_STATE.md

# OPERATIONS_STATE.md

Generated: Mar 15, 2026, 6:01 PM (America/Phoenix)

## Operations checklist
- Use openclaw models status --json to verify default/fallback chain.
- Use openclaw cron list --json to verify recurring jobs.
- Use scripts/export-project-source.mjs --force to produce export artifacts on demand.
- Upload project_source/EXPORT_LATEST.md (or dist/bort_source_bundle.tgz) to external ideation threads.

## Artifact paths
- project_source/EXPORT_LATEST.md
- dist/bort_source_bundle.tgz
- memory/to_upload.md (notification log)

## CHANGELOG_AUTOGEN.md

# CHANGELOG_AUTOGEN.md

## 2026-03-06
- Diagnosed and fixed Pinchtab Chrome binary resolution failure.
- Root cause: Pinchtab does not load CHROME_BINARY from ~/.pinchtab/.env at runtime — only honors shell environment.
- Fix: Added export CHROME_BINARY=/usr/bin/google-chrome-stable to top of scripts/pinchtab-session.sh.
- Removed snap Chromium (snap remove chromium) to eliminate PATH fallback risk.
- Confirmed Pinchtab healthy (status: ok) via pinchtab-session.sh start/stop cycle.
- PROMPT_ANTIPATTERNS.md: added Antipattern 14 (CHROME_BINARY not loaded from .env).
- PROJECTS_ACTIVE.md: PINCHTAB_AUTOSTART_DECISION marked complete.
- PROJECTS_ACTIVE.md: EBAY_RESALE_V1 added (status: planning, blocked on eBay Developer Program approval).

## 2026-03-05
- Architectural review completed (18 findings, 15 resolved this session).
- os/preflight.js: autonomous hat added to fallback HATS object (C-2 fix).
- os/hat-profiles.json: allowedSkills updated from abstract labels to real installed skill IDs across all 5 hats (C-1 fix).
- scripts/arch-drift-check.mjs: ROUTES extraction regex hardened to handle indented closing bracket (C-3 fix).
- project_source/SYSTEM_CONTEXT.md: hat:os section updated to reflect resolved alias; canonical files list expanded from 9 to 13 entries.
- project_source/FILE_INDEX.md: stale TODO notes removed; HAT_OS_RESOLUTION entry updated to reflect Option A implemented.
- project_source/SKILL_REGISTRY.md: header date corrected to Mar 05, 2026.
- project_source/PROMPT_ANTIPATTERNS.md: Antipattern 14 added (Telegram chat ID hardcoded in 3 files).
- project_source/PROJECTS_ACTIVE.md: ROUTING_STATE_FALLBACK_MODEL_FIX marked complete; TELEGRAM_CHAT_ID_CENTRALIZATION and ARCH_REVIEW_2026_03_05 entries added.
- Gmail cron (6ba59b88) delivery mode fixed from "announce" to "none" — resolves 4 consecutive failures.
- 1PASSWORD_CLI_SETUP deferred to dedicated session. PINCHTAB_AUTOSTART_DECISION remains blocked on it.
- Note: expect [BORT_ARCH_DRIFT] alert for os/preflight.js on next drift check — intentional, confirm reconciliation when prompted.

Generated: Feb 25, 2026 • 9:20 AM (America/Phoenix)

This file records **structural** changes (not diff dumps). Keep entries concise.

## 2026-03-04

- Installed Pinchtab browser automation bridge via npm install -g pinchtab.
- Resolved Chrome binary conflict: snap Chromium was winning PATH; fixed by setting CHROME_BINARY=/usr/bin/google-chrome-stable in ~/.pinchtab/.env.
- Set CHROME_FLAGS=--no-sandbox and BRIDGE_BIND=127.0.0.1 in ~/.pinchtab/.env.
- Persistent Chrome profile confirmed working at /root/.pinchtab/chrome-profile.
- Pinchtab skill file registered at /usr/lib/node_modules/openclaw/skills/pinchtab/SKILL.md.
- SKILL_REGISTRY.md updated: Pinchtab added under Research & Web (ops-core, web, resale).
- PROMPT_ANTIPATTERNS.md updated: antipatterns 10-13 added (auth header, SingletonLock, snap Chrome PATH conflict, --no-sandbox requirement).
- Baseline rebuilt: stale fallbackModel corrected, drift check clean.
- Template 5 updated to include git push (externalStateChange + approvalNeeded set to true).
- Created `BORT_INTERESTS.md` to define topics, curated accounts, and voice notes.
- `x_digest_job.js` updated to score tweets against interests and write scored digest output.
- `x_call.js` updated for dual auth: Bearer for GET, OAuth 1.0a for POST/DELETE.
- `x_daily_post.js` now sources from scored digest with Borty voice and rotation, with commit fallback.
- Added `x_engagement_job.js` and registered a daily 8am Phoenix cron for read-only metrics snapshots.
- Added Template 5 session close prompt to `PROMPT_TEMPLATES.md`.
- Replaced and verified all X credentials in the OpenClaw config.

## 2026-03-03

- Created `CLAUDE_SESSION_OPENER.md` for reusable Claude ideation session startup.
- Verified bundle export job includes all current `project_source/` files.
- Updated `FILE_INDEX.md` with the new session opener entry.
- SYSTEM_CONTEXT.md reconciled: autonomous hat added to allowlist, per-hat action enforcement and policyOverride documented.
- ROUTING_STATE.md reconciled: hard fallback model documented.
- Drift reconciliation authorized by Bryan after review.
- /bort-bundle/ Tailscale endpoint fixed to serve current project_source files.
- tgz bundle replaced with flat file listing — each file individually accessible.
- update-bort-bundle.sh verified and updated to copy from correct source.
- /bort-bundle/ updated with single zip download (bort-bundle.zip).
- index.html updated with prominent download all link.
- SKILL_REGISTRY.md categories corrected (gog → Productivity, nano-banana-pro → Media, eightctl → Smart Home).
- Bundle update cron aligned to match project_source refresh schedule (6am + 6pm).
- Drift report details confirmed.
- bort-ui fully excised: removed from drift check rules, ARCHITECTURE_SUMMARY.md, and SYSTEM_CONTEXT.md.
- bort-ui was superseded by OpenClaw default UI.
- Drift check now watches only active implementation files.
- .arch_drift_baseline.json rebuilt from current live state (was stale since Feb 27).
- Removed stale bort-ui file hashes from baseline.
- ROUTING_STATE.md: hard fallback model re-added to Notes.
- Drift check now runs clean with accurate baseline.
- arch-drift-check.mjs now reads hat allowlist from os/hat-profiles.json for baseline accuracy.

## 2026-02-25

- Reconciled `project_source/` canonical documentation to match live implementation.
- Populated canonical files with verified content + citations:
  - `FILE_INDEX.md` (workspace map + exclusions)
  - `SYSTEM_CONTEXT.md` (Task Envelope & hat enforcement documented)
  - `ARCHITECTURE_SUMMARY.md` (preflight → source-check → routing flow)
  - `ROUTING_STATE.md` (deterministic routing categories + ordering)
  - `OPERATIONS_STATE.md` (ports, dev workflow, cleanup behavior)
- Documented hat mismatch explicitly: conversational `Hat: os` is **not** a preflight allowlisted hat.
- Removed prior formatting artifact from `ROUTING_STATE.md` (literal “Minor edit …” line).

---

## Drift Report — Mar 03, 2026 • 12:34 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture, enforcement, routing
- changed_files:
  - os/preflight.js
  - os/model-routing.js

Details:
- top-level dirs added: external, public
- top-level dirs removed: bort-ui
- hat allowlist changed: ["inbox","ops-core","resale","web"] -> []
- route categories changed: ["code_ops","lightweight","research_web","social_drafting","spec_large"] -> ["code_ops","default","lightweight","research_web","social_drafting","spec_large"]
- route ordering changed for code_ops

---

## Drift Report — Mar 03, 2026 • 1:51 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture, enforcement, routing
- changed_files:
  - os/preflight.js
  - os/model-routing.js

Details:
- top-level dirs added: external, public
- top-level dirs removed: bort-ui
- hat allowlist changed: ["inbox","ops-core","resale","web"] -> []
- route categories changed: ["code_ops","lightweight","research_web","social_drafting","spec_large"] -> ["code_ops","default","lightweight","research_web","social_drafting","spec_large"]
- route ordering changed for code_ops

---

## Drift Report — Mar 03, 2026 • 4:06 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

---

## Drift Report — Mar 03, 2026 • 4:06 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

---

## Drift Report — Mar 03, 2026 • 6:34 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

---

## Drift Report — Mar 03, 2026 • 6:34 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

---

## Drift Report — Mar 03, 2026 • 6:35 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

---

## Drift Report — Mar 03, 2026 • 6:36 PM (America/Phoenix)

- severity: HIGH
- impact_area: architecture
- changed_files:
  - os/preflight.js

Details:
- (no additional details)

## SKILL_REGISTRY.md

# SKILL_REGISTRY.md
Generated: Mar 05, 2026

This file documents installed Bort skills with enough detail for prompt construction.
Format: name | hats | what it does | key inputs | key outputs | notes

---

## Skills by category

### Communication & Messaging
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| bluebubbles | ops-core, inbox | Use when you need to send or manage iMessages via BlueBubbles; calls go through the generic message tool with `channel:"bluebubbles"`. | `target` (chat_guid/E.164/email), `message`, `messageId` for react/edit/unsend, attachment `path` or `buffer`+`filename`. | Message send/edit/reply/unsend, reactions, attachment delivery via message tool. | Requires config `channels.bluebubbles`. SKILL.md: /usr/lib/node_modules/openclaw/skills/bluebubbles/SKILL.md |
| imsg | ops-core, inbox | iMessage/SMS CLI for listing chats, history, and sending messages via Messages.app. | CLI args to `imsg` (chat selection, message body). | CLI stdout; message send/receive via Messages.app. | Requires bin `imsg`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/imsg/SKILL.md |
| discord | ops-core | Discord ops via the message tool (`channel:"discord"`). | Message tool fields (target/channel/message, reactions, edits). | Discord messages, reactions, edits via message tool. | Requires `channels.discord.token` config; respects `channels.discord.actions.*` gating. SKILL.md: /usr/lib/node_modules/openclaw/skills/discord/SKILL.md |
| himalaya | inbox | CLI email client for IMAP/SMTP: list, read, write, reply, forward, search, organize. | CLI args to `himalaya` (account, folder, query, message). | CLI output; email actions via IMAP/SMTP. | Requires bin `himalaya`. SKILL.md: /usr/lib/node_modules/openclaw/skills/himalaya/SKILL.md |

### Email & Inbox
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| (gmail) | inbox | Gmail daily summary and triage — listed in hat-profiles, not skill inventory. | Inbox contents via daily-review.js. | Digest / triage report. | Runs via integrations/gmail/daily-review.js (no SKILL.md). |

### Research & Web
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| blogwatcher | web | Monitor blogs and RSS/Atom feeds for updates via `blogwatcher` CLI. | Feed URLs; CLI args (`add`, `list`, `check`). | CLI output; new post summaries/links. | Requires bin `blogwatcher`. SKILL.md: /usr/lib/node_modules/openclaw/skills/blogwatcher/SKILL.md |
| gemini | web, ops-core | Gemini CLI for one-shot Q&A, summaries, and generation. | Prompt string; optional `--model`, `--output-format`. | CLI stdout (text/JSON). | Requires bin `gemini`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gemini/SKILL.md |
| gifgrep | web | Search GIF providers (Tenor/Giphy), browse in TUI, download, extract stills/sheets. | Search query; CLI args for download/extract. | GIF files, still images/sheets, CLI output. | Requires bin `gifgrep`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gifgrep/SKILL.md |
| goplaces | web | Google Places API (New) CLI for text search, place details, reviews; supports `--json`. | Query text/place ID; `--json` for structured output. | Human-readable output or JSON. | Requires bin `goplaces` + env `GOOGLE_PLACES_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/goplaces/SKILL.md |
| pinchtab | ops-core, web, resale | HTTP browser automation bridge — navigate, snapshot a11y tree, extract text, click/type by ref, screenshots, PDF export. Stealth mode, persistent sessions, tab management. | Base URL (default http://localhost:9867), BRIDGE_TOKEN from ~/.pinchtab/.env, tabId for multi-tab ops. CLI: pinchtab nav/snap/text/click/type/ss/pdf/eval | JSON a11y snapshot, plain text extraction, JPEG screenshots, PDF files, health status. | Requires pinchtab binary and Chrome/Chromium. Start server manually before use. Token stored at ~/.pinchtab/.env. Launch-on-demand: run scripts/pinchtab-session.sh start before use, stop after. PID tracked at /tmp/pinchtab.pid. SKILL.md: /usr/lib/node_modules/openclaw/skills/pinchtab/SKILL.md |


### Productivity & Google Workspace
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| gog | resale | Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, Docs. | OAuth credentials; CLI args for service + action. | CLI output; data read/write to Google services. | Requires bin `gog`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gog/SKILL.md |

### Smart Home & Devices
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| eightctl | resale, ops-core | Control Eight Sleep pods (status, temperature, alarms, schedules). | CLI args (device, temp, schedule). | CLI output; device state changes. | Requires bin `eightctl` and auth/config. SKILL.md: /usr/lib/node_modules/openclaw/skills/eightctl/SKILL.md |

### Resale Operations
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|

### Development & Code
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| coding-agent | autonomous, ops-core | Delegate coding tasks to Codex/Claude Code/Pi via interactive CLI (pty). | Task spec; repo path; agent selection (`codex|claude|pi`). | Code changes, diffs/PRs produced by agent. | Requires any of bins: `claude`, `codex`, `opencode`, `pi`. Uses bash with pty. SKILL.md: /usr/lib/node_modules/openclaw/skills/coding-agent/SKILL.md |
| github | autonomous, ops-core | GitHub ops via `gh` CLI: issues, PRs, CI runs, review, API queries. | Repo, issue/PR identifiers, `gh` subcommands/flags. | CLI output; PRs/issues/comments. | Requires bin `gh`. SKILL.md: /usr/lib/node_modules/openclaw/skills/github/SKILL.md |
| gh-issues | autonomous, ops-core | Orchestrate GitHub issue triage and PRs using curl + REST API. | owner/repo + flags (`--label`, `--limit`, `--milestone`, etc.). | Issue list, spawned fix tasks, PR updates. | Requires bins `curl`, `git`, `gh` (per metadata); uses GH_TOKEN env. SKILL.md: /usr/lib/node_modules/openclaw/skills/gh-issues/SKILL.md |
| mcporter | ops-core | MCP server/tool management via `mcporter` CLI (list, configure, auth, call). | Server name/tool selector + key=value args. | CLI output; tool call results. | Requires bin `mcporter`. SKILL.md: /usr/lib/node_modules/openclaw/skills/mcporter/SKILL.md |

### Media & Content
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| nano-banana-pro | resale | Generate or edit images via Gemini 3 Pro Image (Nano Banana Pro). | Prompt + output filename; optional edit inputs. | Generated/edited image files. | Requires `uv` + env `GEMINI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/nano-banana-pro/SKILL.md |
| camsnap | ops-core | Capture frames or clips from RTSP/ONVIF cameras. | Camera name/host, snapshot/clip args. | Image or clip files. | Requires bin `camsnap` and config at `~/.config/camsnap/config.yaml`. SKILL.md: /usr/lib/node_modules/openclaw/skills/camsnap/SKILL.md |
| openai-image-gen | ops-core, autonomous | Batch-generate images via OpenAI Images API; creates gallery. | Prompt list/config; output format/size. | Image files + `prompts.json` + `index.html` gallery. | Requires `python3` + env `OPENAI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-image-gen/SKILL.md |
| openai-whisper | ops-core | Local speech-to-text with Whisper CLI. | Audio path; `--model`, `--output_format`, `--output_dir`, `--task`. | Transcripts as `.txt`/`.srt`/etc in output dir. | Requires bin `whisper`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-whisper/SKILL.md |
| openai-whisper-api | ops-core | Whisper transcription via OpenAI API (curl script). | Audio path; optional `--model`, `--out`, `--language`, `--prompt`, `--json`. | Transcript text or JSON file (default `<input>.txt`). | Requires `curl` + env `OPENAI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-whisper-api/SKILL.md |
| nano-pdf | ops-core | Edit PDFs via natural-language instructions using `nano-pdf`. | PDF path + page number + instruction string. | Modified PDF output (per CLI). | Requires bin `nano-pdf`. SKILL.md: /usr/lib/node_modules/openclaw/skills/nano-pdf/SKILL.md |

### Platform & Tools
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| 1password | ops-core | Set up and use 1Password CLI (`op`) for secrets retrieval and injection. | Vault/item/field references; `op` subcommands. | Secret values or command output (sensitive). | Requires bin `op`. High-sensitivity output; follow suppression rules. SKILL.md: /usr/lib/node_modules/openclaw/skills/1password/SKILL.md |
| clawhub | ops-core | ClawHub CLI to search/install/update/publish skills from clawhub.com. | Search query, skill name, version, publish args. | Installed skill folders or publish output. | Requires bin `clawhub`. SKILL.md: /usr/lib/node_modules/openclaw/skills/clawhub/SKILL.md |
| healthcheck | ops-core | Host security hardening and risk-tolerance configuration for OpenClaw deployments. | Target host/context; audit/hardening choices. | Security report + recommended actions. | No bin requirements listed. SKILL.md: /usr/lib/node_modules/openclaw/skills/healthcheck/SKILL.md |
| model-usage | ops-core | CodexBar CLI usage/cost summaries per model (Codex/Claude). | Provider (`codex|claude`), optional input JSON, `--format`. | Text or JSON cost summary (no per-model tokens). | Requires bin `codexbar`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/model-usage/SKILL.md |

### Notes & Knowledge
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| apple-notes | ops-core, inbox | Manage Apple Notes via `memo` CLI (create/view/edit/delete/search/move/export). | Note title/content; folder; CLI flags. | Notes created/updated; exported files. | Requires bin `memo`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/apple-notes/SKILL.md |
| apple-reminders | ops-core, inbox | Manage Apple Reminders via `remindctl` CLI (list/add/edit/complete/delete). | Reminder text, list name, due date, filters. | CLI output; reminders created/updated. | Requires bin `remindctl`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/apple-reminders/SKILL.md |
| bear-notes | ops-core | Create/search/manage Bear notes via `grizzly` CLI. | Note title/content/tags; CLI flags. | Notes created/updated; CLI output. | Requires bin `grizzly`; macOS only. Some ops require Bear app token. SKILL.md: /usr/lib/node_modules/openclaw/skills/bear-notes/SKILL.md |
| notion | ops-core | Notion API for creating/managing pages, databases, blocks. | API key + page/database IDs + payload. | Notion pages/blocks created/updated; API responses. | Requires env `NOTION_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/notion/SKILL.md |
| obsidian | ops-core | Work with Obsidian vaults (Markdown files) via `obsidian-cli`. | Vault path; note path; CLI args. | Markdown files created/updated; CLI output. | Requires bin `obsidian-cli`. SKILL.md: /usr/lib/node_modules/openclaw/skills/obsidian/SKILL.md |

### Automation
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| pr-review | ops-core | Trigger an immediate PR review run on BortyMcBot/bort-os. Invoked via Telegram /pr-review command or directly. | `--silent` flag for quiet mode, `--dry-run` for simulation. | Summary of decisions: merged/flagged/skipped counts + Telegram notifications. | Wraps scripts/pr-review-job.mjs. Cron also runs at 7am + 6pm Phoenix. |

### Social
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| blucli | ops-core | BluOS CLI (`blu`) for discovery, playback, grouping, volume. | Device selection + playback/volume commands. | CLI output; device control effects. | Requires bin `blu`. SKILL.md: /usr/lib/node_modules/openclaw/skills/blucli/SKILL.md |

---

## Action items for Bryan
- Confirm which hats each skill is actually callable from (some above are inferred from hat-profiles).
- Clarify if any of these skills are installed-but-dormant vs actively used.

---

## How this file is used
Claude references this registry when drafting Task Envelope prompts to:
1. Select the correct skill tag for actions field
2. Avoid referencing skills not allowed for the target hat
3. Flag when a task requires a skill with no documented capability

## PROJECTS_ACTIVE.md

# PROJECTS_ACTIVE.md
Maintained by: Bryan (manually updated) + Bort (on task completion)

Purpose: Continuity layer for multi-step projects across sessions.

---

## How to use this file
- Add a project when it spans more than one Bort task or session
- Update status and last_completed_step after each Bort run
- Archive completed projects to PROJECTS_ARCHIVE.md monthly
- Upload this file alongside EXPORT_LATEST.md when starting a new Claude ideation session

---

## Active Projects

### 1PASSWORD_CLI_SETUP
- status: planning
- hat_sequence: [ops-core]
- last_completed_step: 1password skill confirmed installed but not configured
- next_action: Set up op CLI auth and migrate ~/.pinchtab/.env token to 1Password vault
- blocking_issue: none
- relevant_files: ~/.pinchtab/.env, /usr/lib/node_modules/openclaw/skills/1password/SKILL.md
- notes: Pinchtab BRIDGE_TOKEN currently stored in plaintext. Priority: before adding any additional credentials to .env files anywhere on the system. Deferred to dedicated session. All other triage items completed first.
- last_updated: 2026-03-05

### ROUTING_STATE_FALLBACK_MODEL_FIX
- status: complete
- hat_sequence: [ops-core]
- last_completed_step: Documented correctly in ROUTING_STATE.md as of Mar 05, 2026 refresh.
- next_action: none
- blocking_issue: none
- relevant_files: project_source/ROUTING_STATE.md, os/model-routing.js
- notes: Low priority. Creates paper truth but has no operational impact. Documented correctly in ROUTING_STATE.md as of Mar 05, 2026 refresh.
- last_updated: 2026-03-05

### PINCHTAB_AUTOSTART_DECISION
- status: complete
- hat_sequence: [ops-core]
- last_completed_step: Launch-on-demand implemented via scripts/pinchtab-session.sh; CHROME_BINARY export fix applied; snap Chromium removed
- next_action: none
- blocking_issue: none
- relevant_files: ~/.pinchtab/.env, project_source/SKILL_REGISTRY.md
- notes: Current posture is manual launch only. Persistent profile is ready at /root/.pinchtab/chrome-profile. Autostart should only be considered after 1Password CLI setup is complete so BRIDGE_TOKEN is not exposed in a cron env. Blocked until 1PASSWORD_CLI_SETUP is complete.
- last_updated: 2026-03-06

### EBAY_RESALE_V1
- status: planning
- hat_sequence: [resale → ops-core]
- last_completed_step: eBay Developer Program application submitted; awaiting approval
- next_action: Confirm eBay Developer Program approval, then set up OAuth tokens in 1Password and implement photo intake via Telegram
- blocking_issue: eBay Developer Program approval pending
- relevant_files: ~/resale/inbox/
- notes: Phase 1 is human-in-the-loop. Bryan uploads photos to ~/resale/inbox/<item-folder>/, Bort identifies item via vision model, researches sold comps, drafts listing, sends Telegram preview, posts via eBay Sell APIs. Pricing: 40th percentile of recent sold comps. Photo intake path (Telegram vs manual upload) still an open question.
- last_updated: 2026-03-06

### TELEGRAM_CHAT_ID_CENTRALIZATION
- status: planning
- hat_sequence: [ops-core]
- last_completed_step: Identified and documented as Antipattern 14
- next_action: Centralize TELEGRAM_CHAT_ID in openclaw.json or shared constants file and update os/x_daily_post.js, scripts/pr-review-job.mjs, scripts/deploy.mjs
- blocking_issue: none
- relevant_files: os/x_daily_post.js, scripts/pr-review-job.mjs, scripts/deploy.mjs, openclaw.json
- notes: Low priority maintenance debt. No security risk. Three files currently hardcode chat ID 8374853956.
- last_updated: 2026-03-05

### ARCH_REVIEW_2026_03_05
- status: complete
- hat_sequence: [ops-core]
- last_completed_step: All 18 findings triaged. 15 resolved. 1Password deferred. Telegram centralization logged.
- next_action: none — archive at next monthly cleanup
- blocking_issue: none
- relevant_files: project_source/CHANGELOG_AUTOGEN.md
- notes: Full findings in Claude session 2026-03-05. HIGHs resolved: Gmail cron, allowedSkills enforcement, preflight fallback, drift regex, doc drift. 1PASSWORD_CLI_SETUP remains open.
- last_updated: 2026-03-05


### BORT_PR_REVIEW_PIPELINE
- status: complete
- hat_sequence: [ops-core → autonomous]
- last_completed_step: Full pipeline live — PR review, auto-deploy, session close convention, CLAUDE.md in bundle. First Claude Code session ready.
- next_action: none
- blocking_issue: none
- relevant_files: scripts/pr-review-job.mjs, logs/pr-review.log, project_source/SYSTEM_CONTEXT.md
- notes: Bort auto-merges approved PRs via squash. Escalates to Bryan via Telegram for flagged PRs. Branch convention is claude/ for Claude Code sessions, bort/ for Bort autonomous work.
- last_updated: 2026-03-05

### CLAUDECODE_HANDOFF_SETUP
- status: complete
- hat_sequence: [ops-core]
- last_completed_step: Full pipeline live — PR review, auto-deploy, session close convention, CLAUDE.md in bundle. First Claude Code session ready.
- next_action: none
- blocking_issue: none
- relevant_files: CLAUDE.md, scripts/pr-review-job.mjs, scripts/deploy.mjs
- notes: Claude Code handoff conventions documented; WIP PRs skipped.
- last_updated: 2026-03-05

### BORT_PR_REVIEW_PIPELINE
- status: in_progress
- hat_sequence: [ops-core → autonomous]
- last_completed_step: pr-review-job.mjs built with claude/ prefix, legacy exempt logic removed, crons registered, Telegram command added
- next_action: Bryan to open first real PR from a Claude Code session using claude/* branch and verify end-to-end flow
- blocking_issue: none
- relevant_files: scripts/pr-review-job.mjs, logs/pr-review.log, project_source/SYSTEM_CONTEXT.md
- notes: Bort auto-merges approved PRs via squash. Escalates to Bryan via Telegram for flagged PRs. Branch convention is claude/ for Claude Code sessions, bort/ for Bort autonomous work.
- last_updated: 2026-03-05

---

## Entry template

### [PROJECT_NAME]
- status: planning | in_progress | blocked | waiting_approval | complete
- hat_sequence: [hat1 → hat2 → hat3]
- last_completed_step: <description>
- next_action: <what Bort or Bryan does next>
- blocking_issue: <if blocked, why>
- relevant_files: <paths>
- notes: <anything Claude or Bryan should know>
- last_updated: <date>

---

## Archived Projects *(move completed entries here)*

## PROMPT_ANTIPATTERNS.md

# PROMPT_ANTIPATTERNS.md
Purpose: Known prompt patterns that cause Bort to fail, misbehave, or require manual recovery.
Maintained by: Bryan + Claude (add entries after any incident or unexpected behavior)

---

## Antipattern 1: Using hat:os in Task Envelopes
What happens: preflight.js rejects the envelope — os is not in the hat allowlist.
Why it happens: Conversational shorthand ("Hat: os") bleeds into formal task envelopes.
Fix: Route os-level tasks through hat:ops-core instead.
Workaround until fixed: None — envelope will be rejected at preflight.
Status: RESOLVED (2026-03-03) — Option A implemented. hat:os now aliased to ops-core in os/preflight.js. Envelopes with hat:os will pass preflight and route correctly. This entry is retained for historical reference.

---

## Antipattern 2: externalStateChange:true without approvalNeeded:true
What happens: preflight.js blocks execution entirely.
Why it happens: Easy to forget approval gating when drafting prompts quickly.
Fix: Any task that sends email, posts to social, pushes to git remote, or modifies external services must have approvalNeeded:true.
Rule of thumb: If it leaves the machine, it needs approval.

---

## Antipattern 3: Missing required envelope fields
What happens: preflight.js rejects with a field validation error.
Required fields: hat, intent, taskType, taskSize, risk, dataSensitivity, externalStateChange, identityContext, actions, approvalNeeded
Why it happens: Shortcutting the envelope when a task feels simple.
Fix: Always use the full envelope. Use PROMPT_TEMPLATES.md Template 1 as the base.

---

## Antipattern 4: Using identityContext:human with agent-only hats
What happens: preflight identity context check fails.
Affected hats: autonomous (agent only), resale (agent only)
Why it happens: Prompts written for interactive use accidentally use human context.
Fix: Match identity context to hat:
- autonomous → agent
- resale → agent
- inbox → human
- ops-core → human or agent
- web → agent

---

## Antipattern 5: High-sensitivity output not suppressed
What happens: Output containing blocklist patterns is emitted — violates suppression policy.
Why it happens: Prompts that ask Bort to show, print, or return sensitive data directly.
Fix: For high-sensitivity tasks, instruct Bort to write output to a file path and return only a pointer message. Never ask for raw output in the response.
Relevant enforcement: os/preflight.js lines 185-233

---

## Antipattern 6: Autonomous hat used for tasks requiring main branch merges
What happens: Bort may attempt or propose a main branch merge — outside autonomous hat scope.
Why it happens: Vague deploy or release language in overnight task specs.
Fix: Explicitly state no merges to main in autonomous hat prompts. PRs are allowed; merges are not.

---

## Antipattern 7: Vague Definition of Done
What happens: Bort completes a partial task and reports success — Bryan discovers gaps later.
Why it happens: Prompts omit verifiable completion checks.
Fix: Always include explicit, command-level verification steps in Definition of Done.
Example: Done when: openclaw models status --json shows gpt-5.2-codex as default.

---

## Antipattern 8: Requesting structured data output without specifying format
What happens: Bort returns prose when JSON/bullets were needed, or vice versa.
Why it happens: Output format field omitted or left vague.
Fix: Always specify Output format explicitly. Use hat output style as baseline:
- ops-core / autonomous → engineering_brief
- inbox → concise_operational
- resale → actionable_checklist
- web → cited_summary

---

## Antipattern 9: Stacking multiple high-risk actions in one envelope
What happens: If one action fails mid-task, rollback is unclear and state is inconsistent.
Why it happens: Trying to be efficient by combining steps.
Fix: Split tasks at natural approval gates. One envelope per external state change.

---

## Antipattern 10: Pinchtab health check without auth header
What happens: curl to http://localhost:9867/health returns 401 and looks like a server failure.
Why it happens: BRIDGE_TOKEN is set but health check curl omits the Authorization header.
Fix: Always include -H "Authorization: Bearer <token>" when curling Pinchtab endpoints.
Token location: ~/.pinchtab/.env

---

## Antipattern 11: Pinchtab fails to start due to stale SingletonLock
What happens: Pinchtab cannot launch Chrome against ~/.pinchtab/chrome-profile — Permission denied on SingletonLock.
Why it happens: A prior Chrome session exited uncleanly and left a lock file behind.
Fix: Confirm no chrome or pinchtab processes are running, then: rm /root/.pinchtab/chrome-profile/SingletonLock
Do not use /tmp/pinchtab-profile for persistent sessions — it will not retain cookies or auth.

---

## Antipattern 12: Snap Chromium wins PATH and breaks Pinchtab profile writes
What happens: Pinchtab repeatedly fails with SingletonLock: Permission denied even after directory recreation, permission changes, and --no-sandbox — because snap-confined Chrome cannot write to /root/ paths outside its sandbox.
Why it happens: Ubuntu systems with snap Chromium installed resolve `chrome` to the snap binary, which runs in a confined namespace regardless of filesystem permissions.
Fix: Install Google Chrome via the official .deb AND explicitly set CHROME_BINARY:
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install ./google-chrome-stable_current_amd64.deb
echo "CHROME_BINARY=/usr/bin/google-chrome-stable" >> ~/.pinchtab/.env
Verify with: which google-chrome-stable (must be /usr/bin/, not /snap/)
Do not rely on PATH alone — snap may still win. Always set CHROME_BINARY explicitly.

---

## Antipattern 13: Pinchtab running as root requires --no-sandbox
What happens: Chrome fails to start when Pinchtab is run as root without sandbox flag.
Why it happens: Chrome refuses to run as root without explicit sandbox override.
Fix: Add to ~/.pinchtab/.env: CHROME_FLAGS=--no-sandbox
This is safe for local-only, loopback-bound instances (BRIDGE_BIND=127.0.0.1).
Do not use --no-sandbox if Pinchtab is exposed to the network.

---

## Antipattern 14: Telegram chat ID hardcoded in multiple implementation files
What happens: If Bryan's Telegram chat ID changes or the channel config moves, it requires edits across 3 separate files with no single source of truth.
Why it happens: Chat ID was added inline when each integration was built.
Affected files:
 - os/x_daily_post.js line 10
 - scripts/pr-review-job.mjs line 227
 - scripts/deploy.mjs line 57
Fix: Centralize TELEGRAM_CHAT_ID in openclaw.json or a shared constants file, and reference it from all three scripts.
Risk: LOW — not a security concern. Maintenance debt only.
Status: OPEN — not yet implemented.

---

## Antipattern 14: CHROME_BINARY in ~/.pinchtab/.env is not loaded by Pinchtab at runtime
What happens: Pinchtab ignores CHROME_BINARY set in ~/.pinchtab/.env and falls back to resolving chrome from PATH — which may resolve to snap Chromium, causing AppArmor denials and SingletonLock permission errors.
Why it happens: Pinchtab only reads CHROME_BINARY from the shell environment, not from its own .env file. Variables in ~/.pinchtab/.env are not automatically exported to the process environment.
Fix: Export CHROME_BINARY explicitly before launching Pinchtab. In scripts/pinchtab-session.sh, add at the top (after shebang): export CHROME_BINARY=/usr/bin/google-chrome-stable
Also remove snap Chromium to eliminate the fallback risk entirely: snap remove chromium
Root cause confirmed by: dmesg showing exe="/snap/chromium/.../chrome" with apparmor="DENIED", while direct launch of /usr/bin/google-chrome-stable succeeded.
Related: Antipattern 12 (snap Chrome PATH conflict), Antipattern 13 (--no-sandbox requirement).

## Adding new entries
When Bort behaves unexpectedly, add an entry with:
- What happened (observable symptom)
- Why it happened (root cause if known)
- Fix or workaround
- Relevant file/line reference if applicable

## HAT_OS_RESOLUTION.md

# HAT_OS_RESOLUTION.md
Issue: Hat:os is used conversationally but is not defined in the preflight allowlist.
Status: Resolved — Option A implemented (2026-03-03).

---

## The problem
os/preflight.js defines this allowlist (lines 25-46):
- inbox
- web
- resale
- ops-core
- autonomous

Tasks labeled Hat:os in conversation would be rejected at preflight if enforcement is active on that execution path.

---

## Resolution options

### Option A — Alias os → ops-core in preflight (recommended)
Add os as an accepted alias for ops-core in preflight.js.

Pros:
- Zero behavioral change — os tasks route to ops-core model chain and permissions
- Conversational shorthand continues to work
- No hat-profiles.json changes needed

Implementation (do not apply until Bryan approves):
```js
// In preflight.js hat validation (lines 25-46), add alias mapping:
const HAT_ALIASES = { os: 'ops-core' };
const resolvedHat = HAT_ALIASES[envelope.hat] || envelope.hat;
// Then validate resolvedHat against allowlist
```

---

### Option B — Add os as a first-class hat in hat-profiles.json + preflight
Define a distinct os hat profile for low-level system/platform tasks.

Pros:
- Explicit separation between os-level ops and ops-core operational tasks
- Can have tighter command allowlist

Cons:
- More maintenance surface
- Requires hat-profiles.json + preflight + ARCHITECTURE_SUMMARY edits
- Triggers HIGH severity drift check → requires Bryan confirmation

---

### Option C — Deprecate conversational Hat:os usage
Add to PROMPT_ANTIPATTERNS.md (done) and always use ops-core instead.

Pros: No code changes, simplest.
Cons: Relies on discipline, easy to regress.

---

## Recommendation
Option A for immediate fix (low risk, no behavioral change). Option C as complementary convention (already in PROMPT_ANTIPATTERNS.md).

---

## Action required from Bryan
1. Confirm preferred resolution option
2. If Option A: approve a follow-up preflight.js edit task
3. If Option B: confirm hat profile definition before implementation

## CLAUDE_SESSION_OPENER.md

# CLAUDE_SESSION_OPENER.md

## What this is
Bort is Bryan’s operational AI assistant. Bryan and Claude collaborate by using these project_source files as the canonical, ground-truth reference for how Bort works and how to prompt it.

## Source of truth
All attached files in the bundle are **ground-truth**. If anything conflicts with prior assumptions, **trust the files**.

## Expected files (flag any missing)
- FILE_INDEX.md
- SYSTEM_CONTEXT.md
- STATE_OF_BORT.md
- PROMPT_TEMPLATES.md
- HAT_STATE.md
- ARCHITECTURE_SUMMARY.md
- ROUTING_STATE.md
- OPERATIONS_STATE.md
- CHANGELOG_AUTOGEN.md
- SKILL_REGISTRY.md
- PROJECTS_ACTIVE.md
- PROMPT_ANTIPATTERNS.md
- HAT_OS_RESOLUTION.md
- CLAUDE_SESSION_OPENER.md

## Standing behavioral rules for Claude in this project
- Always use full Task Envelope format when drafting prompts for Bort.
- Always validate hat + identityContext compatibility before suggesting a prompt.
- Always flag externalStateChange=true tasks for approval gating.
- Never invent skill descriptions — reference SKILL_REGISTRY.md only.
- When uncertain about Bort's current state, say so and ask Bryan to verify with Bort rather than guessing.
- Prefer asking Bort to self-document over inferring from context.
- Maintain PROJECTS_ACTIVE.md continuity — reference it at session start and flag any in-flight projects that need attention.
- Add new entries to PROMPT_ANTIPATTERNS.md when unexpected Bort behavior is discovered during a session.

## This Session
- Current focus: <what Bryan is working on today>
- Recent Bort incidents: <any unexpected behavior since last session, or none>
- Pending decisions: <e.g. hat:os resolution, or none>
- New skills installed since last export: <skill names, or none>

## CLAUDE.md

# CLAUDE.md
# Bort-OS — Claude Code Session Context

This file is read automatically by Claude Code at the start of every session.
Do not edit this file from a claude/ branch — it is Bort-owned and updated via bort/ PRs.

---

## What this repo is
This is the bort-os repository — the codebase for Bort, an AI agent running on a VPS
using the OpenClaw framework. Bryan develops here via Claude Code. Bort handles runtime
operations, cron jobs, and autonomous tasks on the live system.

---

## Your identity and commit rules
- All commits are authored as BortyMcBot[bot] via the GitHub App configured in git credentials
- Never commit as NewWorldOrderly or any personal account
- If git identity looks wrong, stop and flag it before committing anything

---

## Branch and PR conventions
- Claude Code branches must be prefixed: claude/<short-description> and require a PR — never push directly to main
- Bort branches prefixed: bort/<short-description> may be pushed directly to main — no PR required
- Bort reviews all PRs twice daily (7am + 6pm Phoenix) and auto-merges approved ones
- Trigger an immediate review anytime by sending /pr-review to @BortyMcBot on Telegram
- PR titles should be conventional commits format: feat:, fix:, chore:, docs:, refactor:

---

## Ownership zones

| Path | Claude Code | Bort |
|---|---|---|
| project_source/*.md | ❌ blocked | ✅ owner |
| .arch_drift_baseline.json | ❌ blocked | ✅ owner |
| skills/ | ✅ allowed | ✅ allowed |
| scripts/ | ✅ allowed | ✅ allowed |
| integrations/ | ✅ allowed | ✅ allowed |
| hats/ | ✅ allowed | ✅ allowed |
| docs/ | ✅ allowed | ✅ allowed |
| os/ | ✅ allowed (with care) | ✅ allowed |
| CLAUDE.md | ❌ blocked | ✅ owner |

If you need a change in a blocked path, describe it to Bryan and Bort will implement it
on a bort/ branch.

---

## Dangerous files — read before touching

### os/preflight.js
The Task Envelope enforcement layer. Every Bort execution passes through this.
- Defines the hat allowlist (inbox, web, resale, ops-core, autonomous)
- Validates all required Task Envelope fields
- Enforces identity context rules per hat
- Enforces approval gating when externalStateChange=true
- Implements high-sensitivity output suppression
Risk: breaking this silently disables all of Bort's safety enforcement.
Rule: always read this file in full before making any changes. Flag any removals
of enforcement logic in your PR description so Bort's review escalates to Bryan.

### os/model-routing.js
Determines which AI model handles which task type.
Risk: adding unknown model IDs or changing routing order will cause silent task
failures on the live system.
Rule: only add model IDs that already exist in STATE_OF_BORT.md allowed model list.

### os/hat-profiles.json
Defines per-hat permissions, allowed skills, and identity contexts.
Risk: expanding permissions here bypasses Bort's safety model.
Rule: any permission expansion triggers Bort's escalate-to-Bryan review rule — expect
the PR to be held for Bryan's explicit approval.

### .arch_drift_baseline.json
Bort's reference snapshot for detecting architectural drift.
Risk: hand-editing this masks real drift and disables drift detection.
Rule: never touch this file. If it needs rebuilding, ask Bort to do it.

### project_source/*.md
Auto-generated canonical docs. Hand-edits will be overwritten by Bort's next refresh cron.
Rule: never edit these directly. Describe the change to Bryan — Bort will implement it.

---

## Handoff to Bort — what goes where

**Do it in Claude Code if:**
- It's a code change (scripts, integrations, skills, os/ with care)
- It can be reviewed statically by Bort before hitting the live system
- It doesn't require knowing Bort's live runtime state

**Hand off to Bort if:**
- It requires live system access (cron registration, config changes, secret retrieval)
- It touches project_source/ or .arch_drift_baseline.json
- It needs to run on the VPS before it can be tested
- You're unsure whether something is currently running that touches the same file

**How to hand off:**
Describe the change in plain English to Bryan. Bryan sends it to Bort via Telegram.
Bort implements, commits on a bort/ branch, opens a PR, and notifies Bryan when done.

---

## Post-merge behavior
After any claude/ PR merges to main:
- Bort pulls the changes on the VPS automatically (or Bryan triggers it)
- If os/preflight.js or os/model-routing.js changed, Bort rebuilds .arch_drift_baseline.json
- Bort sends Bryan a Telegram confirmation

---

## Useful Telegram commands (send to @BortyMcBot)
- /pr-review — trigger immediate PR review
- /pr-review dry-run — see what would be reviewed without taking action

---

## Ending a Claude Code session

At the end of every session, before closing VSCode:

1. **Commit all changes** on your current claude/* branch
 - Use conventional commit format: feat:, fix:, chore:, docs:, refactor:
 - One commit per logical change — don't stack unrelated edits

2. **Push the branch**
 git push -u origin claude/<your-branch-name>

3. **Open a PR** via the GitHub CLI or VSCode GitHub extension
 - Title: conventional commit format matching your commit
 - Body: brief description of what changed and why
 - Do not assign reviewers — Bort picks up all open PRs automatically

4. **Verify the PR is open** on https://github.com/BortyMcBot/bort-os/pulls

5. **Optionally trigger immediate review** by sending /pr-review to @BortyMcBot on Telegram
 - Otherwise Bort will review at the next scheduled run (7am or 6pm Phoenix)

6. **Never leave uncommitted changes** on a claude/* branch between sessions
 - If work is incomplete, commit with a wip: prefix: "wip: <description>"
 - Bort will skip WIP PRs automatically (see below)

## WIP PRs
If your PR title starts with "wip:" Bort will skip it during review until the prefix is removed.
Use this when you want to push work-in-progress without triggering a merge.
