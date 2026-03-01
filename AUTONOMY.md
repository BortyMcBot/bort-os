# AUTONOMY.md

Autonomous work mode (manual kickoff, Phoenix time).

## Start command (chat)

```
autonomous start until HH:MM
```

Example:
```
autonomous start until 07:00
```

## Stop command (chat)

```
autonomous stop
```

## Rules while autonomous mode is active

1) Use **autonomous hat**.
2) Work only on:
   - `bort-os` (stability, automation, docs)
   - `personal-website` (UI, maintainability, features)
3) **No commits to main**. Create branches + PRs only.
4) PRs must be **merge‑ready** with tests/checks where applicable.
5) Stop at the requested Phoenix time.
6) Provide a morning summary with PR links + highlights.

## Runner

- `scripts/autonomous_runner.mjs` is invoked at start.
- It reads `memory/autonomous_state.json` and a simple queue file.
- This is the execution hook for future autonomous tasks.

## State tracking (local)

- `memory/autonomous_state.json` — active window and stop time.
- `memory/autonomous_log.md` — brief run log.
