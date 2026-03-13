# Site Improvement Job

Automated review of bryanduckworth.com that generates improvement findings and opens PRs for high-confidence, low-effort changes.

## How it works

The job runs in five phases:

1. **Reconnaissance** — Discovers the site repo via `gh repo list`, clones it, and optionally captures a screenshot, text snapshot, and accessibility tree via Pinchtab.
2. **Analysis** — Reads the repo structure and key config files, then sends everything to Gemini for a structured evaluation covering UX, content, SEO, accessibility, performance, and missing features.
3. **TODO output** — Writes all findings to `docs/site-review/TODO.md` in bort-os with a summary table and detail blocks.
4. **PR creation** — For findings marked `pr_ready: true` (high confidence, trivial/small effort, cosmetic/copy/config only), clones the site repo, applies the change, and opens a PR on a `bort/site-*` branch.
5. **Notification & cleanup** — Sends a Telegram summary and cleans up temp directories.

## Inputs

- **GitHub access** — Uses `gh` CLI (authenticated via direnv/GH_TOKEN)
- **Pinchtab** (optional) — For live page screenshots and accessibility snapshots. If unavailable, the job proceeds with repo-only analysis.
- **OpenClaw agent** — Calls Gemini via `openclaw agent` for analysis

## Outputs

- `docs/site-review/TODO.md` — Full findings report with tables and details
- PRs on the site repo — One per `pr_ready` finding, on `bort/site-<id>-<slug>` branches
- `logs/site-improvement.log` — Append-only run log with timestamps and counts
- Telegram notification to Bryan

## Manual trigger

```bash
# Full run
node scripts/site-improvement-job.mjs

# Dry run (no side effects — no PRs, no Telegram, no git pushes)
node scripts/site-improvement-job.mjs --dry-run
```

## Interpreting TODO.md

- **Ready to PR** section lists findings that were automatically PR'd
- **All Findings** table shows every finding with confidence and effort ratings
- **Details** section has full descriptions and suggested changes
- Findings are numbered `SITE-001`, `SITE-002`, etc.
- Categories: `ux`, `content`, `seo`, `a11y`, `perf`, `feature`

## Cron

Cron registration is handled by Bort post-merge. Suggested schedule: weekly, Sunday 8am Phoenix.
