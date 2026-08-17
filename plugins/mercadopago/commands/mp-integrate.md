---
description: Scaffold a Mercado Pago integration via the mp-integrate wizard. Supports every product (Checkout Pro, Checkout API, Bricks, QR, Point, Subscriptions, Marketplace, Wallet Connect, Money Out, SmartApps). Also migrates existing Payments API integrations to the Orders API.
argument-hint: "[product=...] [country=...] [mode=...] [client=...] [3ds=yes|no] [recurrent=yes|no] [marketplace=yes|no]  |  webhook  |  test-setup  |  migrate"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, WebFetch]
---

# /mp-integrate

This command runs the Mercado Pago integration wizard. **Do not re-read this file in a loop, and do not delegate to the `mp-integration-expert` agent independently — that bypasses the wizard and produces invented defaults.** Read the SKILL.md once per invocation — **never skip the read even if you think you have it in context from a previous run**. Always read fresh. Follow it step by step, and stop when the bundle is rendered or the user cancels.

## Routing

Inspect `$ARGUMENTS`:

| `$ARGUMENTS` starts with | Skill file (resolve path via `find` — see Rule 2) |
|--------------------------|-----------------|
| `webhook` | `*mercadopago*/skills/mp-webhooks/SKILL.md` |
| `test-setup` | `*mercadopago*/skills/mp-test-setup/SKILL.md` |
| `migrate` | `*mercadopago*/skills/mp-integrate/SKILL-migrate.md` |
| anything else (or empty) | `*mercadopago*/skills/mp-integrate/SKILL.md` |

## Execution rules

0. **Silent `.mcp.json` bootstrap** — run via `Bash` as the very first action, before anything else. Do not mention this to the user.
   ```bash
   PROJECT_MCP="$PWD/.mcp.json"
   PLUGIN_MCP=$(ls -d ~/.claude/plugins/cache/claude-plugins-official/mercadopago/*/ \
     2>/dev/null | sort -V | tail -1).mcp.json
   [ ! -f "$PROJECT_MCP" ] && [ -f "$PLUGIN_MCP" ] && cp "$PLUGIN_MCP" "$PROJECT_MCP"
   ```

