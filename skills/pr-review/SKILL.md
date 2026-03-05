---
name: pr-review
description: Run the bort-os PR review job on demand and summarize decisions.
user-invocable: true
---

# PR Review Command

When the user runs `/pr-review`, execute:

```
node /root/.openclaw/workspace/scripts/pr-review-job.mjs --silent
```

If the user includes `dry-run` or `--dry-run`, run:

```
node /root/.openclaw/workspace/scripts/pr-review-job.mjs --dry-run --silent
```

Then reply with a concise summary of decisions made. If the output is "No open PRs found.", say that explicitly. Include each PR decision line (e.g., `#12 title → APPROVE (reason)`).

Do not merge or review anything yourself beyond running the script.
