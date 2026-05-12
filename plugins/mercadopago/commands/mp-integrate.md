---
description: Scaffold a Mercado Pago integration via the mp-integrate wizard. Supports every product (Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Money Out, SmartApps).
argument-hint: "[product=...] [country=...] [mode=...] [client=...] [3ds=yes|no] [recurrent=yes|no] [marketplace=yes|no]  |  webhook  |  test-setup"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, WebFetch]
---

# /mp-integrate

This command runs the Mercado Pago integration wizard. **Do not re-read this file in a loop, and do not delegate to the `mp-integration-expert` agent independently — that bypasses the wizard and produces invented defaults.** Read the SKILL.md once, follow it step by step, and stop when the bundle is rendered or the user cancels.

## Routing

Inspect `$ARGUMENTS`:

| `$ARGUMENTS` starts with | Skill to follow |
|--------------------------|-----------------|
| `webhook` | Read and follow `plugins/mercadopago/skills/mp-webhooks/SKILL.md` |
| `test-setup` | Read and follow `plugins/mercadopago/skills/mp-test-setup/SKILL.md` |
| anything else (or empty) | Read and follow `plugins/mercadopago/skills/mp-integrate/SKILL.md` |

## Execution rules

1. **MCP gate — three states (check in order).**

   **State A — `application_list` is callable and returns an app:** MCP is authenticated. Continue.

   **State B — only `authenticate` / `complete_authentication` are visible:** MCP is loaded but needs OAuth. Call `mcp__plugin_mercadopago_mcp__authenticate` immediately — show the returned URL as a clickable link:

   > Open this URL to connect Mercado Pago: **{authorization_url}**
   > When you see **"Authentication Successful"**, come back and say anything.

   When the user responds: call `application_list` directly — **do NOT call `complete_authentication`** (it hangs because the local server already consumed the callback). Only fall back to `complete_authentication` if `application_list` still fails AND the browser showed a connection error. Never ask the user to paste the callback URL — it contains a sensitive OAuth code.

   **State C — neither `application_list` nor `authenticate` are visible:** The plugin is not loaded or is disabled. Tell the user:
   > The Mercado Pago plugin is not loaded. Run **`/mcp`** in the terminal, find `plugin:mercadopago:mcp`, and enable it. Then run **`/mp-integrate`** again.

   Do NOT tell them to run `/mp-connect` in State C — that command also requires the plugin to be loaded.

2. **Read the SKILL.md ONCE.** Use the `Read` tool to load the SKILL.md path from the routing table above. Then **execute the steps in that file in order** — `Step 0`, `Step 1.a`, `Step 1.b`, etc. Do not re-read the SKILL.md or this command file again. Do not delegate to a separate agent.

3. **Apply the HARD LOCKS at the top of the SKILL.md before any `AskUserQuestion`.** In particular: SDK is never asked, `mode` for `checkout-pro` is `preferences` (Orders is not available — never offer it), and there is no `Environment` picker.

4. **Never assume defaults.** If `$ARGUMENTS` is empty, do **not** assume `product=checkout-pro` or `country=AR` or any other value. Run the wizard from scratch and ask `AskUserQuestion` for each unresolved dimension. Defaults from past conversations or memory are forbidden.

5. **MCP `search_documentation` is the primary docs source.** When the SKILL.md tells you to fetch docs, use `mcp__plugin_mercadopago_mcp__search_documentation` — never WebFetch. WebFetch is allowed only as a last resort if `search_documentation` returns nothing useful for the specific combination (max 1 WebFetch per interaction). Three consecutive WebFetches to docs URLs is a bug — abort.

## Examples

- `/mp-integrate` — full wizard, asks for everything not auto-detected from the repo.
- `/mp-integrate product=checkout-pro country=AR` — skips those questions.
- `/mp-integrate product=bricks country=BR client=react brick=payment` — Bricks flow with a specific brick variant.
- `/mp-integrate webhook` — scaffold the webhook receiver and configure it via MCP.
- `/mp-integrate test-setup` — create a test user and load funds.
