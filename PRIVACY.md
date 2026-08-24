# Privacy and Data Flow

This document explains the data boundaries of the Mercado Pago plugin for
Claude Code. It does not replace the privacy terms of Anthropic or Mercado Pago.

## Local, offline-capable operations

Static scaffolding, bundled references, test-card lookup, source inspection,
deterministic validators, and the local credential hook do not require a Mercado
Pago MCP connection. They operate in the developer's Claude Code session and
project workspace.

The credential hook receives Claude tool metadata and proposed tool input so it
can block likely credential leaks. The hook does not implement analytics or send
that input to a repository-owned telemetry service.

## Claude Code and model processing

Prompts, selected project context, and tool results may be processed by Claude
Code and Anthropic according to the user's Claude plan, organization settings,
and Anthropic terms. Users should not paste access tokens, client secrets,
webhook secrets, buyer personal data, or unredacted payment payloads into a
prompt.

## Mercado Pago MCP operations

The plugin connects to `https://mcp.mercadopago.com/mcp` only after the user
selects an MCP-backed operation. OAuth is handled by the MCP/Claude connection;
the plugin repository does not implement its own OAuth callback collector.

Depending on the selected tool, the request may include search terms,
application identifiers, account/test-user context, payment or order IDs,
webhook configuration, and quality/homologation answers. The MCP configuration
also sends:

- `X-Plugin-Version`: the installed plugin version;
- `X-Invocation-Context`: the plugin routing context.

The repository does not add an independent user identifier or analytics SDK.
Data handled by the MCP and Mercado Pago is governed by the applicable Mercado
Pago terms and privacy notices. Data handled by Claude is governed by the
applicable Anthropic terms and organization configuration.

## Credentials generated in applications

- Access tokens, client secrets, webhook secrets, OAuth tokens, and test-user
  passwords belong in server-side environment variables or a secret manager.
- `MP_PUBLIC_KEY` is client-visible and may be returned by a runtime config
  endpoint, but it should still come from controlled application configuration.
- Generated `.env` files, local test profiles, buyer/seller credentials, and test
  artifacts are ignored by this repository and must not be committed.

## Questions and security reports

Use public GitHub issues for non-sensitive questions. Follow [SECURITY.md](./SECURITY.md)
for any vulnerability, credential exposure, or sensitive data-flow concern.
