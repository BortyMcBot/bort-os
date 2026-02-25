# BORT_CAPABILITIES.md

Generated from snapshot: `/root/.openclaw/workspace/source/bort_registry.snapshot.json`

Canonical truth:
- `source/bort_registry.snapshot.json`

---

## How to choose a hat

Hats are enforced by the workspace preflight allowlist in:

- `/root/.openclaw/workspace/os/preflight.js`

Available hats (alphabetical):

- `inbox` — Gmail/inbox triage workflows (see SOP.md).
- `ops-core` — Operational maintenance, diagnostics, and code/ops tasks.
- `resale` — Resale-related research/workflows.
- `web` — Web research / browsing / fetch workflows.

Notes:

- If anything is unknown, it is recorded as `unknown` in the JSON snapshot rather than guessed.

## Command quick reference

### node scripts/arch-drift-check.mjs

Classify documentation/architecture drift (cosmetic/structural/behavioral) and enforce HIGH-severity behavior (emit [BORT_ARCH_DRIFT] and block auto-export).

Examples:

- `node /root/.openclaw/workspace/scripts/arch-drift-check.mjs`

### node scripts/export-project-source.mjs

Compute sha256 per canonical project_source file; generate EXPORT_LATEST.md bundle; emit [BORT_SOURCE_UPDATE] when changed; log notification into memory/to_upload.md.

Examples:

- `node /root/.openclaw/workspace/scripts/export-project-source.mjs`
- `node /root/.openclaw/workspace/scripts/export-project-source.mjs --force`

### npm run dev (bort-ui)

Start Bort Control Panel UI (Vite) + local API server (Express) with predev port cleanup.

Examples:

- `cd /root/.openclaw/workspace/bort-ui && npm run dev`

### openclaw gateway restart

Restart the OpenClaw gateway daemon service.

Examples:

- `openclaw gateway restart`

### openclaw gateway status

Show OpenClaw gateway daemon service status.

Examples:

- `openclaw gateway status`

### ssh tunnel: dashboard

Open an SSH local tunnel to access the dashboard via localhost.

Examples:

- `ssh -L 18888:127.0.0.1:18888 root@<VPS_IP>`

---

## SOP index

- `documentation_drift_handling` — When implementation may have diverged from project_source documentation, especially if [BORT_ARCH_DRIFT] is emitted.
- `gmail_daily_summary` — Daily summary of Gmail inbox; scheduled automation described in SOP.md.
- `gmail_inbox_triage` — When manually triaging the signup/required Gmail inbox with noise reduction.
- `project_source_export` — When canonical project_source files have changed and you need a single bundle for upload into external threads.
- `ui_tunnel_access` — When viewing the Bort Control Panel from Bryan’s laptop without opening public ports.
- `web_research` — When tasks require web search or URL fetching.

---

## Template schema overview

Schema source: /root/.openclaw/workspace/os/preflight.js

Required fields (alphabetical):

- `actions` (string[])
- `approvalNeeded` (boolean) enum=true|false
- `dataSensitivity` (string) enum=high|low|medium
- `externalStateChange` (boolean) enum=true|false
- `hat` (string) enum=inbox|ops-core|resale|web
- `identityContext` (string) enum=agent|human
- `intent` (string) enum=audit|backup|build|diagnose|maintain|report|research|restore|triage
- `risk` (string) enum=high|low|medium
- `taskSize` (string) enum=large|medium|small
- `taskType` (string) enum=classify|code|ops|research|spec|summarize

Optional fields (alphabetical):

- `preferredModel` (string) enum=unknown
