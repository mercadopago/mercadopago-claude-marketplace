# mercadopago

Mercado Pago full-product integration toolkit for Claude Code.

> **The Mercado Pago MCP server must always be connected for this plugin to do anything.** Every endpoint, payload, code snippet, and quality check is pulled live from `mcp.mercadopago.com`. There is no offline fallback. If the MCP is not authenticated, the agent and all skills stop and ask the user to run `/mp-connect`.

## Quick Start

After installing the plugin, connect it to your Mercado Pago account via OAuth — no Access Token required.

**Claude Code:** run `/mp-connect` — the wizard registers the server and walks you through the OAuth flow step by step.

**Other IDEs (Cursor, VS Code, Windsurf, etc.):** add the HTTP server via your IDE's MCP settings panel with URL `https://mcp.mercadopago.com/mcp`, then complete the OAuth flow your IDE prompts. See `/mp-connect` for IDE-specific snippets.

## Architecture (v4)

One agent, four skills, one MCP. The plugin is an **orchestrator**, not a documentation container. All product knowledge lives in the MCP and the public Mercado Pago documentation; the skills translate developer intent into the right MCP queries and assemble the response.

```
┌────────────────────────────────────────────────────────┐
│  mp-integration-expert  (router, ~120 lines)           │
│  - country detection                                   │
│  - mode detection (Orders API vs legacy)               │
│  - MCP-gate every interaction                          │
│  - delegates to one of four skills                     │
└──────────────────────────┬─────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┬──────────────────┐
        ▼                  ▼                  ▼                  ▼
   mp-integrate       mp-webhooks       mp-test-setup        mp-review
   (wizard)           (HMAC + MCP        (create_test_user   (quality_checklist
                       webhook tools)     + add_money)        + security floor)
        │                  │                  │                  │
        └──────────────────┴──────────────────┴──────────────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │  Mercado Pago MCP server  │
              │  (mcp.mercadopago.com)    │
              │                           │
              │  search_documentation     │
              │  quality_checklist        │
              │  quality_evaluation       │
              │  save_webhook             │
              │  simulate_webhook         │
              │  notifications_history… │
              │  create_test_user         │
              │  add_money_test_user      │
              │  application_list         │
              └───────────────────────────┘
```

## Skills

| Skill | What it does | Backed by |
|-------|--------------|-----------|
| `mp-integrate` | Wizard that scaffolds a complete integration for any product (Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Money Out, SmartApps). Asks the minimum questions, queries the MCP, returns a ready-to-paste bundle. | `search_documentation` |
| `mp-webhooks` | Receiver pattern with HMAC-SHA256 validation; configures, simulates, and diagnoses webhooks. | `save_webhook`, `simulate_webhook`, `notifications_history_diagnostics` |
| `mp-test-setup` | Creates test users and loads funds. Clarifies the modern testing model (no `TEST-` prefix anymore — both production and test users use `APP_USR-`). | `create_test_user`, `add_money_test_user` |
| `mp-review` | Runs the official quality checklist live + a fixed cross-cutting security floor. Suggests `quality_evaluation` when the integration produced a compatible payment/order id. | `quality_checklist`, `quality_evaluation` |

## Commands

| Command | Description |
|---------|-------------|
| `/mp-connect` | Verify or trigger the MCP OAuth flow. |
| `/mp-integrate` | Scaffold a new integration. Sub-modes: `/mp-integrate webhook`, `/mp-integrate test-setup`. |
| `/mp-review [scope]` | Audit the integration. Scopes: `security`, `webhooks`, `checkout`, `qr`, `subscriptions`, `marketplace`, `quality`, `full`. |

## What changed from v3

- 13 product skills → 4 orchestration skills.
- ~3,800 lines of `references/*.md` removed — the MCP is the single source of truth.
- Static product matrices (payment status tables, device lists, country availability) deleted — pulled live from MCP.
- `mp-setup` command renamed to `mp-integrate`, with `webhook` and `test-setup` sub-routes.
- Agent shrunk to a router (~120 lines) with no embedded product knowledge.
- MCP-connection gate is now **mandatory** in the agent and every skill — no skill loads if the MCP is not authenticated.

## Hook: Credential Leak Prevention

Automatically scans code being written for hardcoded Mercado Pago credentials (Access tokens, client secrets, bearer headers, webhook secrets) and blocks the write. Also blocks reading `.env` files (`.env.example` remains readable).

## MCP: Mercado Pago API

Connects to the official Mercado Pago MCP server (`https://mcp.mercadopago.com/mcp`) via HTTP transport. OAuth-based auth — run `/mp-connect` for setup. The plugin will refuse to operate without an authenticated MCP.

## Configuration

See [PLUGIN_SETTINGS.md](./PLUGIN_SETTINGS.md) for per-project configuration options (e.g., disabling the credential hook).

## Resources

- [Mercado Pago Developer Docs](https://www.mercadopago.com.ar/developers/en/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [SDKs](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/landing)
- [Credentials Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
