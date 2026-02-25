# Project Source Export (UPLOAD THIS FILE)

Generated: Feb 25, 2026 • 8:06 AM (America/Phoenix)

Changed files since last export:
- SYSTEM_CONTEXT.md

---

## FILE_INDEX.md

# FILE_INDEX.md

(TODO)

## SYSTEM_CONTEXT.md

# SYSTEM_CONTEXT.md

## Source of Truth Maintenance Protocol

The `project_source/` directory is the **canonical “Source of Truth”** for this project’s externally-shareable context.

### What BORT does (automatic)

- BORT may update `project_source/*` as part of normal work.
- On each normal run cycle (workspace preflight), BORT checks a fixed set of canonical files for changes by computing **sha256** hashes.
- If any canonical file changed since the last check, BORT will:
  1) Generate a single upload bundle:
     - `/root/.openclaw/workspace/project_source/EXPORT_LATEST.md`
  2) Print a concise notification block:
     - `[BORT_SOURCE_UPDATE] ...`
  3) Record the same notification into:
     - `/root/.openclaw/workspace/memory/to_upload.md` (newest first, no duplicates)

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
- `ARCHITECTURE_SUMMARY.md`
- `ROUTING_STATE.md`
- `OPERATIONS_STATE.md`
- `CHANGELOG_AUTOGEN.md` (export includes last 200 lines only)

## ARCHITECTURE_SUMMARY.md

# ARCHITECTURE_SUMMARY.md

(TODO)

## ROUTING_STATE.md

# ROUTING_STATE.md

(TODO)
\nMinor edit 1772031907

## OPERATIONS_STATE.md

# OPERATIONS_STATE.md

(TODO)

## CHANGELOG_AUTOGEN.md

# CHANGELOG_AUTOGEN.md

(TODO)
