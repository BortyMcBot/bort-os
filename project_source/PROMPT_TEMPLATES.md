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

