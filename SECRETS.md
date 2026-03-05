# SECRETS.md

## Rules
- Never commit secrets or tokens.
- Store secrets only in approved env/config paths.
- Rotate keys if exposure is suspected.

## Where secrets should live
- /root/.openclaw/openclaw.json (env.vars)
- /root/.openclaw/secrets/* (file-based tokens)

## Guardrails
- Run `git status` before commits.
- Use `.gitignore` to block secret paths.
- Avoid logging env vars in chat.
