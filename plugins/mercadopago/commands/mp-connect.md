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

> **Note**: Mercado Pago also supports seller OAuth for marketplace payment flows. This command authenticates Claude Code with the Mercado Pago MCP server; it does not configure the seller OAuth flow used by an application. For marketplace integrations, use `/mp-integrate product=marketplace`.

## Step 1 — Check status

The plugin bundles its MCP configuration and Claude Code registers it automatically. Never copy the plugin's `.mcp.json` into the developer's project and never search an installation cache manually.

`ListMcpResourcesTool` always returns "No resources found" for this MCP and is **not** a reliable check. The bootstrap tools `authenticate` / `complete_authentication` always exist and prove nothing.

Verify by attempting to call `mcp__plugin_mercadopago_mcp__application_list`:

- The tool is callable AND returns a real application payload (with `site_id`, etc.) → tell the user: "✓ Connected and ready." and **stop**.
- The tool is not in your capabilities, or it returns an auth error → **do NOT ask the user to run `/mcp`**. Continue to Step 2.

---

## Step 2 — Start OAuth directly

Call `mcp__plugin_mercadopago_mcp__authenticate`. Show the returned URL as a clickable link and render the following message in the developer's language — always, every time:

> 🔗 **[Connect Mercado Pago]({authorization_url})**
>
> ⚠️ **Cmd+Click** the link above (Mac) or **Ctrl+Click** (Windows/Linux). **Do not copy and paste** the URL into an external browser. Its localhost redirect works only when Claude Code intercepts the click.
>
> When you see **"Authentication Successful"**, return here and let me know.

When the user responds:
- **Call `application_list` directly.** If the browser showed "Authentication Successful", the local MCP server already processed the callback and the token is live.
- **Do NOT call `complete_authentication` first** — it will hang trying to reach a socket that was already closed.
- Only if `application_list` fails AND the browser showed an error (not "Authentication Successful") → call `complete_authentication`. ⚠️ **Do not ask the user to paste the callback URL** — it contains a sensitive OAuth code. Ask them to re-run the flow (`/mp-connect`) instead.

**`not-found`** → the plugin is not loaded. Tell the user to run `/reload-plugins` and then `/mp-connect` again.

---

## Step 3 — Verify

Attempt to call `mcp__plugin_mercadopago_mcp__application_list` again.

- Returns a real payload → "✓ Connected and ready."
- Still no tools → "Not connected. Try restarting Claude Code and running `/mp-connect` again."

---

## Other IDEs

Add the server manually via your IDE's MCP settings with URL `https://mcp.mercadopago.com/mcp` (HTTP transport), then follow the authentication prompt your IDE shows.

- **Cursor** → `~/.cursor/mcp.json` → `"mercadopago": { "type": "http", "url": "https://mcp.mercadopago.com/mcp" }`
- **VS Code** → `settings.json` → `"mcp.servers": { "mercadopago": { "type": "http", "url": "https://mcp.mercadopago.com/mcp" } }`
- **Windsurf** → Settings → MCP Servers → add HTTP server with that URL.

---

## Windows: plugin not loading

If you're on Windows and the plugin commands (e.g. `/mp-test-cards`, `/mp-integrate`) are not recognized, the plugin may be installed but not loaded by Claude Code.

**Diagnose:**
```powershell
claude --debug
```

**Fix — option 1 (preferred): reinstall via CLI**
```text
/plugin uninstall mercadopago@mercadopago-claude-marketplace
/plugin install mercadopago@mercadopago-claude-marketplace
```
Then restart Claude Code.

**Fix — option 2: verify plugin registration**

Claude Code on Windows reads the plugin registry from `%APPDATA%\Claude\plugins\`. If the `plugin.json` is present but the plugin still isn't recognized, check that the directory name matches exactly (`mercadopago`, not `mercadopago-1` or similar):
```powershell
Get-ChildItem "$env:APPDATA\Claude\plugins\cache" -Recurse -Filter "plugin.json" | Select-Object FullName
```

---

## Local development install

When developing from a local checkout, load the plugin directory through Claude Code's local plugin workflow. The MCP configuration remains bundled at the plugin root; do not copy it into the target project. After changing or enabling the plugin, run `/reload-plugins` before retrying `/mp-connect`.

---

## Migrating from v1 (keychain)

```bash
# macOS
security delete-generic-password -a "access_token" -s "mercadopago-claude-plugin"
# Linux
secret-tool clear service "mercadopago-claude-plugin" account "access_token"
```
