# EBAY_PHASE1_CHECKLIST.md

Task link: `T-004` in `TASK_BACKLOG.md`
Account target: **LittleTigerFlip**

Purpose: make Phase 1 execution fast when we start.

---

## Preflight (must be true before Phase 1)

- [ ] eBay Developer app exists (Production keys available)
- [ ] OAuth user token flow is enabled for seller account access
- [ ] LittleTigerFlip account confirmed for API use
- [ ] Credential storage location decided (`openclaw.json env.vars` or secrets file)
- [ ] Guardrails confirmed:
  - [ ] no auto-publish initially
  - [ ] no auto-price edits initially
  - [ ] audit logs required for all reads/writes

---

## Phase 1 Goal

Read-only seller visibility and daily digest.

Outputs we want:
1. Active listings snapshot
2. Ended listings snapshot
3. Sold/unshipped attention list
4. Offers-awaiting-action list
5. Message/notification attention list
6. Daily summary report in markdown

---

## Credentials / Config Checklist

- [ ] `EBAY_CLIENT_ID` stored
- [ ] `EBAY_CLIENT_SECRET` stored
- [ ] `EBAY_REDIRECT_URI` set and registered in app settings
- [ ] `EBAY_ENV` set (`production`)
- [ ] Access token retrieval tested
- [ ] Refresh token retrieval tested (if applicable)

Notes:
- Never paste raw secrets into chat logs.
- Store only in approved config/secrets paths.

---

## API Capability Validation (Read-Only)

- [ ] Verify account identity call succeeds
- [ ] Verify active listings endpoint succeeds
- [ ] Verify orders/sold endpoint succeeds
- [ ] Verify offers endpoint succeeds (if used)
- [ ] Verify messages/notifications endpoint succeeds (if used)
- [ ] Log status codes and endpoint names only (no sensitive payload dumps)

Success condition:
- [ ] All required read endpoints return success without manual intervention.

---

## Data Model Checklist (for digest generation)

For each listing record, ensure we can capture:
- [ ] listing_id
- [ ] title
- [ ] price
- [ ] quantity / available
- [ ] start date / age
- [ ] view/watch metrics (if available)
- [ ] listing status

For sold/unshipped:
- [ ] order_id
- [ ] sold_date
- [ ] ship_status
- [ ] buyer action needed flag

For offers/messages:
- [ ] item or thread reference
- [ ] age since received
- [ ] recommended action bucket

---

## Daily Digest Job Checklist

- [ ] Create `ebay_phase1_digest` script (read-only)
- [ ] Output file path defined (e.g., `memory/ebay_digest.log.md`)
- [ ] Summary sections include:
  - [ ] stale listings
  - [ ] low-activity listings
  - [ ] offers awaiting response
  - [ ] sold/unshipped attention
- [ ] Add cron schedule proposal (time zone + cadence)
- [ ] Dry-run works without writes to eBay

---

## Safety / Operations Checklist

- [ ] Budget/rate-limit protection added
- [ ] Retry policy with backoff for transient failures
- [ ] 401/403 handling path documented
- [ ] Circuit-breaker behavior defined (pause + alert)
- [ ] Logs redact secrets/tokens

---

## Definition of Done (Phase 1)

- [ ] Auth is stable for read-only operations
- [ ] Daily digest runs on schedule
- [ ] Digest is useful for triage and next actions
- [ ] No listing mutations occur in Phase 1

---

## Kickoff Prompt (when starting T-004)

Use this prompt to start implementation quickly:

"Hat: ops-core taskType: ops taskSize: medium dataSensitivity: medium thinking: medium
Goal: Execute eBay T-004 Phase 1 only (read-only visibility + daily digest) using EBAY_PHASE1_CHECKLIST.md.
Constraints: No listing creation/edits/publish actions. Read-only API calls only.
Output: endpoint validation table, digest sample, cron proposal, and minimal diff of files created/changed.
Definition of Done: all Phase 1 checklist gates are satisfied."
