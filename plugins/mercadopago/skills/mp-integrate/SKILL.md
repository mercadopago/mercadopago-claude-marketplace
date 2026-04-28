---
name: mp-integrate
description: Wizard that scaffolds a complete Mercado Pago integration for any product. Asks the developer the minimum questions needed (country, product, variant, SDK, mode), queries the MCP server for live docs, and produces a ready-to-paste code bundle. Use whenever the developer wants to add or migrate a Mercado Pago payment flow.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, integration, wizard, checkout, bricks, qr, point, subscriptions, marketplace, orders, sdk"
---

# mp-integrate

This skill is the single entry point for building a Mercado Pago integration. It collects the minimum context from the developer, queries the official Mercado Pago MCP server (`plugin:mercadopago:mercadopago`) for current documentation, and assembles a ready-to-paste bundle (server snippet + client snippet + env vars + test instructions + gotchas).

**The MCP server is the source of truth.** This skill orchestrates queries to it; it does not duplicate documentation. If `mcp__plugin_mercadopago_mercadopago__search_documentation` is not available, stop and instruct the user to run `/mp-connect`.

---

## Step 0 — Verify MCP is connected

Call `ListMcpResourcesTool` with server `"plugin:mercadopago:mercadopago"`.

- Tools returned → continue.
- Empty / error → tell the user:
  > To scaffold the integration I need access to the Mercado Pago API. Run **`/mcp`** in your terminal, find **`plugin:mercadopago:mercadopago`** in the **Built-in MCPs** section, press **Enter**, and authorize in the browser. Then ask again.
  Then **stop**. Do not fall back to WebFetch as a substitute.

---

## Step 1 — Parse `$ARGUMENTS` and ask for missing context

`$ARGUMENTS` may include any combination of these flags. Anything missing must be asked via `AskUserQuestion` in batches of ≤4.

| Flag | Values |
|------|--------|
| `country=` | `AR` / `BR` / `MX` / `CL` / `CO` / `PE` / `UY` |
| `product=` | `checkout-pro` / `checkout-api` / `bricks` / `qr` / `point` / `subscriptions` / `marketplace` / `wallet-connect` / `money-out` / `smartapps` |
| `mode=` | `orders` (recommended) / `legacy` |
| `sdk=` | `node` / `python` / `java` / `php` / `ruby` / `dotnet` / `go` |
| `client=` | `vanilla-js` / `react` / `ios` / `android` / `flutter` / `react-native` (only for products with a client component) |
| `lang=` | `es` / `en` / `pt` (docs language) |
| `recurrent=` | `yes` / `no` (Checkout API, Bricks) |
| `3ds=` | `yes` / `no` (Checkout API, Bricks) |
| `marketplace=` | `yes` / `no` (split payments) |
| `brick=` | `payment` / `card-payment` / `wallet` / `status-screen` (only when `product=bricks`) |
| `qr-mode=` | `static` / `dynamic` / `attended` (only when `product=qr`) |

### Resolve country BEFORE asking the developer

Before any wizard question, attempt to resolve the country in this order:

1. **Ask the MCP** — call `mcp__plugin_mercadopago_mercadopago__get_application` (also exposed as `application_list`). The OAuth-authenticated app is bound to a country; if the response carries `site_id` (or country/country_id), use it and skip the country question entirely.
2. **Project signals** — grep for `currency_id`, `site_id`, `mercadopago.com.<tld>` URLs, or locale strings (handled by the agent before delegating).
3. **Ask the developer** — only as a last resort, and only for the country dimension.

The agent passes the resolved country via `country=`. If `country=` is present, the wizard does **not** ask country.

### Wizard order

**Batch 1** — only the dimensions still missing (typically product + docs language; country only if 1.a/1.b/agent did not resolve it).

**Batch 2** — SDK, mode (orders/legacy), client framework (only if product has a client component).
- Default `mode=orders` for new integrations. Only suggest `legacy` if the user explicitly asks or the existing code already uses `/v1/payments` or `/v1/checkout/preferences`.

**Batch 3** — feature flags (recurrent, 3ds, marketplace) — only the ones that apply to the chosen product (see Product Matrix below).

**Batch 4** — product-specific (brick variant, qr-mode, point device model) — only when applicable.

> Stop the wizard as soon as you have everything required for the chosen product. Do not ask flags that the Product Matrix marks `n/a`.

### Product Matrix — which flags apply

