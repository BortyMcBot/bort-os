# Security Policy

## Reporting a vulnerability

If you believe you’ve found a security vulnerability in this repository:

1. **Do not open a public issue** with sensitive details.
2. Use **GitHub Security Advisories** for this repo to report the issue privately.

We will respond as quickly as practical and coordinate a fix and disclosure.

## Scope

In scope:
- secrets handling and redaction failures
- budget/approval bypasses
- unintended external side effects
- authentication flows and token storage

Out of scope:
- issues in third-party services/providers outside this repo

## Hard rules

- Never commit secrets (tokens, cookies, private keys).
- Never print secrets to chat logs.
- Prefer draft-first + explicit approvals for risky actions.
