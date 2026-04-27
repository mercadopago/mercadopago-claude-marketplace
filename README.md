# mercadopago-claude-marketplace

**The official Claude Code plugin marketplace for Mercado Pago payment integrations.**

[![Status: Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/mercadopago/mercadopago-claude-marketplace)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![Version: 3.0.0](https://img.shields.io/badge/version-3.0.0-green)](./CHANGELOG.md)
[![Platform: Claude Code](https://img.shields.io/badge/platform-Claude%20Code-7c3aed)](https://claude.com/claude-code)
[![CI](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml/badge.svg)](https://github.com/mercadopago/mercadopago-claude-marketplace/actions/workflows/validate.yml)

> [!WARNING]
> **This project is under active development.** APIs, skill structures, and plugin interfaces may change between versions. Use in production integrations at your own discretion. Feedback and contributions are welcome.

<div align="center">

### Explore the Component Catalog

[![Browse Components](https://img.shields.io/badge/%F0%9F%94%8D_Browse_Components-mercadopago--claude--marketplace.vercel.app-3483fa?style=for-the-badge&logoColor=white)](https://mercadopago-claude-marketplace.vercel.app/)

> **13 skills** · **1 agent** · **3 commands** · **1 hook** — all browsable in a visual catalog.
>
> Search, filter, and explore every component with detailed metadata and direct links to source code.

</div>

---

## Overview

A Claude Code plugin that gives you an AI-powered integration assistant for the full Mercado Pago product suite. Ask questions, scaffold projects, review code, and get real-time API guidance — all from your terminal.

- **13 product skills** covering the complete Mercado Pago ecosystem
- **7 countries** supported: Argentina, Brazil, Mexico, Chile, Colombia, Peru, Uruguay
- **Hybrid architecture** — skills provide stable integration intelligence, MCP provides live API data
- **Credential leak prevention** — hook scans every file write for hardcoded tokens
- **Secure token storage** — Access Tokens stored in OS keychain (macOS Keychain / Linux secret-tool)
- **3 slash commands** — `/mp-setup`, `/mp-review`, `/mp-connect`

## Installation

### 1. Add the marketplace

```bash
/plugin marketplace add https://github.com/mercadopago/mercadopago-claude-marketplace.git
```

### 2. Install the plugin

```bash
/plugin install mercadopago@mercadopago-claude-marketplace
```

### 3. Connect your account

Run the setup script from your **terminal** (not inside Claude Code):

```bash
bash ~/.claude/plugins/cache/mercadopago-claude-marketplace/mercadopago/*/scripts/setup.sh
```

This stores your Access Token in the OS keychain. Claude Code cannot read the keychain directly — only the MCP server process accesses it at startup.

Get your Access Token at: https://www.mercadopago.com.ar/developers/panel/app

Then restart Claude Code.

## Product Coverage

| Skill | Products Covered |
|-------|-----------------|
| `mp-checkout-online` | Checkout Pro, Payments API, 3DS, Cross-Border Payments |
| `mp-checkout-bricks` | Payment Brick, Card Payment Brick, Wallet Brick, Status Screen Brick |
| `mp-notifications` | Webhooks (v2), IPN (legacy), HMAC validation |
| `mp-instore` | QR Attended, QR Dynamic, Point devices, Kiosk |
| `mp-orders` | Orders, OU + QR |
| `mp-subscriptions` | Subscription Plans, Preapprovals, Invoices |
| `mp-wallet` | Wallet Connect, Debt Payments, Massive Payment Links |
| `mp-money-out` | Disbursements, Bank Transfers |
| `mp-marketplace` | Marketplace Splits, Seller Onboarding, VTEX, Application Fees |
| `mp-security` | 3D Secure, PCI, Supertoken, Vault, Card Tokenization |
| `mp-specialized` | Insurance (AR), Yape (PE), Fintoc (CL) |
| `mp-reporting` | Settlement Reports, Reconciliation, Account Statements |
| `mp-sdks` | SDK Selection, Setup, Migration (Node, Python, Java, PHP, Ruby, .NET, Go, React, iOS, Android) |

## Commands

| Command | Purpose |
|---------|---------|
| `/mp-connect` | Securely connect to your Mercado Pago account |
| `/mp-review [scope]` | Review an integration for correctness, security, and best practices |
| `/mp-setup [lang] [product]` | Scaffold a new Mercado Pago integration for any product |

## Architecture

```
User question
     |
     v
+--------------------+
| mp-integration-    |     1. Detect country (from project signals or ask)
| expert (agent)     | --> 2. Detect product (from signal-to-skill routing)
+--------------------+     3. Load ONE relevant skill
     |          |
     v          v
+---------+  +-----+
| Skill   |  | MCP |      Skill = stable flows, decision trees, gotchas
| (1 of   |  |     |      MCP  = live endpoints, payloads, code snippets
|  12)    |  |     |
+---------+  +-----+
     |          |
     v          v
+--------------------+
|   Combined answer  |
+--------------------+
```

**Skills** contain integration intelligence that rarely changes: product flows, decision trees, prerequisites, country availability, and common gotchas. **MCP** provides dynamic data that must always be current: endpoint URLs, request/response schemas, SDK code snippets, and test credentials.

Only one skill is loaded per interaction, keeping context lightweight.

## Infrastructure

| Component | Name | Purpose |
|-----------|------|---------|
| Agent | `mp-integration-expert` | Single router — detects country and product, loads the right skill |
| Hook | `validate_mp_credentials` | Credential scanner — blocks hardcoded MP tokens from reaching source files |
| MCP | `mercadopago` | Live Mercado Pago API access (token from OS keychain) |
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
