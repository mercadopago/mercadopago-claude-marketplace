# mercadopago-claude-marketplace

**The official Claude Code plugin marketplace for Mercado Pago payment integrations.**

[![Status: Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/mercadopago/mercadopago-claude-marketplace)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![Version: 4.0.0](https://img.shields.io/badge/version-4.0.0-green)](./CHANGELOG.md)
[![Platform: Claude Code](https://img.shields.io/badge/platform-Claude%20Code-7c3aed)](https://claude.com/claude-code)
[![CI](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml/badge.svg)](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml)

> [!WARNING]
> **This project is under active development.** APIs, skill structures, and plugin interfaces may change between versions. Use in production integrations at your own discretion. Feedback and contributions are welcome.

<div align="center">

### Explore the Component Catalog

[![Browse Components](https://img.shields.io/badge/%F0%9F%94%8D_Browse_Components-mercadopago--claude--marketplace.vercel.app-3483fa?style=for-the-badge&logoColor=white)](https://mercadopago-claude-marketplace.vercel.app/)

> **4 skills** · **1 agent** · **3 commands** · **2 hooks** — all browsable in a visual catalog.
>
> Search, filter, and explore every component with detailed metadata and direct links to source code.

</div>

---

## Overview

A Claude Code plugin that gives you an AI-powered integration assistant for the full Mercado Pago product suite. Ask questions, scaffold projects, review code, and get real-time API guidance — all from your terminal.

- **MCP-first architecture** — one thin router agent delegates to 4 orchestration skills backed by the live Mercado Pago MCP server
- **4 orchestration skills**: `mp-integrate`, `mp-webhooks`, `mp-test-setup`, `mp-review`
- **7 countries** supported: Argentina, Brazil, Mexico, Chile, Colombia, Peru, Uruguay
- **Credential leak prevention** — hook scans every file write for hardcoded tokens
- **OAuth-based auth** — connect via `/mp-connect`, no keychain scripts needed
- **3 slash commands** — `/mp-integrate`, `/mp-review`, `/mp-connect`

## Installation

### 1. Add the marketplace

```bash
/plugin marketplace add https://github.com/mercadopago/mercadopago-claude-marketplace.git
```

### 2. Install the plugin

```bash
/plugin install mercadopago@mercadopago-claude-marketplace
```

If you are developing this repository locally, you must run `bash scripts/install-git-hooks.sh` before making commits. This is required to activate the pre-commit hook. The validation command expects `claude` to be available on the machine.

### 3. Connect your account

Inside Claude Code, run:

```
/mp-connect
```

This starts the OAuth flow. No Access Token or keychain setup required — the MCP server handles authentication via OAuth.

For other IDEs (Cursor, VS Code, Windsurf), add `https://mcp.mercadopago.com/mcp` via your IDE's MCP settings panel. Run `/mp-connect` for IDE-specific snippets.

## Skills

| Skill | What it does |
|-------|-------------|
| `mp-integrate` | Wizard that scaffolds a complete integration for any product: Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Money Out, SmartApps |
| `mp-webhooks` | Receiver pattern with HMAC-SHA256 validation; configures, simulates, and diagnoses webhooks |
| `mp-test-setup` | Creates test users and loads funds. Clarifies the modern testing model (no `TEST-` prefix — both users use `APP_USR-`) |
| `mp-review` | Runs the official quality checklist live + a fixed cross-cutting security floor |

All product knowledge (endpoint URLs, request/response schemas, code snippets, payment status tables, country availability) is pulled live from the Mercado Pago MCP server. Nothing is hardcoded in the skills.

## Commands

| Command | Purpose |
|---------|---------|
| `/mp-connect` | Verify or trigger the Mercado Pago MCP OAuth flow |
| `/mp-integrate [product] [options]` | Scaffold a new integration via the wizard. Sub-modes: `webhook`, `test-setup` |
| `/mp-review [scope]` | Review an integration. Scopes: `security`, `webhooks`, `checkout`, `qr`, `subscriptions`, `marketplace`, `quality`, `full` |

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  mp-integration-expert  (router, ~120 lines)           │
│  - MCP-gate every interaction                          │
│  - country detection                                   │
│  - mode detection (Orders API vs legacy)               │
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
              │  notifications_history…   │
              │  create_test_user         │
              │  add_money_test_user      │
              └───────────────────────────┘
```

**The agent is a thin router** (~120 lines) with no embedded product knowledge. **Skills** translate developer intent into MCP queries and assemble the response. **The MCP** is the single source of truth — all endpoints, payloads, code snippets, and quality criteria are pulled live. There is no offline mode.

## Infrastructure

| Component | Name | Purpose |
|-----------|------|---------|
| Agent | `mp-integration-expert` | Single router — detects country and mode, delegates to the right skill |
| Hook | `validate_mp_credentials` | Credential scanner — blocks hardcoded MP tokens from reaching source files |
| Hook | `check-version` | Runs on every prompt to verify plugin version compatibility |
| MCP | `mercadopago` | Live Mercado Pago API access via OAuth (`mcp.mercadopago.com`) |
| CI | `validate.yml` | JSON validation, Python syntax checks, skill integrity |

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js 18+ (for the MCP server)
- Python 3.8+ (for the credential scanning hook)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new plugins or improving existing ones.

## Support

You may find technical documentation about Mercado Pago's products and services on the [Developer's Website](https://www.mercadopago.com.ar/developers/en)

Technical Support is avaliable within the [Developer's Website Support Section](https://www.mercadopago.com.ar/developers/en/support/center)

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this project except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

See the [LICENSE](./LICENSE) file for the full license text, and [NOTICE](./NOTICE)
for attribution information.

### Copyright

Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
