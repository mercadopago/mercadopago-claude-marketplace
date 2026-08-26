# mercadopago-claude-marketplace

**The official Claude Code plugin marketplace for Mercado Pago payment integrations.**

[![Status: Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/mercadopago/mercadopago-claude-marketplace)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![Version: 4.3.1](https://img.shields.io/badge/version-4.3.1-green)](./CHANGELOG.md)
[![Platform: Claude Code](https://img.shields.io/badge/platform-Claude%20Code-7c3aed)](https://claude.com/claude-code)
[![CI](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml/badge.svg)](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml)

> [!WARNING]
> **This project is under active development.** APIs, skill structures, and plugin interfaces may change between versions. Use in production integrations at your own discretion. Feedback and contributions are welcome.

<div align="center">

### Explore the Component Catalog

[![Browse Components](https://img.shields.io/badge/%F0%9F%94%8D_Browse_Components-mercadopago--claude--marketplace.vercel.app-3483fa?style=for-the-badge&logoColor=white)](https://mercadopago-claude-marketplace.vercel.app/)

> **4 skills** · **1 agent** · **4 commands** · **2 hooks** — all browsable in a visual catalog.
>
> Search, filter, and explore every component with detailed metadata and direct links to source code.

</div>

---

## Overview

A Claude Code plugin that provides guided integration support for the Mercado Pago product families listed below. Availability still depends on country, account eligibility, commercial enablement, and the selected API.

- **MCP-first, connection on demand** — local scaffolding and security checks work offline; OAuth starts only immediately before an MCP tool is needed
- **4 orchestration skills**: `mp-integrate`, `mp-webhooks`, `mp-test-setup`, `mp-review`
- **7 countries** supported: Argentina, Brazil, Mexico, Chile, Colombia, Peru, Uruguay
- **Credential leak prevention** — hook inspects supported Claude tool inputs for hardcoded tokens and blocks secret-file reads in detected Mercado Pago projects
- **OAuth-based auth** — triggered by MCP-backed operations or manually via `/mp-connect`; no keychain scripts needed
- **4 slash commands** — `/mp-integrate`, `/mp-review`, `/mp-connect`, `/mp-test-cards`

## What's new in v4.3.1

A reliability and product-coverage release with no architecture break: one Claude router, four skills, and MCP connection only when a selected live tool requires it.

- **Mandatory generic CTA resolution** for Checkout Pro and Checkout API across common web templates and frameworks.
- **Separate Checkout API payment screen**, with deterministic checks that reject inline checkout forms and disconnected CTAs.
- **Accessible, interactive card fields**, including persistent labels and required CardForm lifecycle controls.
- **Runtime public-key loading**, avoiding cached HTML placeholders and failing visibly when configuration is missing.
- **Correct Checkout Pro preference route**: `/checkout/preferences`, without an invalid `/v1` prefix.
- **SDK safety policy**: detect the official SDK automatically, request authorization, and use the current stable release.
- **Regression tests in CI and pre-commit** for CTA wiring, screen separation, labels, runtime configuration, and endpoint rules.
- **Deterministic product contracts** for Bricks, Subscriptions, Marketplace, Wallet Connect, SmartApps, Payouts, QR, and Point.
- **Public-repository hardening** with a single strict production gate, pinned CI actions, hook regression tests, security policy, and documented data flow.

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

### 3. Connect your account when needed

Scaffolding, bundled test cards, and local security checks do not require a connection. When an operation needs live account data or an MCP action, the plugin starts OAuth at that point. To connect or verify the status manually, run:

```
/mp-connect
```

No Access Token or keychain setup is required — the MCP server handles authentication via OAuth.

For other IDEs (Cursor, VS Code, Windsurf), add `https://mcp.mercadopago.com/mcp` via your IDE's MCP settings panel. Run `/mp-connect` for IDE-specific snippets.

## Skills

| Skill | What it does |
|-------|-------------|
| `mp-integrate` | Wizard for Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Payouts (formerly Money Out), and SmartApps, subject to country/account eligibility |
| `mp-webhooks` | Receiver pattern with HMAC-SHA256 validation; configures and diagnoses webhooks on demand |
| `mp-test-setup` | Creates test users and loads funds via MCP; bundled test-card guidance remains available offline |
| `mp-review` | Runs a local security floor and connects only when the official quality or homologation tools are requested |

Stable, high-impact integration anchors are bundled for offline scaffolding. Live account data, actions, and documentation fallbacks come from the Mercado Pago MCP server only when needed.

## Commands

| Command | Purpose |
|---------|---------|
| `/mp-connect` | Verify or trigger the Mercado Pago MCP OAuth flow |
| `/mp-integrate [product] [options]` | Scaffold a new integration via the wizard. Sub-modes: `webhook`, `test-setup` |
| `/mp-review [scope]` | Review an integration. Scopes: `security`, `webhooks`, `checkout`, `qr`, `subscriptions`, `marketplace`, `quality`, `full` |
| `/mp-test-cards [country]` | Return bundled test cards without MCP authentication |

## When MCP connection is required

OAuth is requested only after the developer selects an operation that is about to call one of these tools:

| Operation | MCP tools |
|---|---|
| List applications or import credentials | `application_list`, `get_credentials` |
| Create an application | `create_application` |
| Fill a gap not covered by official `llms.txt` or bundled references | `search_documentation` |
| Search or verify a payment/order | `search_payments`, `get_payment`, `get_order` |
| Create or fund test users | `create_test_user`, `add_money_test_user` |
| Register or diagnose webhooks | `save_webhook`, `notifications_history` |
| Run official quality checks or homologation | `quality_checklist`, `quality_evaluation`, `form_homologation` |

The `authenticate` and `complete_authentication` tools only bootstrap OAuth. They are not used as pre-flight checks. The plugin first attempts the selected data/action tool and starts OAuth only if that operation needs authentication.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  mp-integration-expert  (router, ~120 lines)           │
│  - routes requests; MCP connection happens on demand  │
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
              │  notifications_history…   │
              │  create_test_user         │
              │  add_money_test_user      │
              └───────────────────────────┘
```

**The agent is a router** with no embedded product implementation guide. **Skills** assemble offline-capable scaffolds from curated references and use MCP tools for live documentation gaps, account data, test-user actions, webhook configuration, quality evaluation, and homologation. OAuth is never requested as a generic pre-flight check.

## Infrastructure

| Component | Name | Purpose |
|-----------|------|---------|
| Agent | `mp-integration-expert` | Single router — detects country and mode, delegates to the right skill |
| Hook | `validate_mp_credentials` | Credential scanner — blocks hardcoded MP tokens from reaching source files |
| Hook | `check-version` | Runs on every prompt to verify plugin version compatibility |
| MCP | `mercadopago` | Live Mercado Pago API access via OAuth (`mcp.mercadopago.com`) |
| CI | `validate.yml` | Hook tests, all deterministic product suites, strict plugin validation, and catalog integrity |

## Compatibility and requirements

For plugin users:

- [Claude Code](https://claude.com/claude-code); release validation uses 2.1.228 or newer.
- Python 3.8+ for the credential scanning hook.
- macOS or Linux. On Windows, use WSL; native Windows is not yet part of the release gate.

The Mercado Pago MCP server is remote and does **not** require a local Node.js server. Repository contributors need Node.js 20+ and npm 10+; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security and privacy

Read [SECURITY.md](./SECURITY.md) before reporting a vulnerability or credential exposure. [PRIVACY.md](./PRIVACY.md) documents which operations remain local and what an explicitly selected MCP call may transmit.

## Contributing

Have a bug to report, a feature to suggest, or a question? Open an issue — that's the best way to contribute. See our [Contributing Guidelines](./CONTRIBUTING.md) for details on how to write a good report or feature request.

## Code of Conduct

This project is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold these standards and help maintain a welcoming and respectful environment for everyone.

## Support

You may find technical documentation about Mercado Pago's products and services on the [Developer's Website](https://www.mercadopago.com.ar/developers/en).

Technical Support is available within the [Developer's Website Support Section](https://www.mercadopago.com.ar/developers/en/support/center).

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this project except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

See the [LICENSE](./LICENSE) file for the full license text, and [NOTICE](./NOTICE)
for attribution information.

### Copyright

Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)
