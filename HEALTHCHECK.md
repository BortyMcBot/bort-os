# HEALTHCHECK.md

Purpose: a single checklist for Bort to run and extend over time.

## Current baseline checks

### 1) Gateway + Tailscale route (required)
- `openclaw gateway status`
- `openclaw config get gateway.bind`
- `openclaw config get gateway.tailscale.mode`
- `openclaw qr --json`

Pass criteria:
- `gateway.bind = loopback`
- `gateway.tailscale.mode = serve`
- `openclaw qr --json` shows `urlSource: gateway.tailscale.mode=serve`
- `gatewayUrl` is your tailnet URL (`*.ts.net`)

### 2) OpenClaw runtime health
- `openclaw status`
- `openclaw health --json`

Pass criteria:
- runtime active
- RPC probe ok
- no critical errors

### 3) Security posture snapshot (read-only)
- `openclaw security audit --deep`
- `openclaw update status`

Pass criteria:
- no critical findings, or findings have a tracked remediation note

### 4) Repo hygiene (workspace)
- `git -C /root/.openclaw/workspace status --short`

Pass criteria:
- expected local changes only
- no accidental secret/config drift committed unintentionally

### 5) Optional integrations pulse
- Gmail daily job token validity (detect `invalid_grant`)
- Any recurring job failures in recent logs

Pass criteria:
- no auth failures blocking daily automations

---

## Change log for this checklist
- 2026-03-20: Added baseline checks.
- 2026-03-20: Added Tailscale gateway guard as first-class check.

---

## Add new checks
When adding checks, include:
1. Command(s)
2. Pass/fail criteria
3. Severity (`critical`, `warning`, `info`)
4. Suggested fix command or playbook link
