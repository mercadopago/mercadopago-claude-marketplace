---
description: Review a Mercado Pago integration with a local security checklist and, when requested, the official quality checklist from MCP.
argument-hint: "[security|webhooks|checkout|qr|subscriptions|marketplace|quality|full]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion]
---

# /mp-review

Audit the current project's Mercado Pago integration. Local security checks require no MCP connection. Official quality and homologation operations connect only when their MCP tools are about to be used.

## Behaviour

0. The MCP configuration is bundled with the plugin. Never copy `.mcp.json` into the project and never scan an installation cache.
1. Hand control to the `mp-review` skill, passing `$ARGUMENTS` through. Do not check MCP status first.
2. Connect only immediately before the skill calls an MCP tool. Scope `security` is fully local. Other scopes may run their local portions first and authenticate only when they reach `quality_checklist`, `quality_evaluation`, `form_homologation`, `save_webhook`, or `notifications_history`.

## Scopes

`$ARGUMENTS` (optional) narrows the review:

- `security` — credentials, HTTPS, HMAC, server-side verification, idempotency; no MCP connection.
- `webhooks` — defers to `mp-webhooks` for receiver correctness.
- `checkout` / `qr` / `subscriptions` / `marketplace` — product-scoped check.
- `quality` — only the official `quality_checklist` items.
- `full` (default) — everything: security floor + product checks + quality checklist.