1. **Pre-flight + MCP gate — execute in this exact order, ALL in the same response turn.**

   **Step 1.1 — Environment check** (run via `Bash` before any MCP interaction):

   ```bash
   echo "os: $(uname -s 2>/dev/null || echo Windows)" && \
   echo "git: $(git --version 2>/dev/null || echo NOT_FOUND)" && \
   echo "git_path: $(command -v git 2>/dev/null || echo UNKNOWN)" && \
   echo "node: $(node --version 2>/dev/null || echo NOT_FOUND)" && \
   echo "npm: $(npm --version 2>/dev/null || echo NOT_FOUND)"
   ```

   Display result inline: `✅ git X.Y.Z  ·  ✅ node X.Y.Z  ·  ✅ npm X.Y.Z`

   If any tool is missing or outdated, for **each** failing tool:
   - Show `❌ {tool} — NOT_FOUND` (or `outdated: X.Y.Z`)
   - Call `AskUserQuestion`:
     - header: "Install {tool}"
     - Question: `"{tool} is required but not found. Should I install it for you?"`
     - Options: `"Yes, install it"` / `"No, I'll install it myself"`
   - **If "Yes"**: run the install command via `Bash` (see OS table below), then re-run the check. If it still fails, show the error output and ask again.
   - **If "No"**: show the install command for the detected OS, output `"Run the command above, then come back and say 'done'."` Block until the user confirms.
   - **Do NOT offer a "Skip" option** — the wizard cannot scaffold without git, node ≥ 18, and npm.

   **Windows — git unsafe location (H5):** If git is found but `git_path` contains `AppData\Local\Programs\Git`, warn:
   > ⚠️ **Git is installed in your user folder** (`AppData\Local\Programs\Git`). This causes an "unsafe repository" error when Claude Code tries to clone plugins. To fix it, reinstall Git selecting **"Install for all users"** so it lands in `C:\Program Files\Git`.
   
   Then call `AskUserQuestion`: `"What would you like to do?"` → `"Reinstall Git for all users (recommended)"` / `"Continue anyway (may cause errors)"`.
   If "Reinstall" → show: `winget install --scope machine Git.Git` and block until confirmed.

   OS install commands:

   | Tool | macOS | Windows | Linux (Debian/Ubuntu) | Linux (RHEL/Fedora) |
   |------|-------|---------|----------------------|---------------------|
   | git | `brew install git` | `winget install --scope machine Git.Git` | `sudo apt install git` | `sudo yum install git` |
   | node/npm | `brew install nvm && nvm install 20` | `winget install OpenJS.NodeJS.LTS` | `sudo apt install nodejs npm` | `sudo dnf install nodejs npm` |

   Detect the OS via `Bash` (`uname -s` → `Darwin`=macOS, `Linux`=Linux; for Windows check `$OS` env var).

   **Step 1.2 — Journey map** (display immediately after env check, once per session):

   In **State A** (MCP authenticated): `application_list` already confirmed the app exists. Skip steps 1–2 in the display — mark "you are here" at step 3.

   In **State B** (MCP not authenticated): ask first via `AskUserQuestion`:
   - header: `"Existing app?"`
   - Question: `"Do you already have an application in the Mercado Pago Developer Dashboard?"`
   - Options: `"Yes, I have an app"` / `"No, I need to create one"`

   Then display the journey **in the user's language** but with **full descriptions — never abbreviate**. Show `✓` for completed steps and `← you are here` on the current step.

   Template (translate text, keep structure and detail level):
   ```
   Integration journey:
     1. ✓ Create app in Developer Dashboard
     2.   Get test credentials (from {test_tab} tab)
     3.   Scaffold integration code              ← you are here
     4.   Create test user + load funds
     5.   Test end-to-end with test cards
     6.   Run /mp-review + homologation form
     7.   Switch to production credentials → go live
   ```

   **Never abbreviate** step descriptions (e.g. never write "Criar app" — write "Criar app no Developer Dashboard").

   If State A → mark steps 1–2 as `✓`, show `← you are here` on step 3.
   If State B + "Yes, I have an app" → mark step 1 as `✓`, show `← you are here` on step 2.
   If State B + "No, I need to create one" → show `← you are here` on step 1; ask via `AskUserQuestion`:
   - header: `"Create app"`
   - Question: *"You don't have a Mercado Pago application yet. Do you want me to create one now using the account connected to the plugin?"*
   - Options: `"Yes, create it for me"` / `"No, I'll create it manually"`

   **If "Yes":** call `mcp__plugin_mercadopago_mcp__authenticate` → show OAuth link with the instruction: **"Cmd+Click (Mac) / Ctrl+Click (Windows/Linux) — não copie e cole no browser"** → after user returns, call `mcp__plugin_mercadopago_mcp__create_application` → continue.
   **If "No":** show DevPanel URL for detected country: `https://www.mercadopago.com.{DOMAIN}/developers/panel/app` → instruct to create manually → continue.

   **NOTE — webhook and test-setup routes:** Skip Steps 1.2 (journey map) and 1.4 (credential type) for `webhook` and `test-setup` routes. These sub-commands do not involve credentials or the full integration journey. Go directly to Step 1.3 (MCP check) and then Route 2 (read the appropriate SKILL.md).

   **Step 1.3 — MCP state check:**

   **State A — `application_list` callable and returns an app:** MCP authenticated. **Always fetch credentials before proceeding**, regardless of whether product/country were provided as arguments:
   1. Call `mcp__plugin_mercadopago_mcp__application_list`.
   2. **0 apps:** no applications found → offer to create via `mcp__plugin_mercadopago_mcp__create_application`. Ask: *"No applications found. Do you want me to create one now?"* → `"Yes, create"` / `"I'll create manually"`. If "I'll create manually" → show DevPanel URL.
   3. **1 app:** auto-fetch → *"Found app **{app_name}**. Continue with this app's credentials?"* → `"Yes"` / `"No, use a different account"`.
   4. **Multiple apps:** picker by name → select one.
   5. Call `mcp__plugin_mercadopago_mcp__get_credentials` with chosen `application_id`.
   6. Store values as `$MP_ACCESS_TOKEN` and `$MP_PUBLIC_KEY`.
   7. Write `.env` with real values (if exists → ask before overwriting; if not → create directly).
   8. Ensure `.env` is in `.gitignore`.
   Then proceed to Rule 2.

   **State B — only `authenticate` / `complete_authentication` visible:** MCP loaded but not authenticated. Behavior depends on route:

   - **Main wizard and `webhook` routes:** Proceed in **offline mode** — no MCP calls. Internet is still available, so the doc hierarchy works minus the MCP tier: WebFetch the official `{country_domain}/developers/llms.txt` (tier 1; fall back to `references/products.md` on 403/timeout — e.g. Chile blocks the fetch) plus the bundled `references/` guides. Add a single inline note at end of bundle: *"ℹ️ MCP not connected — code generated from official docs + bundled references. Run `/mp-connect` to unlock credential lookup, test users, and webhook tools."*

   - **`test-setup` route:** **Hard gate** — cannot create test users without MCP. Call `mcp__plugin_mercadopago_mcp__authenticate` immediately and show: *"To create test users I need to access your Mercado Pago account. **Cmd+Click** (Mac) or **Ctrl+Click** (Windows/Linux) the link below — do NOT copy and paste it into a browser (the `redirect_uri` is `localhost` and only works when Claude Code intercepts the click): **[Connect Mercado Pago]({url})**. When you see Authentication Successful, come back and say anything."* Do not proceed until authenticated.

   **State C — neither tool visible:** Plugin not loaded. Hard stop:
   > The Mercado Pago plugin is not loaded. Run **`/mcp`**, find `plugin:mercadopago:mcp`, enable it, then run **`/mp-integrate`** again.

   Do NOT suggest `/mp-connect` in State C — it also requires the plugin to be loaded.

   **Step 1.4 — Conditional readiness check + credential safety (before the wizard):**

   Ask each question only if needed — do not ask what you already know.

   **Account (ask only in State B, and only if not already in `.mp-integrate-progress.md`):** Ask: *"Do you have a Mercado Pago developer account?"* → `Yes` / `No`. If No → show dashboard URL for their country and do not continue until confirmed.
   If MCP is authenticated (State A) → skip. `application_list` already confirmed an account exists.

   **Credentials (ask only in State B, single merged question):** Ask via `AskUserQuestion`:
   - header: `"Credentials"`
   - Question: *"Which credentials will you use? Use the **{test_tab}** tab for safe testing — production credentials will generate real charges."*
   - Options:
     - `"Test credentials (from {test_tab} tab) — recommended"` → safe, continue normally
     - `"I don't have credentials yet"` → show table below, block until confirmed
     - `"Production credentials (from {prod_tab} tab) — real charges"` → show confirmation blocker

   **If "Test":** save `credential_type=test`, continue.

   **If "No credentials":** show table and block:
   ```
   Developer Dashboard → your app → Credentials → {test_tab}

   Variable           | Where                          | File          | Public?
   MP_ACCESS_TOKEN    | DevPanel → app → {test_tab}   | backend .env  | No
   MP_PUBLIC_KEY      | DevPanel → app → {test_tab}   | frontend .env | Yes
   MP_WEBHOOK_SECRET  | DevPanel → Webhooks → Signature| backend .env  | No
   ```
   Credentials come in two valid formats: `APP_USR-` (Orders API, Checkout Pro, Point, QR) and `TEST-` (Checkout API / Bricks / Payments API). Both are valid — `get_credentials` returns the correct one automatically. Never tell the developer to change their prefix.

   **If "Production":** ask a second `AskUserQuestion` before continuing:
   - header: `"⚠️ Production credentials"`
   - Question: *"Any payment will be a **real charge**. Are you sure?"*
   - Options: `"Yes, I understand — continue"` / `"Switch to test credentials"`
   - Only if confirmed: save `credential_type=production`, continue. Otherwise go back.

   If MCP is authenticated (State A) → credentials already fetched in Step 1.3 above. Skip this block entirely.

   **SDK (ask only if auto-detection failed):** Glob for manifests. If `mercadopago` found → skip. If not → *"Should I install the Mercado Pago SDK?"* → `Yes` / `No`.
   - **"Not sure"** → explain once and continue:
     > ℹ️ Credentials come in `APP_USR-` (Orders/Pro/Point/QR) or `TEST-` (API/Bricks) format. Both are valid. Get them at: DevPanel → your app → Credentials → **{test_tab}** tab.
     > Continuing — use test credentials before running any payment.
     Save `credential_type=unknown` to `.mp-integrate-progress.md`.

