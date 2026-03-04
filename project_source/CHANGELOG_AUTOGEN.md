# CHANGELOG_AUTOGEN.md

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
