# mercadopago-claude-marketplace

Public marketplace of Claude Code plugins for Mercado Pago payment integration development.

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [mp-developer](./plugins/mp-developer/) | 1.0.0 | Mercado Pago payment integration toolkit — expert agent, checkout & notification skills, credential leak prevention hook, and live API docs |

## Installation

### Add the marketplace

```bash
/plugin marketplace add https://github.com/mercadopago/mercadopago-claude-marketplace.git
```

### Install a plugin

```bash
/plugin install mp-developer@mercadopago-claude-marketplace
```

## What's Included

The `mp-developer` plugin provides 5 component types:

| Component | Name | Purpose |
|-----------|------|---------|
| **Agent** | `mp-integration-expert` | Specialized agent for implementing, reviewing, and debugging MP integrations |
| **Command** | `/mp-review` | Review an existing integration for correctness, security, and best practices |
| **Command** | `/mp-setup` | Scaffold a new MP integration (SDK install, `.env.example`, checkout + webhook skeleton) |
| **Skill** | `mp-checkout` | Checkout Pro, Checkout Bricks, and Payments API code patterns |
| **Skill** | `mp-notifications` | Webhook/IPN handling, HMAC signature validation, idempotency |
| **Hook** | Credential scanner | Prevents hardcoded MP tokens/secrets from being written to source files |
| **MCP** | `mp-docs` | Live access to official Mercado Pago developer documentation |
| **Setting** | Per-project config | Optional `.claude/mp-developer.local.md` to customize hook behavior |

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js 18+ (for the `mp-docs` MCP server)
- Python 3.8+ (for the credential scanning hook)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new plugins or improving existing ones.

## License

[MIT](./LICENSE)
