# mp-developer

Mercado Pago full-product integration toolkit for Claude Code. Hybrid architecture: 11 product skills provide stable integration intelligence (flows, decision trees, gotchas), while the MCP server provides live API data (endpoints, payloads, code snippets).

## Quick Start

After installing the plugin, connect it to your Mercado Pago account:

```bash
# Run from your terminal (not inside Claude Code)
bash ~/.claude/plugins/cache/mercadopago-claude-marketplace/mp-developer/*/scripts/setup.sh
```

The setup script will:
1. Ask for your Access Token (hidden input)
2. Store it in your **OS keychain** (macOS Keychain / Linux secret-tool)
3. Test the connection

Then restart Claude Code. The MCP server will read the token from the keychain at startup.

> Your Access Token is never stored in any file. Claude Code cannot read the OS keychain — only the MCP server process accesses it.

Get your Access Token at: https://www.mercadopago.com.ar/developers/panel/app

## Products Covered

| Product | Skill | Description |
|---------|-------|-------------|
| Checkout Pro | `mp-checkout-online` | Redirect-based payment with preferences |
| Checkout Bricks | `mp-checkout-online` | Embeddable UI components (Payment Brick, Card Brick, etc.) |
| Payments API | `mp-checkout-online` | Direct server-to-server payment with card tokenization |
| 3D Secure | `mp-checkout-online` | Additional cardholder authentication |
| Cross-Border Payments | `mp-checkout-online` | Accept payments from other countries |
| Webhooks | `mp-notifications` | HMAC-signed webhook handling, IPN |
| QR Attended / Dynamic | `mp-instore` | In-store QR code payments |
| Point | `mp-instore` | Physical card reader devices |
| Unified Orders | `mp-unified-orders` | Multi-payment orders, OU + QR |
| Subscriptions | `mp-subscriptions` | Recurring billing, plans, preapprovals |
| Wallet Connect | `mp-wallet` | Link user wallets, debt payments, massive links |
| Money Out | `mp-money-out` | Disbursements, bank transfers |
| Marketplace | `mp-marketplace` | Multi-seller platforms, splits, OAuth |
| Security | `mp-security` | Tokenization, Supertoken, Vault, PCI |
| Specialized | `mp-specialized` | Insurance, Yape (PE), Fintoc (CL) |
| Reporting | `mp-reporting` | Settlement reports, reconciliation |

## Architecture

```
Skills contain (STABLE — rarely changes):
├── What products are covered
├── When to use this skill vs another
├── End-to-end integration flows (step by step)
├── Decision trees between variants
├── Prerequisites and configuration
├── Country availability
├── Non-obvious gotchas and common errors
├── Product-specific security checklist
└── Instructions on WHAT to fetch from MCP and WHERE in docs

MCP provides (DYNAMIC — always up to date):
├── Exact endpoints and URLs
├── Request/response payloads and schemas
├── Code snippets per SDK/language
├── Test data
└── Error codes and messages
```

## Agent: `mp-integration-expert`

A lightweight router that detects the target country and product, then delegates to the right skill + MCP. Covers all 7 countries: Argentina, Brazil, Mexico, Chile, Colombia, Peru, Uruguay.

## Commands

| Command | Description |
|---------|-------------|
| `/mp-connect` | Connect to your Mercado Pago account — runs the secure token setup |
| `/mp-review [scope]` | Review your MP integration. Scopes: `security`, `webhooks`, `checkout`, `qr`, `subscriptions`, `marketplace`, `errors`, `full` |
| `/mp-setup [lang] [product]` | Scaffold a new integration. Products: `checkout-pro`, `bricks`, `payments-api`, `qr`, `point`, `subscriptions`, `marketplace` |

## Hook: Credential Leak Prevention

Automatically scans code being written for hardcoded Mercado Pago credentials:
- Access tokens (`TEST-*`, `APP_USR-*`)
- Client secrets
- Bearer authorization headers
- Webhook signing secrets

Blocks the write and suggests using environment variables instead. Skips `.env` files where credentials belong.

## MCP: Mercado Pago API

Connects Claude Code to the official Mercado Pago MCP server (`mcp.mercadopago.com`), providing live access to payment APIs, documentation, and developer tools. Requires an Access Token — run `/mp-connect` or the setup script to configure.

## Configuration

See [PLUGIN_SETTINGS.md](./PLUGIN_SETTINGS.md) for per-project configuration options (e.g., disabling the credential hook).

## Resources

- [Mercado Pago Developer Docs](https://www.mercadopago.com.ar/developers/en/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [SDKs](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/landing)
- [Credentials Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
