# Telegram Header Experiments — 2026-02-26

## Goal
Fix Telegram outbound sending so the intended body is always delivered (multi-line preserved) while adding an optional header line showing:
- 🎩 hat
- 🤖 model
- 🔢 tokens

Also ensure headers never block delivery and never render 🎩 unknown.

## What we tried / changed (high-level)

### 1) Body-first send reliability
- Ensured Telegram sends always deliver the body (multi-line preserved).
- Stripped a strict first-line `Hat: <value>` on outbound (first line only) to avoid leaking control lines into messages.
- Refused to send header-only/empty body messages.

### 2) Hat propagation (run-scoped)
- Added AsyncLocalStorage (ALS) hat context so a single run has a deterministic hat.
- Telegram send/edit fills `telemetry.hat_used` from ALS context when missing.
- Added `general` as the default hat; reserved `inbox` for Gmail-only.

### 3) "unknown" header issues
- Implemented a cumulative per-chat header accumulator (bucket of hats/models/tokens) and injected the header into outbound text.
- Observed that some messages showed `🎩 unknown | 🤖 unknown` in the client even when gateway logs indicated non-unknown headers.
- Added guardrails so invalid hats (e.g. "unknown") are not persisted into the bucket and fall back to `general`.

### 4) Attempted message-id in header (abandoned)
- Tried adding Telegram `message_id` to header via post-send edit.
- Manual edit succeeded, but auto edit was unreliable/too complex.
- Bryan requested we drop message-id-in-header.

### 5) Persisted usage accumulator (between sends)
- Implemented a workspace file accumulator idea:
  - `/root/.openclaw/workspace/memory/telegram_outbound_usage.json`
- Intended behavior:
  - accumulate hats/models/tokens while working
  - header uses file contents on send, then clears file

## Outcome
We ended with a complex set of local patches to installed OpenClaw files under `/usr/lib/node_modules/openclaw/dist/...`.
This made iteration fast but increased risk of drift and confusion.

## Next direction (agreed)
- Save this note for context.
- Remove local patches and workspace clutter.
- Update OpenClaw to latest.
- Restart gateway.
- Re-evaluate header requirements against upstream behavior, then re-implement cleanly only if still needed.
