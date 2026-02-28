# ARCHITECTURE_SUMMARY.md

Generated: Feb 28, 2026, 2:10 PM (America/Phoenix)

## Execution flow (workspace level)
- os/preflight.js runs before hat execution and validates the Task Envelope contract.
- scripts/run-project-source-check.mjs runs source checks and auto-generates project_source docs.
- scripts/arch-drift-check.mjs classifies cosmetic/structural/behavioral drift and blocks silent HIGH-severity reconciliation.
- scripts/export-project-source.mjs creates EXPORT_LATEST.md and dist/bort_source_bundle.tgz.

## Enforcement highlights
- hats allowlist: inbox, ops-core, resale, web
- required envelope fields: hat, intent, taskType, taskSize, risk, dataSensitivity, externalStateChange, identityContext, actions, approvalNeeded
- externalStateChange=true requires approvalNeeded=true.
- high sensitivity output suppression is enforced by explicit blocklist patterns in os/preflight.js.

## Source of truth
- Canonical shareable state is maintained in project_source/*.md and exported via EXPORT_LATEST.md.

