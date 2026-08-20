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

| `$ARGUMENTS` starts with | Skill file under `${CLAUDE_PLUGIN_ROOT}` |
|--------------------------|-----------------|
| `webhook` | `*mercadopago*/skills/mp-webhooks/SKILL.md` |
| `test-setup` | `*mercadopago*/skills/mp-test-setup/SKILL.md` |
| `migrate` | `*mercadopago*/skills/mp-integrate/SKILL-migrate.md` |
| anything else (or empty) | `*mercadopago*/skills/mp-integrate/SKILL.md` |

## Execution rules

0. **Use the active Claude plugin root** — run this check via `Bash` as the first action:
   ```bash
   if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ] || [ ! -f "${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/SKILL.md" ]; then
     echo "PLUGIN_NOT_FOUND"
     exit 1
   fi
   printf 'CLAUDE_PLUGIN_ROOT=%s\n' "$CLAUDE_PLUGIN_ROOT"
   ```

   Use `${CLAUDE_PLUGIN_ROOT}` for every bundled skill, reference, and script. Never scan a cache, load another marketplace copy, or copy the plugin's `.mcp.json` into the developer's project. If the check fails, instruct the developer to run `/reload-plugins` and retry.

1. **Pre-flight + readiness — execute in this exact order. Do not call MCP just to inspect connection state.**

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

   Unless `.mp-integrate-progress.md` already records the answer, ask first via `AskUserQuestion`:
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

   If "Yes, I have an app" → mark step 1 as `✓`, show `← you are here` on step 2.
   If "No, I need to create one" → show `← you are here` on step 1; ask via `AskUserQuestion`:
   - header: `"Create app"`
   - Question: *"You don't have a Mercado Pago application yet. Do you want me to create one now using the account connected to the plugin?"*
   - Options: `"Yes, create it for me"` / `"No, I'll create it manually"`

   **If "Yes":** this explicitly selects an MCP operation. Follow Step 1.3 immediately before calling `mcp__plugin_mercadopago_mcp__create_application`.
   **If "No":** show DevPanel URL for detected country: `https://www.mercadopago.com.{DOMAIN}/developers/panel/app` → instruct to create manually → continue.

   **NOTE — webhook and test-setup routes:** Skip Steps 1.2–1.4 and go directly to Rule 2. Their skills decide whether the requested operation needs an MCP tool.

   **Step 1.3 — MCP connection on demand:**

   Do **not** call `application_list`, `authenticate`, or any other MCP tool as a pre-flight check. Connect only when the next selected operation requires one of these tools:

   | Selected operation | MCP tool(s) |
   |---|---|
   | Create an application | `create_application` |
   | Import credentials | `application_list`, `get_credentials` |
   | Fill a documentation gap | `search_documentation` |
   | Create/fund test users | `create_test_user`, `add_money_test_user` |
   | Configure/diagnose webhooks | `save_webhook`, `notifications_history` |

   Immediately before the first required tool:

   1. Attempt the intended tool directly if it is callable. Do not call `application_list` as a generic probe.
   2. If the intended tool is unavailable or returns an authentication error, call `mcp__plugin_mercadopago_mcp__authenticate` and show the authorization link in the developer's language. Include: *"Cmd+Click (Mac) or Ctrl+Click (Windows/Linux); do not copy and paste the URL into an external browser."*
   3. When the developer returns, retry the **intended tool**. Call `application_list` only when selecting an application or importing credentials.
   4. If neither the intended tool nor `authenticate` is visible, explain that the plugin is not loaded and instruct the developer to run `/reload-plugins`, then `/mcp`, enable `plugin:mercadopago:mcp`, and retry.

   Scaffolding, the wizard, bundled references, official `llms.txt`, and manual credential guidance require no MCP connection.

   **Step 1.4 — Conditional readiness check + credential safety (before the wizard):**

   Ask each question only if needed — do not ask what you already know.

   **Account (ask only if not already resolved in Step 1.2 or `.mp-integrate-progress.md`):** Ask: *"Do you have a Mercado Pago developer account?"* → `Yes` / `No`. If No → show dashboard URL for their country and do not continue until confirmed.

   **Credentials (single merged question):** Ask via `AskUserQuestion`:
   - header: `"Credentials"`
   - Question: *"How do you want to provide credentials? Use the **{test_tab}** tab for safe testing — production credentials will generate real charges."*
   - Options:
     - `"Use my test credentials manually — recommended"` → safe, continue without MCP
     - `"Import credentials from my Mercado Pago account"` → use Step 1.3, then call `application_list` and `get_credentials`
     - `"I don't have credentials yet"` → show table below, block until confirmed
     - `"Production credentials (from {prod_tab} tab) — real charges"` → show confirmation blocker

   **If "Use manually":** save `credential_type=test`, continue without MCP.

   **If "Import":** apply Step 1.3 immediately before `application_list`; select the app; call `get_credentials`; write `.env` only after the developer confirms the target file; ensure `.env` is ignored by Git.

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

   **SDK dependency authorization:** Auto-detect the correct SDK from the project stack; never ask the developer to choose the SDK. Determine the registry's current stable release (`latest`, excluding pre-releases) and compare it with the installed version. Before any install or update, show the package, current version (or “not installed”), proposed stable version, and files expected to change, then ask authorization. If authorized, install/update to that stable release, adapt incompatible integration code, update the lockfile, and run the relevant tests. If declined, do not mutate dependencies and do not report the integration as ready while the required current SDK is missing or outdated.

