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

## Step 0 — Verify MCP is actually authenticated

`ListMcpResourcesTool` is **not** a reliable check — this MCP returns "No resources found" whether authenticated or not. The bootstrap tools `authenticate` / `complete_authentication` are **always** present and prove nothing.

The reliable check: is `mcp__plugin_mercadopago_mercadopago__application_list` callable from the current tool list AND does it return at least one application?

- If the tool is not in your capabilities, or it returns an auth error → the MCP is NOT connected. Stop, do not run the wizard, do not call AskUserQuestion. Tell the user:

  > The Mercado Pago MCP isn't authenticated yet. Run **`/mcp`** in your terminal, find **`plugin:mercadopago:mercadopago`** (status reads **needs authentication**), press **Enter** on **Authenticate**, and complete OAuth in the browser. Then ask again.

- If `application_list` returns successfully → the MCP is connected. Save the response (`AppID`, `AppName`, `AppDescription`). The MCP **does not** return `site_id` today, so the country is resolved separately in Step 1.a.

---

## Step 1 — Parse `$ARGUMENTS` and ask for missing context

`$ARGUMENTS` may include any combination of these flags. Anything missing must be asked via `AskUserQuestion` in batches of ≤4.

| Flag | Values |
|------|--------|
| `country=` | `AR` / `BR` / `MX` / `CL` / `CO` / `PE` / `UY` |
| `product=` | `checkout-pro` / `checkout-api` / `bricks` / `qr` / `point` / `subscriptions` / `marketplace` / `wallet-connect` / `money-out` / `smartapps` |
| `mode=` | depends on product — see Product Matrix below |
| `sdk=` | `node` / `python` / `java` / `php` / `ruby` / `dotnet` / `go` (or `none` for raw REST) |
| `client=` | `vanilla-js` / `react` / `ios` / `android` / `flutter` / `react-native` (only for products with a client component) |
| `lang=` | `es` / `en` / `pt` (docs language) |
| `recurrent=` | `yes` / `no` (Checkout API, Bricks) |
| `3ds=` | `yes` / `no` (Checkout API, Bricks) |
| `marketplace=` | `yes` / `no` (split payments) |
| `brick=` | `payment` / `card-payment` / `wallet` / `status-screen` (only when `product=bricks`) |
| `qr-mode=` | `static` / `dynamic` / `attended` (only when `product=qr`) |

### Step 1.a — Auto-resolve before asking (MANDATORY — exhaust this step first)

**You MUST run this step before any `AskUserQuestion` call.** Every dimension that resolves here is removed from the wizard. The developer should only be asked about dimensions that genuinely cannot be inferred. **Skipping the auto-detection and asking the developer anyway is the single most common mistake — do not do it.**

For every dimension, attempt these resolution sources **in order**:

