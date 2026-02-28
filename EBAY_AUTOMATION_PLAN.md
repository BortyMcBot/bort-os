# EBAY_AUTOMATION_PLAN.md

Account target: **LittleTigerFlip**

## Objective
Set up reliable eBay seller automation for listing creation, listing lifecycle handling, and daily operational maintenance with human-in-the-loop controls.

## Phase 0 — Access & Compliance (Prerequisite)

1. Create/verify eBay Developers Program app (Dev + Prod keys).
2. Confirm API scopes needed for seller workflows (OAuth user tokens).
3. Set up secure credential storage in OpenClaw (`openclaw.json env.vars` or secrets path).
4. Confirm account linking to LittleTigerFlip production seller account.
5. Define guardrails:
   - no auto-publish without approval (initially)
   - price floor rules
   - category/condition policy
   - audit logging enabled

## Phase 1 — Read-Only Seller Visibility

Goal: observe before acting.

- Pull active listings, ended listings, sold items, offers, and buyer messages metadata.
- Build daily digest summary:
  - stale listings
  - low-view listings
  - offers awaiting response
  - sold/unshipped attention items
- Store summaries in workspace memory for review.

Deliverable:
- `ebay_daily_digest` job (read-only)

## Phase 2 — Listing Draft Automation (Human Approval)

Goal: speed listing creation while keeping approval in-loop.

- Input: item photos + notes
- Generate:
  - title options
  - item specifics draft
  - description draft
  - pricing suggestion (comp-based)
  - shipping suggestion
- Save as draft payload + checklist for approval.

Deliverable:
- `ebay_draft_listing` workflow (draft only, no publish)

## Phase 3 — Lifecycle Automation

Goal: handle ongoing listing ops safely.

- Detect stale listings and suggest revisions.
- Offer management assistant:
  - recommend accept/counter/decline bands
- Relist flow for ended items with policy checks.
- Sold-item follow-up checklist generation.

Deliverable:
- `ebay_listing_lifecycle` job set

## Phase 4 — Controlled Autopilot

Goal: allow selective automation after confidence is high.

- Enable auto-actions only for approved rule classes.
- Keep approval required for high-risk actions (price changes beyond threshold, unusual categories).
- Add rollback/recovery docs and incident playbook.

Deliverable:
- policy-based partial autopilot

## Skills / Jobs to Build

Potential skills:
- `ebay-access-check`
- `ebay-listing-draft`
- `ebay-pricing-comp`
- `ebay-offer-assistant`
- `ebay-lifecycle-maintenance`

Potential cron jobs:
- `eBay daily digest (LittleTigerFlip)`
- `eBay stale listings watch`
- `eBay offers queue check`

## Success Criteria

1. Auth + account linkage verified in production.
2. Daily digest runs reliably.
3. Listing drafts are generated with consistent quality.
4. Lifecycle tasks reduce manual effort without policy violations.
5. All mutating actions are auditable and reversible.
