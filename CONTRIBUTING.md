# Contributing

Thanks for helping improve Bort OS.

## Ground rules

- Keep changes **auditable** and **small**.
- Prefer **deterministic** scripts over complex frameworks.
- Never commit secrets (tokens/keys/cookies) or personal data.
- Follow the repo’s approval/stop-point discipline: propose → stop → approve → execute.

## Pull requests

- Use clear PR titles and short descriptions.
- Include a brief risk assessment (low/medium/high).
- If the change touches external APIs, include budget/queue behavior.

## Basic checks

Run before opening a PR:

- `node os/preflight.test.js`

Optionally:
- `node os/models_inventory.js`

## Repo structure

- `os/` core scripts/modules
- `skills/` small entrypoints
- `integrations/` external integrations
- `drafts/` shareable drafts
- `memory/` local logs (git-ignored)