2. **Read the SKILL.md ONCE from `${CLAUDE_PLUGIN_ROOT}`.** Use the routing table to pick the right file:

   ```bash
   SKILL_FILE="${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/SKILL.md"
   # webhook:   "${CLAUDE_PLUGIN_ROOT}/skills/mp-webhooks/SKILL.md"
   # test setup:"${CLAUDE_PLUGIN_ROOT}/skills/mp-test-setup/SKILL.md"
   # migrate:   "${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/SKILL-migrate.md"
   ```

   Use the `Read` tool with the absolute path returned. Once loaded, **execute the steps starting from Step 1.a** (auto-detect SDK/client/mode) — skip Pre-flight, Step 0, and Step 0.b, which already ran in Steps 1.1–1.4 above. Do not re-read the SKILL.md or this command file again. Do not delegate to a separate agent.

3. **Apply the HARD LOCKS at the top of the SKILL.md before any `AskUserQuestion`.** In particular: SDK is never asked, `mode` for `checkout-pro` is `preferences` (Orders is not available — never offer it), and there is no `Environment` picker.

4. **Never assume defaults.** If `$ARGUMENTS` is empty, do **not** assume `product=checkout-pro` or `country=AR` or any other value. Run the wizard from scratch and ask `AskUserQuestion` for each unresolved dimension. Defaults from past conversations or memory are forbidden.

5. **Documentation hierarchy (Step 3 in the SKILL.md):** (1) WebFetch official `{country_domain}/developers/llms.txt` — always current, no auth, fallback to tier 2 if fails; (2) bundled `references/products.md`; (3) MCP `search_documentation` (auth required). Never invent code from memory.

6. **Mandatory CTA rule for both checkout products:** Normalize `checkout-api-orders`, `checkout-transparente`, and `checkout-transparent` to the internal value `checkout-api`. Then, for `checkout-pro` and `checkout-api`, always run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-checkout-cta.mjs" "{resolved_product}" .
   ```

   Use the script's `product` value for every later branch. If `nextAction=wire_selected_cta`, wire `selected`. If `nextAction=ask_user_for_cta_or_insertion_location`, call `AskUserQuestion` immediately and do not write or summarize the integration until the developer chooses a concrete target. Checkout Pro places a visible Pay with Mercado Pago button at that location. Checkout API wires that CTA to the new separate checkout screen. Never finish successfully with an unwired CTA.

7. **Checkout API public-key rule:** Detect and reuse the application's public client-configuration convention. Never generate a `%MP_PUBLIC_KEY%` token or rewrite cached HTML. For vanilla/no-build applications with a backend, expose a project-conventional JSON config route returning `{ publicKey }`, send `Cache-Control: no-store, max-age=0`, and fetch it with `cache: 'no-store'` before mounting the SDK. A static-only server is not a valid Checkout API runtime; connect the generated backend to the project's start/dev command and state that command explicitly. Do not expose `MP_ACCESS_TOKEN` and do not report success until the client has no unresolved key token and its config source is reachable through the actual application route.

8. **Checkout API CardForm lifecycle rule:** `issuer`, `installments`, and `identificationType` are required by SDK JS CardForm even when they are not visible inputs. The generated form and CardForm map must contain exactly one `<select>` for each. In the minimal UI, keep them `hidden`, `aria-hidden="true"`, and `tabindex="-1"`, never `disabled`; the backend still enforces `installments: 1`. Run the checkout-screen validator and do not report success if any lifecycle node or mapping is missing.

## Examples

- `/mp-integrate` — full wizard, asks for everything not auto-detected from the repo.
- `/mp-integrate product=checkout-pro country=AR` — skips those questions.
- `/mp-integrate product=bricks country=BR client=react brick=payment` — Bricks flow with a specific brick variant.
- `/mp-integrate webhook` — scaffold the webhook receiver and configure it via MCP.
- `/mp-integrate test-setup` — create a test user and load funds.
