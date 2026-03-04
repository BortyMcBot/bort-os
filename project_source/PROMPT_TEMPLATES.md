# PROMPT_TEMPLATES.md

## 1) Quick execution prompt
Goal: <one sentence outcome>
Context: <relevant state/files/links>
Constraints: <what is allowed / forbidden>
Inputs: <exact paths/data>
Output format: <bullets/json/diff>
Definition of Done: <verifiable checks>

## 2) Read-only audit prompt
Authority: READ-ONLY. No edits, no restarts, no external sends.
Goal: <what to verify>
Checks: <exact commands/files>
Output: raw command output + concise findings.
Done when: <explicit checks pass/fail>

## 3) Safe change prompt (with validation)
Authority: MAY edit workspace files only.
Goal: <target end-state>
Rules: no /usr/lib changes unless approved; no destructive ops.
Implementation: <files to edit>
Actions: include policy tags when applicable, e.g. cmd:<exact command> and skill:<skill-id>.
Validation: run <tests/commands>; include exact output.
Deliverable: changed paths + minimal diff + rollback note.

## 4) Incident response prompt
Goal: restore service safely.
Priority: correctness over speed.
Constraints: ask before restart/delete; keep evidence.
Steps: diagnose -> isolate root cause -> propose fix -> apply (if approved) -> verify.
Output: timeline, root cause, fix, prevention items.

## 5) Session close prompt
Purpose: Run at the end of any work session to commit changes, update docs, and export a fresh bundle.
hat: autonomous
intent: Commit session changes to git, update PROJECTS_ACTIVE.md and CHANGELOG_AUTOGEN.md, and export fresh project_source bundle
taskType: ops
taskSize: small
risk: low
dataSensitivity: low
externalStateChange: true
identityContext: agent
approvalNeeded: true
actions:
- cmd: git status
- cmd: git diff --stat
- cmd: node /root/.openclaw/workspace/scripts/export-project-source.mjs --force
- cmd: git push origin HEAD
Goal: 1. Review git status and diff — commit all changes with a concise message summarizing what changed
2. Append a new dated entry to CHANGELOG_AUTOGEN.md summarizing structural changes — no diff dumps
3. Update PROJECTS_ACTIVE.md to reflect current project status
4. Run export-project-source.mjs --force to regenerate EXPORT_LATEST.md
5. Push committed changes to remote — report commit hash visible on remote
6. Report: commit hash, changed files, and confirmation EXPORT_LATEST.md was updated
Constraints: - No merges to main
- Do not modify any implementation files — documentation and git only
Output format: engineering_brief
Definition of Done: - git log shows new commit with session changes
- CHANGELOG_AUTOGEN.md has new dated entry
- PROJECTS_ACTIVE.md is current
- EXPORT_LATEST.md timestamp matches this run
- git push succeeds and commit is visible on remote

Constraints: - Append only — do not modify templates 1-4
- No changes outside project_source/PROMPT_TEMPLATES.md
Output format: engineering_brief
Definition of Done: - PROMPT_TEMPLATES.md contains Template 5 exactly as specified
- Templates 1-4 unchanged
- cat project_source/PROMPT_TEMPLATES.md output confirms addition
