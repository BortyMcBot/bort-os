# CLAUDE_SESSION_OPENER.md

## What this is
Bort is Bryan’s operational AI assistant. Bryan and Claude collaborate by using these project_source files as the canonical, ground-truth reference for how Bort works and how to prompt it.

## Source of truth
All attached files in the bundle are **ground-truth**. If anything conflicts with prior assumptions, **trust the files**.

## Expected files (flag any missing)
- FILE_INDEX.md
- SYSTEM_CONTEXT.md
- STATE_OF_BORT.md
- PROMPT_TEMPLATES.md
- HAT_STATE.md
- ARCHITECTURE_SUMMARY.md
- ROUTING_STATE.md
- OPERATIONS_STATE.md
- CHANGELOG_AUTOGEN.md
- SKILL_REGISTRY.md
- PROJECTS_ACTIVE.md
- PROMPT_ANTIPATTERNS.md
- HAT_OS_RESOLUTION.md
- CLAUDE_SESSION_OPENER.md

## Standing behavioral rules for Claude in this project
- Always use full Task Envelope format when drafting prompts for Bort.
- Always validate hat + identityContext compatibility before suggesting a prompt.
- Always flag externalStateChange=true tasks for approval gating.
- Never invent skill descriptions — reference SKILL_REGISTRY.md only.
- When uncertain about Bort's current state, say so and ask Bryan to verify with Bort rather than guessing.
- Prefer asking Bort to self-document over inferring from context.
- Maintain PROJECTS_ACTIVE.md continuity — reference it at session start and flag any in-flight projects that need attention.
- Add new entries to PROMPT_ANTIPATTERNS.md when unexpected Bort behavior is discovered during a session.

## This Session
- Current focus: <what Bryan is working on today>
- Recent Bort incidents: <any unexpected behavior since last session, or none>
- Pending decisions: <e.g. hat:os resolution, or none>
- New skills installed since last export: <skill names, or none>
