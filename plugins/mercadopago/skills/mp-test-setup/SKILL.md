---
name: mp-test-setup
description: Create test users and add funds to them for Mercado Pago testing. Wraps create_test_user and add_money_test_user from the MCP. Clarifies that all credentials (including test users) use the APP_USR- prefix — there is no longer a TEST- sandbox.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, testing, test-user, sandbox, credentials"
---

# mp-test-setup

This skill is the only place test users get created. It exists because the testing model is a frequent source of confusion (legacy docs still mention `TEST-` credentials that no longer exist).

---

## The current testing model — read first

- **There is no separate sandbox.** Tests run against the production API using the credentials of a **test user**.
- **Test user credentials use the `APP_USR-` prefix**, exactly like real production credentials. There is no way to tell them apart by prefix.
- The legacy `TEST-` prefix is **deprecated**. Never suggest it, never ask if a credential is "sandbox" by its prefix.
- A test user has its own balance (loaded via this skill) and behaves like any real account.
- For automated test credentials without creating a test user: in the Developer Dashboard, *Tus integraciones → Datos de integración → Credenciales* → click **"Prueba"** (Brazilian Portuguese: *Suas integrações → Dados de integração → Credenciais → "Teste"*).

---

## Step 0 — Verify MCP is actually authenticated

`ListMcpResourcesTool` is unreliable for this MCP (always returns "No resources found"). The bootstrap tools `authenticate` / `complete_authentication` are always present and prove nothing.

Check whether `mcp__plugin_mercadopago_mercadopago__application_list` is callable AND returns at least one application. If not, stop and tell the user:

> The Mercado Pago MCP isn't authenticated yet. Run **`/mcp`**, find **`plugin:mercadopago:mercadopago`**, and complete OAuth in the browser. Then ask again.

---

## Step 1 — Resolve `site_id` before asking

The MCP does not currently return a `site_id` (its `application_list` only returns `AppID`/`AppName`/`AppDescription`). Resolve in this order:

1. **Use the country the agent already passed** as `country=` — the agent runs name-heuristic + repo signals + persisted state + ask, so it should have a value by the time it delegates here.
2. **Heuristic on app name** — call `application_list` and match `(MLA|MLB|MLM|MLC|MCO|MPE|MLU)` (case-insensitive) inside `AppName` or `AppDescription`. E.g. `"Villa mco"` → MCO.
3. **Read `.mp-integrate-progress.md`** at the project root — if a previous run persisted a country, reuse it.
4. **Last resort**: ask via `AskUserQuestion` (picker, never a numbered text block). Persist the answer to `.mp-integrate-progress.md`.

## Step 2 — Create a test user

Call `mcp__plugin_mercadopago_mercadopago__create_test_user` with:

| Param | Required | Values |
|-------|----------|--------|
| `site_id` | yes | `MLA` (Argentina), `MLB` (Brazil), `MLM` (Mexico), `MLC` (Chile), `MCO` (Colombia), `MPE` (Peru), `MLU` (Uruguay) |
| `description` | yes | Free text identifying the user (e.g., `"buyer for checkout-pro tests"`) |
| `profile` | yes | `seller` or `buyer` — pick the role you need to simulate |
| `amount` | optional | Initial balance in the country's currency |

The tool returns the user id, email, password, and `APP_USR-` credentials. Show them to the developer with a reminder: **these are not committable secrets — load them from `.env` only**.

> If the developer needs both sides of a transaction (typical for marketplace, subscriptions, P2P), create one `seller` and one `buyer`.

---

## Step 3 — Load funds (when needed)

Call `mcp__plugin_mercadopago_mercadopago__add_money_test_user` with:

| Param | Required |
|-------|----------|
| `test_user_id` | yes — the id returned by `create_test_user` |
| `amount` | yes — number in the user's currency |

Country-specific limits apply. If the call fails with a limit error, ask for a smaller amount and retry once.

---

## Step 4 — Test cards

For card testing, do **not** invent card numbers. Query MCP `search_documentation` with `"test cards {country}"` (e.g., `"test cards argentina"`) — the official set changes per country and per acquirer.

---

## Step 5 — Hand the credentials to the developer

Output template:

```markdown
## Test user created

**Country**: {country}
**Profile**: {seller | buyer}
**User id**: {id}
**Email**: {email}
**Initial balance**: {amount} {currency}

### Credentials (load from `.env`, never commit)
```
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
```

### Next steps
- Smoke test with `mp-webhooks` → `simulate_webhook`.
- Run `mp-review` to validate the integration once a payment goes through.
- For card payments, query MCP for current test cards: `search_documentation("test cards {country}")`.
```

---

## Gotchas

- Test user credentials look identical to production credentials. If a `.env` file leaks, both buyer and seller balances are exposed.
- The test user's email/password are valid logins on `mercadopago.com.{tld}` — the developer can sign in to inspect movements.
- A test user belongs to the country specified by `site_id`; trying to use Argentine test credentials against the Brazilian site fails silently with a `not_found` payment.
- Adding money has per-country daily limits. If you hit them, create a fresh test user instead of bumping limits.

---

## What this skill does NOT do

- It does **not** issue real production credentials. Those come from the Developer Dashboard.
- It does **not** validate webhooks (use `mp-webhooks`) or scaffold integration code (use `mp-integrate`).
