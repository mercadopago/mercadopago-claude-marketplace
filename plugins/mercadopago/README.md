# mercadopago

Mercado Pago multi-product integration toolkit for Claude Code. Product availability depends on country, account eligibility, and commercial enablement.

> **Code scaffolding works without MCP authentication** using bundled references and the official per-country `llms.txt`. The plugin requests OAuth only immediately before a selected MCP tool, such as live documentation fallback, credential import, test-user actions, webhook registration, quality evaluation, or homologation.

## Quick Start

After installing the plugin, start using it offline or connect to your Mercado Pago account when an MCP-backed operation is needed — no Access Token setup is required.

**Claude Code:** OAuth starts on demand. Run `/mp-connect` only to connect or verify the status manually.

**Other IDEs (Cursor, VS Code, Windsurf, etc.):** add the HTTP server via your IDE's MCP settings panel with URL `https://mcp.mercadopago.com/mcp`, then complete the OAuth flow your IDE prompts. See `/mp-connect` for IDE-specific snippets.

## Version 4.3.2

- `/mp-integrate` reads routed skills directly from `${CLAUDE_PLUGIN_ROOT}`, avoiding a Bash preflight before routing.

## Version 4.3.1

- Checkout Pro and Checkout API always resolve a concrete checkout CTA.
- Checkout API creates and validates a separate payment screen; Checkout Pro keeps its hosted-checkout button in the resolved location.
- Card fields require persistent associated labels and remain interactive throughout SDK initialization.
- Public client configuration is loaded at runtime without HTML placeholder substitution.
- Official SDK installation or updates require authorization and use the current stable release.
- Bundled plugin files use `${CLAUDE_PLUGIN_ROOT}`; the plugin never copies its MCP configuration into the developer's project.
- Deterministic contracts cover Bricks, Subscriptions, Marketplace, Wallet Connect, SmartApps, Payouts, QR, and Point.
- Public installation and data-flow boundaries are documented in the repository `SECURITY.md` and `PRIVACY.md`.

## Architecture (v4)

One agent, four skills, one MCP. The plugin is an **orchestrator**: stable, version-pinned scaffold contracts and safety anchors are bundled and regression-tested, while volatile product documentation and live account data come from official country documentation or MCP on demand.

```
┌────────────────────────────────────────────────────────┐
│  mp-integration-expert  (router)                       │
│  - country detection                                   │
│  - mode detection (Orders API vs legacy)               │
│  - delegates MCP-backed operations on demand           │
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
              │  notifications_history…   │
              │  create_test_user         │
              │  add_money_test_user      │
              │  application_list         │
              └───────────────────────────┘
```

## Skills

| Skill | What it does | Backed by |
|-------|--------------|-----------|
| `mp-integrate` | Wizard that scaffolds a complete integration for any product and uses MCP only for a selected live fallback or account operation. | `search_documentation`, `application_list`, `get_credentials`, `create_application` |
| `mp-webhooks` | Receiver pattern with HMAC-SHA256 validation; configures and diagnoses webhooks. | `save_webhook`, `notifications_history` |
| `mp-test-setup` | Creates test users and loads funds. Credentials come in `APP_USR-` (Orders API, Checkout Pro, Point, QR) and `TEST-` (Checkout API, Bricks) formats — both valid and actively issued. | `create_test_user`, `add_money_test_user` |
| `mp-review` | Runs a local security floor and connects on demand for official quality checks and homologation. | `quality_checklist`, `quality_evaluation`, `form_homologation` |

## Commands

| Command | Description |
|---------|-------------|
| `/mp-connect` | Verify or trigger the MCP OAuth flow. |
| `/mp-integrate` | Scaffold a new integration. Sub-modes: `/mp-integrate webhook`, `/mp-integrate test-setup`. |
| `/mp-review [scope]` | Audit the integration. Scopes: `security`, `webhooks`, `checkout`, `qr`, `subscriptions`, `marketplace`, `quality`, `full`. |
| `/mp-test-cards [country]` | Return bundled test cards without MCP authentication. |

## MCP tools that trigger connection

Connection is requested only after the developer selects an operation backed by `application_list`, `get_credentials`, `create_application`, `search_documentation`, `search_payments`, `get_payment`, `get_order`, `create_test_user`, `add_money_test_user`, `save_webhook`, `notifications_history`, `quality_checklist`, `quality_evaluation`, or `form_homologation`.

`authenticate` and `complete_authentication` are OAuth bootstrap tools, not pre-flight checks. Static scaffolding, local security review, receiver generation, and bundled test cards do not connect to MCP.

## What changed from v3

- 13 product skills → 4 orchestration skills.
- Large duplicated documentation copies were removed; approved references now contain only stable anchors and tested scaffold contracts.
- Volatile status tables, device lists, and live availability remain in official documentation or MCP.
- `mp-setup` command renamed to `mp-integrate`, with `webhook` and `test-setup` sub-routes.
- Agent acts as a router with no embedded product implementation guide.
- MCP connection is **on demand** — scaffolding and local checks proceed offline; OAuth starts only immediately before a selected MCP tool.

## Hook: Credential Leak Prevention

Inspects supported Claude write/edit/Bash inputs for hardcoded Mercado Pago credentials. In detected Mercado Pago projects it also blocks direct Read and common Bash attempts to expose `.env`, `.env.*`, `.envrc`, and `*.env` files; examples and templates remain readable. This is defense in depth, not a replacement for secret scanning or credential rotation.

## MCP: Mercado Pago API

Connects to the official Mercado Pago MCP server (`https://mcp.mercadopago.com/mcp`) via HTTP transport. OAuth starts when an MCP-backed operation is selected; `/mp-connect` remains available for manual setup and diagnostics.

## Configuration

See [PLUGIN_SETTINGS.md](./PLUGIN_SETTINGS.md) for per-project configuration options (e.g., disabling the credential hook).

## Resources

The plugin resolves country-specific links during the wizard. General entry points:

- [Mercado Pago Developer Docs](https://www.mercadopago.com.ar/developers/en/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [SDKs](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/landing)
- [Developer Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
- [Repository security policy](../../SECURITY.md)
- [Privacy and data flow](../../PRIVACY.md)
