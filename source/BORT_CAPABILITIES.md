# BORT_CAPABILITIES.md

Generated: 2026-02-25 (UTC)

This is a human-readable summary of the deterministic capabilities registry snapshot.
For canonical truth, see:

- `source/bort_registry.snapshot.json`

---

## How to choose a hat

Hats are enforced by the workspace preflight allowlist in:

- `/root/.openclaw/workspace/os/preflight.js`

Available hats (allowlist):

- `inbox` — inbox/Gmail triage workflows
- `ops-core` — operational maintenance, diagnostics, and code/ops tasks
- `resale` — resale-related tasks
- `web` — web research

Important:

- Conversational directives may mention `Hat: os`, but **`os` is not an enforced hat** in `os/preflight.js`.

---

## Command quick reference

### Documentation / integrity

- Drift classifier (blocks auto-export on HIGH behavioral drift):
  - `node /root/.openclaw/workspace/scripts/arch-drift-check.mjs`

- Export canonical Source-of-Truth bundle:
  - `node /root/.openclaw/workspace/scripts/export-project-source.mjs`
  - `node /root/.openclaw/workspace/scripts/export-project-source.mjs --force`

### Dashboard (Bort Control Panel)

- Start UI + API:
  - `cd /root/.openclaw/workspace/bort-ui && npm run dev`

- Tunnel access (laptop → VPS loopback):
  - `ssh -L 18888:127.0.0.1:18888 root@<VPS_IP>`
  - open: `http://127.0.0.1:18888`

### OpenClaw gateway

- Status:
  - `openclaw gateway status`

- Restart (requires explicit approval):
  - `openclaw gateway restart`

---

## SOP index

SOPs are explicitly listed in the registry snapshot.

- `documentation_drift_handling` — respond to `[BORT_ARCH_DRIFT]` and enforce review
- `project_source_export` — generate `project_source/EXPORT_LATEST.md` for upload
- `ui_tunnel_access` — view dashboard via SSH tunnel
- `web_research` — use web_search/web_fetch/browser as appropriate
- `gmail_daily_summary` — scheduled Gmail summary (documented in SOP.md)
- `gmail_inbox_triage` — manual/interactive Gmail triage

---

## Template schema overview

The “Task Envelope” schema is enforced by `os/preflight.js`.

Required fields:

- `hat` (enum: inbox | web | resale | ops-core)
- `intent` (string; common values documented in preflight template)
- `taskType` (enum: classify | summarize | code | spec | research | ops)
- `taskSize` (enum: small | medium | large)
- `risk` (enum: low | medium | high)
- `dataSensitivity` (enum: low | medium | high)
- `externalStateChange` (boolean)
- `identityContext` (enum: human | agent)
- `actions` (string[])
- `approvalNeeded` (boolean)

Notes:

- If `externalStateChange=true`, `approvalNeeded` must be `true`.
- Optional field observed in routing (not required by preflight):
  - `preferredModel` (string) — used by `os/model-routing.js` if present.

If anything is missing/unknown, it is recorded as `unknown` in `bort_registry.snapshot.json` rather than guessed.
