# mp-developer

Mercado Pago payment integration toolkit for Claude Code. Provides an expert agent, checkout and notification skills, credential leak prevention, and live API documentation access.

## Components

### Agent: `mp-integration-expert`

A specialized agent for implementing, reviewing, and debugging Mercado Pago integrations. Covers Checkout Pro, Checkout Bricks, Payments API, webhooks, and OAuth flows.

### Commands

| Command | Description |
|---------|-------------|
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

### MCP: Live Documentation

Provides access to fetch content from the official Mercado Pago developer documentation at runtime.

## Configuration

See [PLUGIN_SETTINGS.md](./PLUGIN_SETTINGS.md) for per-project configuration options (e.g., disabling the credential hook).

## Resources

- [Mercado Pago Developer Docs](https://www.mercadopago.com.ar/developers/en/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [SDKs](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/landing)
- [Credentials Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