| Dimension | 1st: MCP heuristic | 2nd: repo signals | 3rd: persisted | 4th: ask |
|-----------|--------------------|-------------------|----------------|----------|
| `country` | Match `(MLA\|MLB\|MLM\|MLC\|MCO\|MPE\|MLU)` (case-insensitive) inside `AppName` or `AppDescription` from the `application_list` response (e.g. `"Villa mco"` → MCO → Colombia). The MCP does NOT return `site_id`, so this regex on the app name is the only MCP-derived signal. | `currency_id`, `site_id` literals in code, `mercadopago.com.<tld>` URLs, locale strings | Read `country=` from `.mp-integrate-progress.md` if it exists from a prior run. | `AskUserQuestion` (with the country picker) |
| `sdk` | — | **MUST run `Glob` for**: `package.json`, `pyproject.toml`, `requirements.txt`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `composer.json`, `Gemfile`, `*.csproj`, `Program.cs`, `go.mod`. Mapping: `package.json` → `node`, `pyproject.toml`/`requirements.txt` → `python`, `pom.xml`/`build.gradle*` → `java`, `composer.json` → `php`, `Gemfile` → `ruby`, `*.csproj`/`Program.cs` → `dotnet`, `go.mod` → `go`. **Single manifest match → resolved, do NOT ask.** Multiple manifests (real polyglot monorepo) → ask. No manifest at all → ask. | Read from progress file. | `AskUserQuestion` |
| `client` | — | **MUST inspect** `package.json` deps and project files: `react`/`next` → `react`, `react-native`/`expo` → `react-native`, iOS Xcode project (`*.xcodeproj`) → `ios`, Android `build.gradle` with `com.android.application` → `android`, `pubspec.yaml` → `flutter`. Single match → resolved, do NOT ask. Otherwise → ask, but only if the product has a client component. | Read from progress file. | `AskUserQuestion` |
| `lang` | — | Derive from country (BR→pt, others→es). | Read from progress file. | almost never asked — defaulted from country |
| `mode` | — | `Grep` for `/v1/orders` / `order.create` → `orders`; `/v1/payments` / `payment.create` → `payments`; `/v1/checkout/preferences` / `preference.create` → `preferences`. Single hit → resolved. Plus the Product Matrix may pin mode to a single allowed value (e.g. `checkout-pro` → always `preferences`); when pinned, **do NOT ask**. | Read from progress file. | `AskUserQuestion` (only when matrix allows >1 AND grep didn't disambiguate) |

**Concrete order of operations for the wizard:**

1. Read `.mp-integrate-progress.md` if it exists — pull any previously-resolved values.
2. Apply name heuristic on the `application_list` response (already fetched in Step 0). If `AppName`/`AppDescription` matches a site code, **country resolved**. Otherwise continue.
3. Run repo signal greps for country (`currency_id`, `site_id`, locales). If unique match, **country resolved**. Otherwise the country goes into the wizard with `AskUserQuestion`.
4. Run `Glob` over the manifest patterns. If a single SDK matches, **SDK resolved**. Skip the SDK question.
5. If the product needs a client, run `Glob`/`Grep` on the manifest deps. If a single client matches, **client resolved**. Skip the client question.
6. Default `lang` from country. Skip the lang question.
7. Now — and only now — call `AskUserQuestion` for whatever is still missing, one tool call at a time, in the order defined in Step 1.b. After each answer, **persist it** to `.mp-integrate-progress.md`.

If the agent already passed flags (`country=`, `sdk=`, `mode=`, etc.), treat those as resolved too.

Anything still unresolved after 1.a goes into the wizard in 1.b.

### Step 1.b — Ask one question at a time, with the AskUserQuestion picker

This is the most-violated rule of the wizard. **The two screenshots that broke the v4 wizard were caused by violating this section.** Read it twice.

**STOP-TEST before writing any chat output:**

If your response includes ANY of these patterns, you are doing it wrong — abort and use `AskUserQuestion` instead:

- `Question N of M`
- `1. Country` / `2. Product` / `3. SDK` (numbered question list)
- A bullet list of option codes like `- checkout-pro — …`
- The phrase `Type the code` or `Reply with` or `Answer with`
- Any markdown that looks like a menu the developer is supposed to read and respond to in free text

These are all the v3 anti-pattern. The developer cannot click on plain text. They get a worse experience than the v3 plugin you just rewrote.

**HARD RULES — no exceptions:**

1. The **first tool call after Step 0/1.a** MUST be `AskUserQuestion`. If your first tool call is anything else (Read, Write, Bash, search_documentation, …), you skipped the wizard and went straight to "ask in chat". Stop and restart with `AskUserQuestion`.
2. `AskUserQuestion` runs **one tool call per dimension**, waiting for the answer before issuing the next call. The developer sees an interactive picker with arrow-key selection.
3. The chat output **before** the first `AskUserQuestion` call MUST be ≤3 short lines — one line per auto-resolved dimension, plus an optional one-line "now I'll ask the rest". No menus, no numbered lists, no "I'll ask you 4 quick questions".
4. **Between** `AskUserQuestion` calls: ≤1 line of confirmation, then immediately the next call. Do not summarise progress, do not show "Question N of M".
5. If you genuinely cannot fit a dimension into 4 picker options, the picker auto-adds an "Other" entry that lets the developer type freely — use that, do not split the question into two questions.

**Order of `AskUserQuestion` calls** — only for dimensions still unresolved after Step 1.a. Skip any dimension that is already known. Do NOT ask about dimensions the Product Matrix marks `n/a` for the chosen product.

| Order | Dimension | Header | Options to show |
|-------|-----------|--------|-----------------|
| 1 | `product` | "Product" | The 4 most likely products as buttons + "Other" auto-fallback. Pick the 4 from this priority: `checkout-pro`, `bricks`, `checkout-api`, `subscriptions` (most common). The remaining ones (`qr`, `point`, `marketplace`, `wallet-connect`, `money-out`, `smartapps`) are reachable via "Other". |
| 2 | `mode` | "Mode" | Only when the matrix lists more than one allowed value. For `checkout-api`: `orders` / `payments`. For `qr` / `point` / `marketplace`: `orders` / `legacy`. Skip entirely otherwise. |
| 3 | `sdk` | "Stack" | `node` / `python` / `java` / "Other" (php, ruby, dotnet, go, none-for-raw-REST reachable via Other). |
| 4 | `client` | "Client" | Only if the product has a client component AND repo signals were ambiguous. Show the 3 most likely + Other. |
| 5 | `brick` | "Brick" | Only when `product=bricks`. Options: `payment` / `card-payment` / `wallet` / `status-screen`. |
| 6 | `qr-mode` | "QR mode" | Only when `product=qr`. Options: `static` / `dynamic` / `attended`. |
| 7 | `recurrent` | "Recurrent" | Only when the matrix marks it `yes` for the chosen product. Options: `yes` / `no`. |
| 8 | `3ds` | "3DS" | Only when the matrix marks it `yes`. Options: `yes` / `no`. |
| 9 | `marketplace` | "Splits" | Only when the matrix marks it `optional`. Options: `yes` / `no`. |

**`country` may end up in this list.** Today the MCP does not return `site_id`, so unless the name heuristic or repo signals matched in 1.a, you will need to ask. Use `header="Country"` with `AR`, `BR`, `MX`, `CO` as buttons (the 4 most common) — the picker auto-adds an "Other" entry that lets the developer type `CL`, `PE`, or `UY`. After the answer, persist it.

### Step 1.b.i — What the chat looks like (concrete example)

Wrong (v3 anti-pattern, exactly what the screenshot showed):

```
Now I need a few details to scaffold the right integration:

1. Country — Which site/country are you integrating for?
- MCO — Colombia
- MLA — Argentina
…

2. Product — Which Mercado Pago product…
…

3. SDK / Language — What stack are you using?
…
```

Right:

```
✓ App: Villa mco (157134683642259) — from application_list
✓ Country: Colombia (MCO) — heuristic on AppName
✓ SDK: node — from package.json
```

→ then immediately the `AskUserQuestion` call for `product`. The developer picks. Then ≤1 line confirmation. Then the next `AskUserQuestion`. And so on.

### Step 1.c — Persist progress in a scratch file

While the wizard runs, maintain a scratchpad at `./.mp-integrate-progress.md` (project root) with the answers collected so far. Overwrite it after every question with the current state:

```markdown
# mp-integrate progress

- country: MCO (resolved from application_list AppName heuristic)
- product: checkout-pro (asked)
- sdk: node (auto-detected from package.json)
- mode: preferences (only valid mode for checkout-pro)
- client: react (auto-detected from package.json deps)
- lang: es
```

The file gives the developer a visible audit trail of what was inferred vs asked, and lets them interrupt and resume. **Delete it on success** (after the bundle is rendered) or leave it on cancel/error so the next run can pick up. Add `.mp-integrate-progress.md` to `.gitignore` if it isn't already.

### Product Matrix — which flags apply (and which don't)

| Product | sdk | client | mode (allowed values) | recurrent | 3ds | marketplace | sub-flag |
|---|---|---|---|---|---|---|---|
| `checkout-pro` | yes | optional | **`preferences` only** — Checkout Pro does NOT have an Orders API mode | n/a | n/a | optional | n/a |
| `checkout-api` | yes | yes | `orders` *(recommended)* / `payments` *(legacy)* | yes | yes | optional | n/a |
| `bricks` | yes (server) | yes | `orders` *(only mode supported by Bricks v4)* | yes (payment, card-payment) | yes (payment, card-payment, status-screen) | optional | `brick=` |
| `qr` | yes | n/a | `orders` / `legacy` | n/a | n/a | n/a | `qr-mode=` |
| `point` | yes | n/a | `orders` / `legacy` | n/a | n/a | n/a | n/a |
| `subscriptions` | yes | n/a | n/a (own `preapproval` API) | implicit | n/a | optional | n/a |
| `marketplace` | yes | n/a | `orders` / `legacy` | n/a | n/a | implicit | n/a |
| `wallet-connect` | yes | n/a | `orders` | n/a | n/a | n/a | n/a |
| `money-out` | yes | n/a | n/a (own `disbursements` API) | n/a | n/a | n/a | n/a |
| `smartapps` | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

When a product's `mode` cell is fixed (single value or `n/a`), **never ask** the developer about mode — just use the value or skip the question.

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
| Server creation | `"{product} create {mode} {sdk} {country}"` (e.g., `"checkout-pro create preference node argentina"` or `"checkout-api create order node argentina"`) |
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
