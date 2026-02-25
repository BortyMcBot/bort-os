# Project 1 — Router Enforcement (lightweight)

This folder contains the minimal “multi-hat OS” scaffolding code used by Bort.

Goals:
- Deterministic Task Envelope
- Preflight validation before hat execution
- Data-sensitivity discipline
- Lightweight skill entrypoints (read-only by default)

Note: This is not an OpenClaw core patch; it’s an in-workspace enforcement layer used by our scripts/skills.

## X API rule

All X API calls must go through `os/x_call.js` (budget preflight + queue + ledger).
