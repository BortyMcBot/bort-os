# PROJECTS_ACTIVE.md
Maintained by: Bryan (manually updated) + Bort (on task completion)

Purpose: Continuity layer for multi-step projects across sessions.

---

## How to use this file
- Add a project when it spans more than one Bort task or session
- Update status and last_completed_step after each Bort run
- Archive completed projects to PROJECTS_ARCHIVE.md monthly
- Upload this file alongside EXPORT_LATEST.md when starting a new Claude ideation session

---

## Active Projects

### 1PASSWORD_CLI_SETUP
- status: planning
- hat_sequence: [ops-core]
- last_completed_step: 1password skill confirmed installed but not configured
- next_action: Set up op CLI auth and migrate ~/.pinchtab/.env token to 1Password vault
- blocking_issue: none
- relevant_files: ~/.pinchtab/.env, /usr/lib/node_modules/openclaw/skills/1password/SKILL.md
- notes: Pinchtab BRIDGE_TOKEN currently stored in plaintext. Priority: before adding any additional credentials to .env files anywhere on the system.
- last_updated: 2026-03-04

### ROUTING_STATE_FALLBACK_MODEL_FIX
- status: planning
- hat_sequence: [ops-core]
- last_completed_step: Discrepancy identified during baseline rebuild
- next_action: Update ROUTING_STATE.md to correctly distinguish global hard fallback (openai/gpt-5.2-chat-latest in os/model-routing.js) from route-level fallback (openrouter/nvidia/nemotron-nano-9b-v2:free)
- blocking_issue: none
- relevant_files: project_source/ROUTING_STATE.md, os/model-routing.js
- notes: Low priority. Creates paper truth but has no operational impact.
- last_updated: 2026-03-04

### PINCHTAB_AUTOSTART_DECISION
- status: planning
- hat_sequence: [ops-core]
- last_completed_step: Pinchtab installed and verified; autostart intentionally deferred
- next_action: Bryan to decide: cron-based autostart, launch-on-demand, or dashboard mode. Then implement and document in SKILL_REGISTRY.md notes.
- blocking_issue: Decision needed from Bryan before implementation
- relevant_files: ~/.pinchtab/.env, project_source/SKILL_REGISTRY.md
- notes: Current posture is manual launch only. Persistent profile is ready at /root/.pinchtab/chrome-profile. Autostart should only be considered after 1Password CLI setup is complete so BRIDGE_TOKEN is not exposed in a cron env.
- last_updated: 2026-03-04

### BORT_PR_REVIEW_PIPELINE
- status: in_progress
- hat_sequence: [ops-core → autonomous]
- last_completed_step: pr-review-job.mjs built with claude/ prefix, legacy exempt logic removed, crons registered, Telegram command added
- next_action: Bryan to open first real PR from a Claude Code session using claude/* branch and verify end-to-end flow
- blocking_issue: none
- relevant_files: scripts/pr-review-job.mjs, logs/pr-review.log, project_source/SYSTEM_CONTEXT.md
- notes: Bort auto-merges approved PRs via squash. Escalates to Bryan via Telegram for flagged PRs. Branch convention is claude/ for Claude Code sessions, bort/ for Bort autonomous work.
- last_updated: 2026-03-05

---

## Entry template

### [PROJECT_NAME]
- status: planning | in_progress | blocked | waiting_approval | complete
- hat_sequence: [hat1 → hat2 → hat3]
- last_completed_step: <description>
- next_action: <what Bort or Bryan does next>
- blocking_issue: <if blocked, why>
- relevant_files: <paths>
- notes: <anything Claude or Bryan should know>
- last_updated: <date>

---

## Archived Projects *(move completed entries here)*
