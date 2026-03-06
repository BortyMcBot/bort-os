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

## Antipattern 10: Pinchtab health check without auth header
What happens: curl to http://localhost:9867/health returns 401 and looks like a server failure.
Why it happens: BRIDGE_TOKEN is set but health check curl omits the Authorization header.
Fix: Always include -H "Authorization: Bearer <token>" when curling Pinchtab endpoints.
Token location: ~/.pinchtab/.env

---

## Antipattern 11: Pinchtab fails to start due to stale SingletonLock
What happens: Pinchtab cannot launch Chrome against ~/.pinchtab/chrome-profile — Permission denied on SingletonLock.
Why it happens: A prior Chrome session exited uncleanly and left a lock file behind.
Fix: Confirm no chrome or pinchtab processes are running, then: rm /root/.pinchtab/chrome-profile/SingletonLock
Do not use /tmp/pinchtab-profile for persistent sessions — it will not retain cookies or auth.

---

## Antipattern 12: Snap Chromium wins PATH and breaks Pinchtab profile writes
What happens: Pinchtab repeatedly fails with SingletonLock: Permission denied even after directory recreation, permission changes, and --no-sandbox — because snap-confined Chrome cannot write to /root/ paths outside its sandbox.
Why it happens: Ubuntu systems with snap Chromium installed resolve `chrome` to the snap binary, which runs in a confined namespace regardless of filesystem permissions.
Fix: Install Google Chrome via the official .deb AND explicitly set CHROME_BINARY:
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install ./google-chrome-stable_current_amd64.deb
echo "CHROME_BINARY=/usr/bin/google-chrome-stable" >> ~/.pinchtab/.env
Verify with: which google-chrome-stable (must be /usr/bin/, not /snap/)
Do not rely on PATH alone — snap may still win. Always set CHROME_BINARY explicitly.

---

## Antipattern 13: Pinchtab running as root requires --no-sandbox
What happens: Chrome fails to start when Pinchtab is run as root without sandbox flag.
Why it happens: Chrome refuses to run as root without explicit sandbox override.
Fix: Add to ~/.pinchtab/.env: CHROME_FLAGS=--no-sandbox
This is safe for local-only, loopback-bound instances (BRIDGE_BIND=127.0.0.1).
Do not use --no-sandbox if Pinchtab is exposed to the network.

---

## Antipattern 14: Telegram chat ID hardcoded in multiple implementation files
What happens: If Bryan's Telegram chat ID changes or the channel config moves, it requires edits across 3 separate files with no single source of truth.
Why it happens: Chat ID was added inline when each integration was built.
Affected files:
 - os/x_daily_post.js line 10
 - scripts/pr-review-job.mjs line 227
 - scripts/deploy.mjs line 57
Fix: Centralize TELEGRAM_CHAT_ID in openclaw.json or a shared constants file, and reference it from all three scripts.
Risk: LOW — not a security concern. Maintenance debt only.
Status: OPEN — not yet implemented.

---

## Antipattern 14: CHROME_BINARY in ~/.pinchtab/.env is not loaded by Pinchtab at runtime
What happens: Pinchtab ignores CHROME_BINARY set in ~/.pinchtab/.env and falls back to resolving chrome from PATH — which may resolve to snap Chromium, causing AppArmor denials and SingletonLock permission errors.
Why it happens: Pinchtab only reads CHROME_BINARY from the shell environment, not from its own .env file. Variables in ~/.pinchtab/.env are not automatically exported to the process environment.
Fix: Export CHROME_BINARY explicitly before launching Pinchtab. In scripts/pinchtab-session.sh, add at the top (after shebang): export CHROME_BINARY=/usr/bin/google-chrome-stable
Also remove snap Chromium to eliminate the fallback risk entirely: snap remove chromium
Root cause confirmed by: dmesg showing exe="/snap/chromium/.../chrome" with apparmor="DENIED", while direct launch of /usr/bin/google-chrome-stable succeeded.
Related: Antipattern 12 (snap Chrome PATH conflict), Antipattern 13 (--no-sandbox requirement).

## Adding new entries
When Bort behaves unexpectedly, add an entry with:
- What happened (observable symptom)
- Why it happened (root cause if known)
- Fix or workaround
- Relevant file/line reference if applicable
