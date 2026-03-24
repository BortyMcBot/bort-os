# HAT_STATE.md

Generated: Mar 24, 2026, 6:01 AM (America/Phoenix)

- profile_source: /root/.openclaw/workspace/os/hat-profiles.json
- hat_count: 5

## Hat profiles

### autonomous
- description: Autonomous overnight mode for stability/automation work and PR creation (no main merges)
- allowedIdentityContexts: agent
- allowedTaskTypes: ops, research, spec, code, summarize
- defaultDataSensitivity: low
- allowedSkills: coding-agent, github, gh-issues, openai-image-gen, bluebubbles
- allowedCommands: git status | git diff | git add | git commit | git push | gh pr create | gh pr edit
- defaultModelChain: openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openrouter/anthropic/claude-3.7-sonnet
- outputStyle: engineering_brief

### inbox
- description: Gmail/inbox triage and summaries
- allowedIdentityContexts: human
- allowedTaskTypes: classify, summarize, research, ops
- defaultDataSensitivity: medium
- allowedSkills: himalaya, apple-notes, apple-reminders, bluebubbles, imsg
- allowedCommands: node /root/.openclaw/workspace/integrations/gmail/daily-review.js
- defaultModelChain: openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openrouter/anthropic/claude-3.7-sonnet
- outputStyle: concise_operational

### ops-core
- description: Operations, diagnostics, automation, and platform maintenance
- allowedIdentityContexts: human, agent
- allowedTaskTypes: ops, code, spec, research, summarize, classify
- defaultDataSensitivity: medium
- allowedSkills: 1password, apple-notes, apple-reminders, bear-notes, blucli, bluebubbles, camsnap, clawhub, coding-agent, discord, eightctl, gemini, gh-issues, github, healthcheck, imsg, mcporter, model-usage, nano-pdf, notion, obsidian, openai-image-gen, openai-whisper, openai-whisper-api, pinchtab
- allowedCommands: node /root/.openclaw/workspace/scripts/arch-drift-check.mjs | node /root/.openclaw/workspace/scripts/export-project-source.mjs | node /root/.openclaw/workspace/scripts/refresh-project-source.mjs
- defaultModelChain: openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openrouter/anthropic/claude-3.7-sonnet
- outputStyle: engineering_brief

### resale
- description: Resale research and listing support
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify, ops
- defaultDataSensitivity: medium
- allowedSkills: eightctl, gog, nano-banana-pro, pinchtab
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openrouter/anthropic/claude-3.7-sonnet
- outputStyle: actionable_checklist

### web
- description: Web research and fetch workflows
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify
- defaultDataSensitivity: low
- allowedSkills: blogwatcher, gemini, gifgrep, goplaces, pinchtab
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.4, openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2, openrouter/anthropic/claude-3.7-sonnet
- outputStyle: cited_summary

