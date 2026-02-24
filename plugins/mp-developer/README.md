# mp-developer

Mercado Pago payment integration toolkit for Claude Code. Provides an expert agent, checkout and notification skills, credential leak prevention, and live API documentation access.

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

## Components

### Agent: `mp-integration-expert`

A specialized agent for implementing, reviewing, and debugging Mercado Pago integrations. Covers Checkout Pro, Checkout Bricks, Payments API, webhooks, and OAuth flows.

### Commands

| Command | Description |
|---------|-------------|
| `/mp-connect` | Connect to your Mercado Pago account — runs the secure token setup |
| `/mp-review [area]` | Review your MP integration for correctness, security, and best practices. Optional focus: `security`, `webhooks`, `checkout`, `errors` |
| `/mp-setup [lang] [type]` | Scaffold a new MP integration. Language: `node`, `python`, `java`. Type: `checkout-pro`, `bricks`, `payments-api` |

### Skills

| Skill | Description |
|-------|-------------|
| `mp-checkout` | Checkout Pro, Checkout Bricks, and Payments API patterns with working code templates |
| `mp-notifications` | Webhook and IPN notification handling, HMAC-SHA256 signature validation, idempotency |

### Hook: Credential Leak Prevention

Automatically scans code being written for hardcoded Mercado Pago credentials:
- Access tokens (`TEST-*`, `APP_USR-*`)
- Client secrets
- Bearer authorization headers
- Webhook signing secrets

Blocks the write and suggests using environment variables instead. Skips `.env` files where credentials belong.

### MCP: Mercado Pago API

Connects Claude Code to the official Mercado Pago MCP server (`mcp.mercadopago.com`), providing live access to the Payments API, preference management, and developer documentation. Requires an Access Token — run `/mp-connect` or the setup script to configure.

## Configuration

See [PLUGIN_SETTINGS.md](./PLUGIN_SETTINGS.md) for per-project configuration options (e.g., disabling the credential hook).

## Resources

- [Mercado Pago Developer Docs](https://www.mercadopago.com.ar/developers/en/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [SDKs](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/landing)
- [Credentials Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