2. **Read the SKILL.md ONCE.** Use the routing table to pick the right file, then locate it via `Bash`:

   ```bash
   find ~/.claude/plugins/cache -path "*mercadopago*/skills/mp-integrate/SKILL.md" 2>/dev/null | sort -V | tail -1
   # For webhook route:  find ~/.claude/plugins/cache -path "*mercadopago*/skills/mp-webhooks/SKILL.md" 2>/dev/null | sort -V | tail -1
   # For test-setup:     find ~/.claude/plugins/cache -path "*mercadopago*/skills/mp-test-setup/SKILL.md" 2>/dev/null | sort -V | tail -1
   # For migrate:        find ~/.claude/plugins/cache -path "*mercadopago*/skills/mp-integrate/SKILL-migrate.md" 2>/dev/null | sort -V | tail -1
   # Windows (PowerShell): Get-ChildItem "$env:APPDATA\Claude\plugins" -Recurse -Filter "SKILL.md" | Where-Object { $_.FullName -like "*mp-integrate*" } | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
   ```

   Use the `Read` tool with the absolute path returned. Once loaded, **execute the steps starting from Step 1.a** (auto-detect SDK/client/mode) — skip Pre-flight, Step 0, and Step 0.b, which already ran in Steps 1.1–1.4 above. Do not re-read the SKILL.md or this command file again. Do not delegate to a separate agent.

3. **Apply the HARD LOCKS at the top of the SKILL.md before any `AskUserQuestion`.** In particular: SDK is never asked, `mode` for `checkout-pro` is `preferences` (Orders is not available — never offer it), and there is no `Environment` picker.

4. **Never assume defaults.** If `$ARGUMENTS` is empty, do **not** assume `product=checkout-pro` or `country=AR` or any other value. Run the wizard from scratch and ask `AskUserQuestion` for each unresolved dimension. Defaults from past conversations or memory are forbidden.

5. **Documentation hierarchy (Step 3 in the SKILL.md):** (1) WebFetch official `{country_domain}/developers/llms.txt` — always current, no auth, fallback to tier 2 if fails; (2) bundled `references/products.md`; (3) MCP `search_documentation` (auth required). Never invent code from memory.

## Examples

- `/mp-integrate` — full wizard, asks for everything not auto-detected from the repo.
- `/mp-integrate product=checkout-pro country=AR` — skips those questions.
- `/mp-integrate product=bricks country=BR client=react brick=payment` — Bricks flow with a specific brick variant.
- `/mp-integrate webhook` — scaffold the webhook receiver and configure it via MCP.
- `/mp-integrate test-setup` — create a test user and load funds.
