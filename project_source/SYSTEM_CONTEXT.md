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

### High-sensitivity output suppression

`os/preflight.js` implements deterministic high-sensitivity output suppression using explicit blocklist patterns.
If a blocklist match occurs, the caller must suppress output and show only a pointer message.

Source:
- `os/preflight.js` lines 185–233

### IMPORTANT: conversational “Hat: os” is not an enforced hat

Some conversational directives may label tasks as `Hat: os`.
However, `os/preflight.js` does **not** define a hat named `os` in its allowlist.

Source:
- `os/preflight.js` lines 25–46 (no `os` entry)

If enforcement is active for that execution path, `hat=os` would be rejected.
Resolving this mismatch requires a behavior change (out of scope for documentation reconciliation).

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
  - `bort-ui/vite.config.ts`
  - `bort-ui/scripts/free-ports.mjs`
- Extracted architectural invariants:
  - Hat allowlist
  - Route categories or ordering
  - Default fallback model
  - Dev ports (18888/18790), Vite host/port/strictPort
  - Proxy target for `/api`

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
