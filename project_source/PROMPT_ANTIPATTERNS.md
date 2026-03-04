# PROMPT_ANTIPATTERNS.md
Purpose: Known prompt patterns that cause Bort to fail, misbehave, or require manual recovery.
Maintained by: Bryan + Claude (add entries after any incident or unexpected behavior)

---

## Antipattern 1: Using hat:os in Task Envelopes
What happens: preflight.js rejects the envelope — os is not in the hat allowlist.
Why it happens: Conversational shorthand ("Hat: os") bleeds into formal task envelopes.
Fix: Route os-level tasks through hat:ops-core instead.
Workaround until fixed: None — envelope will be rejected at preflight.
Status: RESOLVED (2026-03-03) — Option A implemented. hat:os now aliased to ops-core in os/preflight.js. Envelopes with hat:os will pass preflight and route correctly. This entry is retained for historical reference.

---

## Antipattern 2: externalStateChange:true without approvalNeeded:true
What happens: preflight.js blocks execution entirely.
Why it happens: Easy to forget approval gating when drafting prompts quickly.
Fix: Any task that sends email, posts to social, pushes to git remote, or modifies external services must have approvalNeeded:true.
Rule of thumb: If it leaves the machine, it needs approval.

---

## Antipattern 3: Missing required envelope fields
What happens: preflight.js rejects with a field validation error.
Required fields: hat, intent, taskType, taskSize, risk, dataSensitivity, externalStateChange, identityContext, actions, approvalNeeded
Why it happens: Shortcutting the envelope when a task feels simple.
Fix: Always use the full envelope. Use PROMPT_TEMPLATES.md Template 1 as the base.

---

## Antipattern 4: Using identityContext:human with agent-only hats
What happens: preflight identity context check fails.
Affected hats: autonomous (agent only), resale (agent only)
Why it happens: Prompts written for interactive use accidentally use human context.
Fix: Match identity context to hat:
- autonomous → agent
- resale → agent
- inbox → human
- ops-core → human or agent
- web → agent

---

## Antipattern 5: High-sensitivity output not suppressed
What happens: Output containing blocklist patterns is emitted — violates suppression policy.
Why it happens: Prompts that ask Bort to show, print, or return sensitive data directly.
Fix: For high-sensitivity tasks, instruct Bort to write output to a file path and return only a pointer message. Never ask for raw output in the response.
Relevant enforcement: os/preflight.js lines 185-233

---

## Antipattern 6: Autonomous hat used for tasks requiring main branch merges
What happens: Bort may attempt or propose a main branch merge — outside autonomous hat scope.
Why it happens: Vague deploy or release language in overnight task specs.
Fix: Explicitly state no merges to main in autonomous hat prompts. PRs are allowed; merges are not.

---

## Antipattern 7: Vague Definition of Done
What happens: Bort completes a partial task and reports success — Bryan discovers gaps later.
Why it happens: Prompts omit verifiable completion checks.
Fix: Always include explicit, command-level verification steps in Definition of Done.
Example: Done when: openclaw models status --json shows gpt-5.2-codex as default.

---

## Antipattern 8: Requesting structured data output without specifying format
What happens: Bort returns prose when JSON/bullets were needed, or vice versa.
Why it happens: Output format field omitted or left vague.
Fix: Always specify Output format explicitly. Use hat output style as baseline:
- ops-core / autonomous → engineering_brief
- inbox → concise_operational
- resale → actionable_checklist
- web → cited_summary

---

## Antipattern 9: Stacking multiple high-risk actions in one envelope
What happens: If one action fails mid-task, rollback is unclear and state is inconsistent.
Why it happens: Trying to be efficient by combining steps.
Fix: Split tasks at natural approval gates. One envelope per external state change.

---

## Adding new entries
When Bort behaves unexpectedly, add an entry with:
- What happened (observable symptom)
- Why it happened (root cause if known)
- Fix or workaround
- Relevant file/line reference if applicable
