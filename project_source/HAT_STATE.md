# HAT_STATE.md

Generated: Feb 28, 2026, 6:00 PM (America/Phoenix)

- profile_source: /root/.openclaw/workspace/os/hat-profiles.json
- hat_count: 4

## Hat profiles

### inbox
- description: Gmail/inbox triage and summaries
- allowedIdentityContexts: human
- allowedTaskTypes: classify, summarize, research, ops
- defaultDataSensitivity: medium
- allowedSkills: gmail_daily_summary, gmail_inbox_triage
- allowedCommands: node /root/.openclaw/workspace/integrations/gmail/daily-review.js
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: concise_operational

### ops-core
- description: Operations, diagnostics, automation, and platform maintenance
- allowedIdentityContexts: human, agent
- allowedTaskTypes: ops, code, spec, research, summarize, classify
- defaultDataSensitivity: medium
- allowedSkills: documentation_drift_handling, project_source_export
- allowedCommands: node /root/.openclaw/workspace/scripts/arch-drift-check.mjs | node /root/.openclaw/workspace/scripts/export-project-source.mjs | node /root/.openclaw/workspace/scripts/refresh-project-source.mjs
- defaultModelChain: openai-codex/gpt-5.3-codex, openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: engineering_brief

### resale
- description: Resale research and listing support
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify, ops
- defaultDataSensitivity: medium
- allowedSkills: resale_ops
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: actionable_checklist

### web
- description: Web research and fetch workflows
- allowedIdentityContexts: agent
- allowedTaskTypes: research, summarize, classify
- defaultDataSensitivity: low
- allowedSkills: web_research
- allowedCommands: (none)
- defaultModelChain: openai-codex/gpt-5.2-codex, openai-codex/gpt-5.2, openai-codex/gpt-5.3-codex, openrouter/nvidia/nemotron-nano-9b-v2:free
- outputStyle: cited_summary

