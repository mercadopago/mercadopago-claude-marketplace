---
description: Connect Claude Code to your Mercado Pago account by configuring the MCP server with your Access Token
allowed-tools: [Bash]
---

# /mp-connect

Connect Claude Code to the Mercado Pago API by storing your Access Token securely.

## Instructions

The Mercado Pago MCP server requires an Access Token to authenticate API requests. The token is stored in your OS keychain — Claude Code cannot read it directly; only the MCP server process accesses it at startup.

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
4. Copy the **Access Token** (starts with `APP_USR-` for production or `TEST-` for sandbox)