| Product | sdk | client | mode | recurrent | 3ds | marketplace | sub-flag |
|---|---|---|---|---|---|---|---|
| `checkout-pro` | yes | optional | orders/legacy | n/a | n/a | optional | n/a |
| `checkout-api` | yes | yes | orders/legacy | yes | yes | optional | n/a |
| `bricks` | yes (server) | yes | orders only | yes (payment, card-payment) | yes (payment, card-payment, status-screen) | optional | `brick=` |
| `qr` | yes | n/a | orders/legacy | n/a | n/a | n/a | `qr-mode=` |
| `point` | yes | n/a | orders/legacy | n/a | n/a | n/a | n/a |
| `subscriptions` | yes | n/a | n/a (own API) | implicit | n/a | optional | n/a |
| `marketplace` | yes | n/a | orders/legacy | n/a | n/a | implicit | n/a |
| `wallet-connect` | yes | n/a | orders | n/a | n/a | n/a | n/a |
| `money-out` | yes | n/a | n/a (own API) | n/a | n/a | n/a | n/a |
| `smartapps` | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

---

## Step 2 — Resolve country domain and currency

| Country | Site ID | Domain | Currency | Default lang |
|---------|---------|--------|----------|--------------|
| Argentina | MLA | `www.mercadopago.com.ar` | ARS | es |
| Brazil | MLB | `www.mercadopago.com.br` | BRL | pt |
| Mexico | MLM | `www.mercadopago.com.mx` | MXN | es |
| Chile | MLC | `www.mercadopago.cl` | CLP | es |
| Colombia | MCO | `www.mercadopago.com.co` | COP | es |
| Peru | MPE | `www.mercadopago.com.pe` | PEN | es |
| Uruguay | MLU | `www.mercadopago.com.uy` | UYU | es |

If `lang=` was not provided, default to the country's default lang.

---

## Step 3 — Query the MCP for current docs

Build 1–3 targeted queries and call `mcp__plugin_mercadopago_mercadopago__search_documentation` with each. Use `language` from the resolved doc language.

**Query templates** (use the most specific 1–3 for the chosen product/mode/sdk):

| Need | Query template |
|------|----------------|
| Server creation | `"{product} create {mode} {sdk} {country}"` (e.g., `"checkout-pro create order node argentina"`) |
| Client/UI | `"{product} {client} initialization {brick?}"` (e.g., `"bricks react payment brick initialization"`) |
| Tokenization (Checkout API / Card Payment Brick) | `"card token {client} {country}"` |
| 3DS challenge | `"3ds {product} {sdk}"` |
| Webhook handling | Skip — defer to `mp-webhooks` skill |
| Test cards / users | Skip — defer to `mp-test-setup` skill |
| Marketplace splits | `"marketplace split {sdk} application_fee"` |
| Subscriptions plan/preapproval | `"subscriptions preapproval {sdk}"` |
| Money out / disbursement | `"disbursement {sdk}"` |

Do **not** issue more than 3 queries. If a query returns generic results, refine once and stop.

If MCP returns nothing useful for the requested combination (e.g., a product not yet documented for that country), say so explicitly and offer to fall back to one targeted `WebFetch` against `https://{DOMAIN}/developers/{LANG}/docs/{product-slug}/landing` (max 1 fetch).

---

## Step 4 — Assemble the bundle

Render the result with this exact structure. Code blocks come from MCP responses (verbatim where possible). Do not invent payloads or endpoints.

````markdown
# Mercado Pago Integration — {Product} ({Country} · {SDK} · {mode})

## 1. Install
```bash
{install command for the chosen SDK}
```

## 2. Environment variables (`.env.example`)
```
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
MP_WEBHOOK_SECRET=...
APP_URL=http://localhost:3000
```
Also ensure `.env` is in `.gitignore` (and `.env.example` is **not** ignored).

## 3. Server code
```{language}
{snippet from MCP — server-side creation, e.g., create order/preference/subscription/disbursement}
```

## 4. Client code (if applicable)
```{language}
{snippet from MCP — tokenization, brick mount, redirect, etc.}
```

## 5. Webhook receiver
> Webhook validation is handled by the `mp-webhooks` skill — invoke it next, or run `/mp-integrate webhook` to scaffold the receiver with HMAC validation.

## 6. Test
- Get test credentials and test users via the `mp-test-setup` skill (or run `/mp-integrate test-setup`).
- Test cards for the country: query MCP `search_documentation` with `"test cards {country}"`.

## 7. Docs (country-specific)
- Product guide: https://{DOMAIN}/developers/{LANG}/docs/{product-slug}/landing
- API reference: https://{DOMAIN}/developers/{LANG}/reference

## 8. Gotchas
{render the gotchas for the chosen product from the Gotchas Bank below}
````

