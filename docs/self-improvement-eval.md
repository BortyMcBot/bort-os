# Self-Improvement Evaluation — 2026-03-11

Evaluation of PR #13 (`claude/self-review-pipeline`) vs. two ClawHub skills
(`capability-evolver`, `self-improving-agent`) for Bort's self-improvement needs.

---

## What PR #13 Does

A 653-line custom Node.js cron job (`scripts/self-review-job.mjs`) with five phases:

1. **Code Review** — walks `scripts/`, `integrations/`, `hats/`, `os/`, `skills/`,
   sends file contents to an LLM for review, parses structured findings
2. **Fix PRs** — opens `bort/self-review-*` PRs for HIGH/MEDIUM findings;
   flags `os/preflight.js`, `os/model-routing.js`, `os/hat-profiles.json` as HIGH RISK
3. **PR Staleness** — notifies Bryan via Telegram for non-WIP PRs open > 3 days
4. **Web Research** — uses Gemini to scan four topic areas, flags `[ACTION]` items
5. **Doc Generation** — commits findings, research digests, and plans to `docs/self-review/`

Key architectural properties:
- Runs as a **scheduled batch job** (weekly review, daily staleness)
- Respects CLAUDE.md ownership zones and branch conventions
- Fix PRs go through normal review — not auto-merged
- HIGH RISK files are explicitly flagged for Bryan's approval
- Uses `bort/` branches for doc commits (direct to main per convention)
- Supports `--dry-run` and `--phase=` for safe testing

---

## What capability-evolver Does

ClawHub's #1 skill (35K downloads). A "self-evolution engine" that:

- Analyzes runtime history to identify failures and inefficiencies
- Autonomously writes new code or updates agent memory/behavior
- Implements GEP (Governed Evolution Protocol) — its own governance layer
- Generates `genes.json`, `capsules.json`, `events.jsonl` as evolution artifacts
- Offers `--review` (human-in-the-loop) and `--loop` (continuous) modes
- Respects system load limits with CPU backoff

**Critical concern for Bort:** capability-evolver's core value proposition is
**autonomous self-modification**. It rewrites agent behavior based on runtime patterns.
This conflicts with Bort's safety architecture:

- `os/preflight.js` enforces the Task Envelope — capability-evolver could evolve
  behaviors that bypass or weaken this enforcement
- `os/hat-profiles.json` defines per-hat permission boundaries — the skill's
  evolution engine doesn't know about these constraints
- GEP is capability-evolver's **own** governance protocol, not Bort's —
  it would create a parallel governance system that doesn't integrate with
  CLAUDE.md's escalation rules
- The skill's autonomous code generation bypasses the PR review flow entirely

---

## What self-improving-agent Does

ClawHub's #5 skill (15K downloads). A **passive learning logger** that:

- Writes to a `.learnings/` directory with three structured files:
  - `LEARNINGS.md` — corrections, knowledge gaps, better approaches
  - `ERRORS.md` — operational failures with context
  - `FEATURE_REQUESTS.md` — capabilities requested but unavailable
- Triggers on: unexpected failures, user corrections, outdated knowledge,
  API failures, better approaches discovered for recurring tasks
- Supports promotion of broadly applicable learnings to project-level docs
- Does **not** modify code or agent behavior autonomously

**Compatibility with Bort:** self-improving-agent is architecturally safe:

- Write scope is limited to `.learnings/` — no code modification
- It captures signal that the self-review pipeline could consume
- Promotion to project docs is a manual/reviewed step, not automatic
- No conflict with preflight enforcement, hat profiles, or ownership zones

---

## Comparison Matrix

