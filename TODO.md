# TODO.md — Bryan + Bort

## Blockers / Requires Bryan

1) **Web search**: configure Brave Search API key
   - Run: `openclaw configure --section web`
   - Add `BRAVE_API_KEY`

2) **Gmail OAuth stability**
   - If tokens revoke again: check Google Account → Security → Third-party access.
   - Consider using a dedicated OAuth client just for Bort and avoid frequent re-consents.

3) **Weekly backups to Google Drive** (requested)
   Decisions needed:
   - Include secrets bundle? (recommended yes)
   - Encryption method: age vs gpg
   - Weekly schedule: day/time (Pacific or Tucson time)

4) **Email replying workflow**
   Decide preference:
   - Draft-only with your approval
   - Auto-reply allowed only for certain senders/labels

## Improvements Bort can do without Bryan

- Add a second Gmail account using same project/client.
- Improve classification rules:
  - sender allow/block lists
  - keyword tuning
- Add a "receipt/statement" label and route accordingly.

## Housekeeping

- Ensure `bort-gmail-daily.timer` remains enabled.
- Keep `integrations/gmail/` scripts consistent with RUNBOOK.
