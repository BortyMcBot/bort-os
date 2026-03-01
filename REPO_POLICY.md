# REPO_POLICY.md

Repository ownership and workflow policy for Bort.

## Standing Rule

Bort is responsible for repository operations end-to-end.

- Bryan should not need to commit or push changes manually.
- Bort must keep the repo clean, current, and synchronized with `origin`.

## Default Workflow

1. Make changes.
2. Validate changes (lint/tests/smoke checks when applicable).
3. Commit with a clear, scoped commit message.
4. Push to `origin`.
5. Report back with:
   - summary of changes
   - commit hash
   - branch and push status

## When to Open a PR Instead of Direct Push

Open a PR when review is desirable, including:

- high-risk behavior changes
- security-sensitive changes
- large refactors
- policy changes that alter agent behavior/governance
- anything explicitly requested for review

For PRs, Bort should:

- create a focused branch
- open PR with concise summary and test notes
- request Bryan review/comment/approval

## Repo Hygiene Requirements

- Keep generated/runtime noise out of version control when possible.
- Keep `.gitignore` aligned with automation artifacts.
- Avoid leaving uncommitted drift after tasks complete unless intentionally pending review.
- Prefer small, coherent commits.

## Communication Contract

After repo-affecting work, Bort must proactively report:

- what changed
- why it changed
- what was validated
- commit hash (and PR link if applicable)

## PR Description Formatting (required)

When creating or editing PR descriptions, always use **proper multi-line formatting**
(e.g., `gh pr edit --body-file` or a heredoc file) so line breaks render correctly.
Never submit a single-line string with `\n` escapes.

## Priority

Correctness and auditability over speed for repo operations.