| Dimension | PR #13 | capability-evolver | self-improving-agent |
|---|---|---|---|
| **Primary function** | Scheduled code review + research | Autonomous self-evolution | Passive learning capture |
| **Modifies code?** | Yes, via reviewed PRs | Yes, autonomously | No |
| **Governance model** | CLAUDE.md + PR review | GEP (its own protocol) | None needed (read/append only) |
| **Respects ownership zones?** | Yes, explicitly | No awareness of them | N/A (doesn't modify code) |
| **HIGH RISK file awareness?** | Yes, flags and escalates | No | N/A |
| **Bryan approval gate?** | Yes, via PR review | Only if `--review` mode used | N/A |
| **Runtime vs. batch** | Batch (cron) | Continuous or on-demand | Continuous (passive) |
| **Integration effort** | Already built for bort-os | Would need scoping + constraints | Minimal — add to allowedSkills |
| **Risk level** | Low (reviewed PRs only) | High (autonomous modification) | Very low (append-only logging) |

---

## Recommendation

### Keep the PR and add self-improving-agent (scoped). Skip capability-evolver.

This maps to a hybrid of options 3 and 4 from the evaluation criteria.

**Why keep PR #13:**
- Purpose-built for Bort's architecture — respects ownership zones, branch conventions,
  high-risk file escalation, and Bryan's approval gates
- The skills don't replace it — neither does code review, PR staleness checks,
  web research, or structured documentation
- Already integrated with Bort's Telegram notification flow

**Why skip capability-evolver:**
- Its autonomous self-modification is fundamentally incompatible with Bort's safety model
- GEP creates a parallel governance system that doesn't integrate with `os/preflight.js`
- Even with `--review` mode, the evolution artifacts (`genes.json`, `capsules.json`)
  introduce an opaque layer between Bort's behavior and Bryan's understanding of it
- The risk of capability-evolver quietly evolving behaviors that weaken preflight
  enforcement or hat boundaries is not worth the convenience
- PR #13's code review phase already covers the "identify improvements" use case,
  but routes fixes through reviewed PRs instead of autonomous modification

**Why add self-improving-agent (scoped):**
- Captures runtime signal (failures, corrections, knowledge gaps) that the
  weekly self-review pipeline can't observe — it only sees static code
- The `.learnings/` directory becomes an input source for Phase 1 of the
  self-review job, creating a feedback loop: runtime learnings → weekly review → fix PRs
- Append-only writes to `.learnings/` are inherently safe
- No conflict with any CLAUDE.md constraint

---

## Proposed hat-profiles.json Change

Add `self-improving-agent` to the `autonomous` hat's `allowedSkills` array.
This is the only hat that runs unattended and would benefit from passive learning capture.

```json
{
  "autonomous": {
    "allowedSkills": [
      "coding-agent",
      "github",
      "gh-issues",
      "openai-image-gen",
      "bluebubbles",
      "self-improving-agent"
    ]
  }
}
```

Optionally also add to `ops-core` for supervised sessions:

```json
{
  "ops-core": {
    "allowedSkills": [
      "1password",
      "apple-notes",
      "apple-reminders",
      "bear-notes",
      "blucli",
      "bluebubbles",
      "camsnap",
      "clawhub",
      "coding-agent",
      "discord",
      "eightctl",
      "gemini",
      "gh-issues",
      "github",
      "healthcheck",
      "imsg",
      "mcporter",
      "model-usage",
      "nano-pdf",
      "notion",
      "obsidian",
      "openai-image-gen",
      "openai-whisper",
      "openai-whisper-api",
      "pinchtab",
      "self-improving-agent"
    ]
  }
}
```

**Note:** This is a permission expansion on `hat-profiles.json` (a dangerous file per
CLAUDE.md), so it requires Bryan's explicit approval. This document serves as the
proposal — do not apply until Bryan reviews.

---

## Scoping Constraints for self-improving-agent

If installed, recommend these constraints:

1. **Write scope:** `.learnings/` directory only — no promotion to CLAUDE.md or other
   project-level docs without Bryan's review
2. **No autonomous action:** Learnings are logged, never acted on automatically.
   The self-review pipeline decides what to do with them during its weekly run.
3. **Gitignore `.learnings/`** initially — keep learnings local to the VPS until
   Bryan is satisfied with the signal quality, then optionally commit them
4. **Add `.learnings/` to the ownership table** in CLAUDE.md as Bort-owned

---

## Sources

- [ClawHub — capability-evolver](https://clawhub.ai/autogame-17/capability-evolver)
- [ClawHub — self-improving-agent](https://clawhub.ai/pskoett/self-improving-agent)
- [Top OpenClaw Skill Recommendations 2026](https://help.apiyi.com/en/openclaw-skill-recommendations-2026-en.html)
- [LobeHub — capability-evolver listing](https://lobehub.com/skills/openclaw-skills-capability-evolver)
- [LobeHub — self-improving-agent listing](https://lobehub.com/skills/z980944038-dev-openclawwdl-self-improving-agent-1.0.5)
- [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)
