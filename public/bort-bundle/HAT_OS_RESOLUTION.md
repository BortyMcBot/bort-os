# HAT_OS_RESOLUTION.md
Issue: Hat:os is used conversationally but is not defined in the preflight allowlist.
Status: Resolved — Option A implemented (2026-03-03).

---

## The problem
os/preflight.js defines this allowlist (lines 25-46):
- inbox
- web
- resale
- ops-core
- autonomous

Tasks labeled Hat:os in conversation would be rejected at preflight if enforcement is active on that execution path.

---

## Resolution options

### Option A — Alias os → ops-core in preflight (recommended)
Add os as an accepted alias for ops-core in preflight.js.

Pros:
- Zero behavioral change — os tasks route to ops-core model chain and permissions
- Conversational shorthand continues to work
- No hat-profiles.json changes needed

Implementation (do not apply until Bryan approves):
```js
// In preflight.js hat validation (lines 25-46), add alias mapping:
const HAT_ALIASES = { os: 'ops-core' };
const resolvedHat = HAT_ALIASES[envelope.hat] || envelope.hat;
// Then validate resolvedHat against allowlist
```

---

### Option B — Add os as a first-class hat in hat-profiles.json + preflight
Define a distinct os hat profile for low-level system/platform tasks.

Pros:
- Explicit separation between os-level ops and ops-core operational tasks
- Can have tighter command allowlist

Cons:
- More maintenance surface
- Requires hat-profiles.json + preflight + ARCHITECTURE_SUMMARY edits
- Triggers HIGH severity drift check → requires Bryan confirmation

---

### Option C — Deprecate conversational Hat:os usage
Add to PROMPT_ANTIPATTERNS.md (done) and always use ops-core instead.

Pros: No code changes, simplest.
Cons: Relies on discipline, easy to regress.

---

## Recommendation
Option A for immediate fix (low risk, no behavioral change). Option C as complementary convention (already in PROMPT_ANTIPATTERNS.md).

---

## Action required from Bryan
1. Confirm preferred resolution option
2. If Option A: approve a follow-up preflight.js edit task
3. If Option B: confirm hat profile definition before implementation
