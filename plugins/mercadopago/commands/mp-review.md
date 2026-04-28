---
description: Review a Mercado Pago integration against the official quality checklist (live from MCP) and a fixed cross-cutting security checklist.
argument-hint: "[security|webhooks|checkout|qr|subscriptions|marketplace|quality|full]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion]
---

# /mp-review

Audit the current project's Mercado Pago integration. Delegates to the `mp-review` skill, which orchestrates the MCP `quality_checklist` (and `quality_evaluation` when applicable) plus a fixed security floor.

## Behaviour

1. Verify the Mercado Pago MCP is **actually authenticated** by checking that `mcp__plugin_mercadopago_mercadopago__quality_checklist` is callable. The bootstrap tools `authenticate` / `complete_authentication` always exist and prove nothing; `ListMcpResourcesTool` returns "No resources found" either way. If the data tools are not available, stop and tell the user to run `/mcp` and authenticate. **There is no offline mode** — the official checklist must come from the MCP.
2. Hand control to the `mp-review` skill, passing `$ARGUMENTS` (the scope) through.

## Scopes

`$ARGUMENTS` (optional) narrows the review:

- `security` — credentials, HTTPS, HMAC, server-side verification, idempotency.
- `webhooks` — defers to `mp-webhooks` for receiver correctness.
- `checkout` / `qr` / `subscriptions` / `marketplace` — product-scoped check.
- `quality` — only the official `quality_checklist` items.
- `full` (default) — everything: security floor + product checks + quality checklist.
