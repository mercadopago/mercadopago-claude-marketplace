---
description: Connect Claude Code to your Mercado Pago account by configuring the MCP server with your Access Token
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Bash]
---

# /mp-connect

Connect Claude Code to the Mercado Pago API by storing your Access Token securely.

## Instructions

The Mercado Pago MCP server requires an Access Token to authenticate API requests. The token is stored in your OS keychain — Claude Code cannot read it directly; only the MCP server process accesses it at startup.

### Pre-check: Is MCP already connected?

Before running setup, check if the Mercado Pago MCP server is already connected:

1. Try `ListMcpResourcesTool` with `server: "mercadopago"`, or check if any `mcp__mercadopago__*` tools are available
2. If MCP is already connected → inform the user: "The Mercado Pago MCP server is already connected. You're all set! If you want to reconfigure (e.g., change the Access Token), say so and I'll proceed."
3. Only continue with setup if the user explicitly wants to reconfigure

### Run the setup script

Execute this command to start the interactive setup:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh
```

The script will:
1. Ask for your Mercado Pago Access Token (input is hidden)
2. Validate the token format
3. Store it in your OS keychain (macOS Keychain / Linux secret-tool)
4. Test the connection to the MCP server

### After setup

Tell the user to **restart Claude Code** for the MCP server to pick up the new token.

### Post-restart verification

After the user restarts Claude Code, verify the MCP connection using MCP tools — NOT REST APIs:

1. Try `ListMcpResourcesTool` with `server: "mercadopago"`, or check if `mcp__mercadopago__*` tools are now available
2. If tools are available → report: "Mercado Pago MCP server is connected and ready."
3. If tools are NOT available → report: "The MCP server doesn't appear to be connected yet. Try restarting Claude Code again, or run `/mp-connect` to re-run the setup."

**Do NOT validate by calling REST APIs** (like `curl` to `/v1/payment_methods` or any Mercado Pago endpoint). The goal is to verify the MCP connection, not the API credentials.

### Other operations

Check if a token is stored:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh --status
```

Remove stored token:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh --remove
```

### Getting an Access Token

Direct the user to: https://www.mercadopago.com.ar/developers/panel/app

Steps:
1. Log in to the Mercado Pago Developer Dashboard
2. Select your application (or create one)
3. Go to "Credentials" in the sidebar
4. Copy the **Access Token** (starts with `APP_USR-`). For testing, use the credentials of a **test user** created from the Dashboard or via the MCP tool `create_test_user` — test user credentials also use the `APP_USR-` prefix

### Security rules

- The MCP Access Token MUST only be stored in the OS keychain via `setup.sh` — NEVER in `.env` files
- NEVER read `.env` files to look for MCP tokens
- NEVER suggest editing `.env` to configure the MCP connection
- If the user asks to store the token in `.env`, explain that the OS keychain is more secure and redirect them to run `/mp-connect`
