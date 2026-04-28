---
description: Verify or manually trigger Mercado Pago MCP authentication
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Bash]
---

# /mp-connect

The Mercado Pago MCP server is registered automatically when the plugin loads. Authentication is triggered by Claude Code the first time the MCP is used — no manual setup needed.

Use this command only if the connection is broken or you want to verify the status.

---

> **Note**: Mercado Pago also supports OAuth-based authentication for marketplace flows (where sellers authorize access to their accounts). This command configures the primary Access Token for the MCP server. For OAuth-based marketplace integrations, see the `mp-marketplace` skill.

### Pre-check: Is MCP already connected?
## Step 1 — Check status

`ListMcpResourcesTool` always returns "No resources found" for this MCP and is **not** a reliable check. The bootstrap tools `authenticate` / `complete_authentication` always exist and prove nothing.

Verify by attempting to call `mcp__plugin_mercadopago_mercadopago__get_application`:

- The tool is callable AND returns a real application payload (with `site_id`, etc.) → tell the user: "✓ Connected and ready." and **stop**.
- The tool is not in your capabilities, or it returns an auth error → continue to Step 2.

---

## Step 2 — Check why it's not connected

Run:

```bash
claude mcp list 2>/dev/null | grep -i mercado || echo "not-found"
```

**`plugin:mercadopago:mercadopago` listed with "Needs authentication"** → tell the user:

> Run **`/mcp`** in your terminal. Find **`plugin:mercadopago:mercadopago`** in the **Built-in MCPs** section and press **Enter** on it. A browser will open — select your country and click **Authorize**.
>
> Tell me when you're done.

Wait for confirmation, then go to Step 3.

**`not-found`** → the plugin is not loaded. Tell the user to run `/reload-plugins` and then `/mp-connect` again.

---

## Step 3 — Verify

Attempt to call `mcp__plugin_mercadopago_mercadopago__get_application` again.

- Returns a real payload → "✓ Connected and ready."
- Still no tools → "Not connected. Try restarting Claude Code and running `/mp-connect` again."

---

## Other IDEs

Add the server manually via your IDE's MCP settings with URL `https://mcp.mercadopago.com/mcp` (HTTP transport), then follow the authentication prompt your IDE shows.

- **Cursor** → `~/.cursor/mcp.json` → `"mercadopago": { "type": "http", "url": "https://mcp.mercadopago.com/mcp" }`
- **VS Code** → `settings.json` → `"mcp.servers": { "mercadopago": { "type": "http", "url": "https://mcp.mercadopago.com/mcp" } }`
- **Windsurf** → Settings → MCP Servers → add HTTP server with that URL.

---

## Migrating from v1 (keychain)

```bash
# macOS
security delete-generic-password -a "access_token" -s "mercadopago-claude-plugin"
# Linux
secret-tool clear service "mercadopago-claude-plugin" account "access_token"
```
