# TASK_BACKLOG.md

Purpose: deferred work queue for tasks Bryan wants captured but not necessarily executed now.

## Intake Rules

When Bryan says anything like:
- "remember this task"
- "add this to backlog"
- "someday task"
- "we should do this later"

Bort should run a short intake prompt and then add/refine an entry here.

## Intake Questions (ask only what is missing)

1) What outcome do you want?
2) Priority? (P1 urgent, P2 important, P3 someday)
3) Target timing? (this week / this month / later / specific date)
4) Any constraints or dependencies?
5) What does "done" look like?

If Bryan gives partial info, Bort should infer reasonable defaults and continue.

## Defaults

- priority: P3
- status: someday
- effort: M
- target_window: later
- owner: Bort

## Backlog

| ID | Task | Priority | Status | Effort | Target Window | Next Action | Notes |
|---|---|---|---|---|---|---|---|
| T-001 | Enable Claude API/OpenRouter access and route complex coding tasks to Claude Opus 4.6 while keeping Codex default for normal work | P2 | queued | M | this month | Retrieve Claude/OpenRouter keys, confirm account funding, then run live model availability check for `anthropic/claude-opus-4.6` and patch routing | Done when Opus 4.6 is available in live model list, complex-code path selects Opus 4.6, normal tasks remain Codex-first, and validation logs prove behavior |
| T-002 | Restore persistent X API access (fix 401s) and harden token lifecycle so daily post + digest jobs stay authenticated | P1 | done | M | Monday | Completed: OAuth repaired, dry-run 200, verified post success, failure notifications added | Done when `x_auth --dry-run` returns 200, daily post returns 201, digest avoids 401, and jobs auto-recover without manual re-auth |
| T-003 | Build website-maintenance automation for personal site repo (post-Claude-Code baseline): skills/jobs/tasks for upkeep and PR-driven workflow | P2 | queued | L | this month | Deferred: save project plan for later session; revisit after Claude Code baseline finalized | Done when recurring maintenance jobs run, PRs are opened automatically for scoped changes, and Bryan can review/approve/comment without manual commit workflow |
| T-004 | Enable eBay account access (LittleTigerFlip) and implement listing + lifecycle automation workflow | P2 | queued | L | this month | Execute `EBAY_AUTOMATION_PLAN.md` starting with Phase 0 access/compliance and Phase 1 read-only digest | Done when eBay API auth is verified, daily seller digest runs, listing drafts can be produced for approval, and lifecycle automation is policy-controlled |