| SDK | Install command |
|-----|-----------------|
| node | `npm install mercadopago` |
| python | `pip install mercadopago` |
| java | Maven: `com.mercadopago:sdk-java` / Gradle equivalent |
| php | `composer require mercadopago/dx-php` |
| ruby | `gem install mercadopago-sdk` |
| dotnet | `dotnet add package MercadoPago` |
| go | `go get github.com/mercadopago/sdk-go` |
| react (client) | `npm install @mercadopago/sdk-react` |
| vanilla-js (client) | `<script src="https://sdk.mercadopago.com/js/v2"></script>` |
| ios | SPM: `https://github.com/mercadopago/sdk-ios` |
| android | Gradle: `com.mercadopago:sdk` |

---

## Step 5 — Suggest next steps

Always close with:

1. **Run `/mp-integrate webhook`** to add the webhook receiver (HMAC validation included).
2. **Run `/mp-integrate test-setup`** to create a test user and load funds.
3. **Run `/mp-review`** once the integration is in place.

---

## Gotchas Bank

Render only the section that matches the chosen product. These are the experiential traps that the docs do not surface clearly. Keep them short.

### checkout-pro
- `currency_id` must match the country (ARS, BRL, MXN, CLP, COP, PEN, UYU).
- Never trust `back_url` query params alone — always re-fetch payment status server-side.
- `auto_return=approved` requires `back_urls.success` set; otherwise it is silently ignored.
- `external_reference` is your reconciliation anchor — set it on every preference/order.

### checkout-api
- Card tokens are single-use and expire in 7 days.
- `binary_mode: false` is required for 3DS — otherwise no challenge is issued and the payment cannot reach `pending`.
- `issuer_id` is required for some card BINs in some countries.
- Always send an idempotency key on payment creation; retries without it create duplicate charges.
- Available payment methods change per country — query MCP for the live list rather than hardcoding.

### bricks
- The container `<div id="..."></div>` must exist in the DOM **before** calling `bricksBuilder.create(...)`. A `setTimeout` is not a fix; use `onReady` or React `useEffect` with the ref mounted.
- `onSubmit` must return a **Promise** that resolves after the server responds — returning `void` makes the brick stay in the loading state forever.
- For Card Payment Brick: amount validation happens server-side; never trust the amount echoed by the brick.
- Wallet Brick requires the buyer to be logged into Mercado Pago — test users count as logged in if you use their credentials.
- Status Screen Brick handles 3DS challenge rendering; do not also render your own 3DS iframe.

### qr
- Static QR (printed sticker) requires **Store + POS** to be created via API before generating the QR — they are not auto-created.
- Dynamic QR has a short TTL — generate one per buyer interaction, not one shared QR.
- Attended QR (cashier app) flows through `merchant_orders`, not direct payments — wire the webhook to `merchant_order` topic.

### point
- The device must be paired to a User ID (not the application). A device paired to the wrong user will silently reject `payment_intent`s.
- After a firmware update the device may take ~2 minutes to come back online; do not retry `payment_intent` creation aggressively.
- Webhook topic for Point is `point_integration_wh` — different from regular `payment` notifications.

### subscriptions
- A `preapproval` without a `preapproval_plan_id` is allowed but cannot be migrated to a plan later — pick one model upfront.
- Recurring charges retry on failure; the `paused` status is reachable both manually and after N failed attempts.
- The `back_url` for plan signup must be HTTPS in production — http only works locally.

### marketplace
- `application_fee` cannot exceed configured limits per country — check before charging.
- OAuth Access Tokens for sellers expire in 6 months; always store the `refresh_token` and renew before expiry.
- Splits require both seller's `collector_id` and `application_fee` in the payment payload — missing either makes the payment land in the marketplace owner's account.

### wallet-connect
- The user must approve the linkage in MP wallet UI — there is no silent linking.
- Once linked, payments use the buyer's saved methods — you do not pass card details.

### money-out
- Disbursements are settled in the seller's currency — cross-currency requires explicit `currency_id` and pre-approved configuration.
- Bank account validation is asynchronous; the disbursement may sit in `pending` until validation completes.

### smartapps
- Smart Apps run on Point devices — code limits and APIs differ from server SDKs. Always query MCP for the SmartApp-specific guide.

---

## What this skill does NOT do

- It does **not** validate webhooks. Use the `mp-webhooks` skill (or `/mp-integrate webhook`).
- It does **not** create test users. Use the `mp-test-setup` skill (or `/mp-integrate test-setup`).
- It does **not** evaluate integration quality. Use the `mp-review` skill (or `/mp-review`).
- It does **not** invent code from memory. Every snippet must come from the MCP `search_documentation` response or, as a single fallback, one `WebFetch` to the docs landing page.
