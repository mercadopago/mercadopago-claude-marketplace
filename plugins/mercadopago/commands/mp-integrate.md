---
description: Scaffold a Mercado Pago integration via the mp-integrate wizard. Supports every product (Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Money Out, SmartApps).
argument-hint: "[product=...] [country=...] [sdk=...] [mode=orders|legacy] [client=...] [3ds=yes|no] [recurrent=yes|no] [marketplace=yes|no]  |  webhook  |  test-setup"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion]
---

# /mp-integrate

Single entry point for adding any Mercado Pago integration. Delegates to one of three skills depending on what the user asked for.

## Routing

| `$ARGUMENTS` | Skill |
|--------------|-------|
| starts with `webhook` | `mp-webhooks` |
| starts with `test-setup` | `mp-test-setup` |
| anything else (or empty) | `mp-integrate` |

## Behaviour

1. Verify the Mercado Pago MCP is **actually authenticated** by checking that `mcp__plugin_mercadopago_mercadopago__application_list` is callable and returns a real payload. The presence of `authenticate` / `complete_authentication` does NOT count, and `ListMcpResourcesTool` returns "No resources found" even when authenticated. If the data tools are not available, stop and ask the user to run `/mcp` and authenticate.
2. Hand control to the matched skill, passing through the rest of `$ARGUMENTS`.
3. Do **not** invent code, payloads, or endpoints in this command file. The skills orchestrate the MCP for that.

## Examples

- `/mp-integrate` — full wizard, asks country/product/SDK/mode interactively.
- `/mp-integrate product=checkout-pro country=AR sdk=node mode=orders` — skips the questions that are already answered.
- `/mp-integrate product=bricks country=BR sdk=node client=react brick=payment` — Bricks flow with a specific brick variant.
- `/mp-integrate webhook` — scaffold the webhook receiver and configure it via MCP.
- `/mp-integrate test-setup` — create a test user and load funds.
