# mercadopago-claude-marketplace

Public marketplace of Claude Code plugins for Mercado Pago payment integration development.

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [mp-developer](./plugins/mp-developer/) | 2.0.0 | Mercado Pago full-product integration toolkit — 11 product skills, expert routing agent, credential leak prevention, and live API docs via MCP |

## Installation

### Add the marketplace

```bash
/plugin marketplace add https://github.com/mercadopago/mercadopago-claude-marketplace.git
```

### Install a plugin

```bash
/plugin install mp-developer@mercadopago-claude-marketplace
```

## Setup — Connect Your Account

After installing, run the setup script from your **terminal** (not inside Claude Code):

```bash
bash ~/.claude/plugins/cache/mercadopago-claude-marketplace/mp-developer/*/scripts/setup.sh
```

This stores your Access Token in the **OS keychain** (macOS Keychain / Linux secret-tool). Claude Code cannot read the keychain — only the MCP server process accesses it at startup.

Get your Access Token at: https://www.mercadopago.com.ar/developers/panel/app

Then restart Claude Code.

## What's Included

The `mp-developer` plugin covers the full Mercado Pago product suite:

### Agent

| Component | Name | Purpose |
|-----------|------|---------|
| Agent | `mp-integration-expert` | Routes to the correct product skill based on project signals. Detects country and product automatically. |

### Commands

| Command | Purpose |
|---------|---------|
| `/mp-connect` | Securely connect to your Mercado Pago account |
| `/mp-review [scope]` | Review an integration for correctness, security, and best practices |
| `/mp-setup [lang] [product]` | Scaffold a new MP integration for any product |

### Skills (11 product skills — hybrid architecture)

| Skill | Products Covered |
|-------|-----------------|
| `mp-checkout-online` | Checkout Pro, Checkout Bricks, Payments API, 3DS, Cross-Border Payments |
| `mp-notifications` | Webhooks (v2), IPN (legacy), HMAC validation |
| `mp-instore` | QR Attended, QR Dynamic, Point devices, Kiosk |
| `mp-unified-orders` | Unified Orders, OU + QR |
| `mp-subscriptions` | Subscription Plans, Preapprovals, Invoices |
| `mp-wallet` | Wallet Connect, Debt Payments, Massive Payment Links |
| `mp-money-out` | Disbursements, Bank Transfers |
| `mp-marketplace` | Marketplace Splits, Seller Onboarding, VTEX, Application Fees |
| `mp-security` | 3D Secure, PCI, Supertoken, Vault, Card Tokenization |
| `mp-specialized` | Insurance (AR), Yape (PE), Fintoc (CL) |
| `mp-reporting` | Settlement Reports, Reconciliation, Account Statements |

### Infrastructure

| Component | Purpose |
|-----------|---------|
| Hook | Credential scanner — prevents hardcoded MP tokens from being written to source files |
| MCP | Live Mercado Pago API access via MCP server (token from OS keychain) |
| Setting | Per-project config via `.claude/mp-developer.local.md` |

## Hybrid Architecture

Skills contain **stable integration intelligence** (flows, decision trees, gotchas) that rarely changes. The MCP server provides **dynamic data** (endpoints, payloads, code snippets) that's always current. This keeps context lightweight while ensuring up-to-date information.

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js 18+ (for the MCP server)
- Python 3.8+ (for the credential scanning hook)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new plugins or improving existing ones.

## License

[MIT](./LICENSE)
