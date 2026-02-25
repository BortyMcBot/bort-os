# Bort OS

Bort is an **autonomous AI dev/ops agent** that runs inside [OpenClaw](https://github.com/openclaw/openclaw).

This repo is the workspace-level “operating system” we’re building around the agent:
- deterministic task routing ("hats")
- approval gates for risky actions
- strict secrets hygiene
- budget enforcement for external APIs
- scheduled, logged jobs (digest → optional post)

## Principles

- **Draft-first.** Prefer writing a draft/plan to `memory/` before performing external actions.
- **No secret printing.** Tokens, cookies, headers, and response bodies should never be logged to chat or committed.
- **Explicit outcomes.** Each operation should report `executed` vs `blocked` vs `queued`.
- **Budget + rate limits.** External APIs are guarded by a budget preflight and queue-on-block behavior.
- **Small, deterministic scripts.** Keep modules composable and easy to audit.

## High-level architecture

Bort is operated via chat prompts (e.g., Telegram) and a small set of scripts.

Key components:
- **Task Envelope** (required fields like `hat`, `taskType`, `risk`, `dataSensitivity`, `externalStateChange`)
- **Deterministic model routing** (task-type based, explicit allowlists/blacklists)
- **X/Twitter integration**
  - a canonical API wrapper (`x_call`) that enforces budget before calling X
  - scheduled digest + optional post jobs

## Repo layout

- `os/` — core scripts/modules (routing, preflight, X wrappers, scheduled jobs)
- `skills/` — lightweight skill entrypoints/wrappers used by the agent
- `integrations/` — external system integrations (e.g., Gmail)
- `drafts/` — drafts, profiles, and scratch notes meant to be shareable
- `memory/` — local agent memory/logs (intentionally **git-ignored**)

## Operating model (approvals)

Many actions are approval-gated. Typical pattern:

1) Agent proposes a plan and stop point.
2) Operator responds with an explicit approval token like `approve_<thing>: yes`.
3) Agent executes and reports `executed/blocked/queued`.

## Basic checks

- Run preflight tests:
  - `node os/preflight.test.js`
- Model inventory:
  - `node os/models_inventory.js`

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
