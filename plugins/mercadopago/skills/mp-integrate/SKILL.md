---
name: mp-integrate
description: Wizard that scaffolds a complete Mercado Pago integration from official and bundled sources, using MCP only for selected account actions or documentation gaps. Use whenever the developer wants to add or migrate a Mercado Pago payment flow.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.3.2"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, integration, wizard, checkout, bricks, qr, point, subscriptions, marketplace, payouts, smartapps, orders, sdk"
---

# mp-integrate

This skill is the single entry point for building a Mercado Pago integration. It collects the minimum context from the developer and assembles a ready-to-paste bundle using curated reference files and, as fallback, the MCP server.

## Reference files — read BEFORE generating any code

Use `${CLAUDE_PLUGIN_ROOT}` for every bundled reference and script. Claude Code resolves it to the active plugin version. Never scan an installation cache, load another marketplace copy, or copy the plugin's `.mcp.json` into the developer's project.

| File | Absolute path | Read when |
|---|---|---|
| `terminology-rules.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/terminology-rules.md` | **Always first** |
| `recommendation-template.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/recommendation-template.md` | **Always** — mandatory output structure |
| `guides/checkout-pro.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/checkout-pro.md` | product = checkout-pro |
| `guides/checkout-api.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/checkout-api.md` | product = checkout-api |
| `guides/bricks.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/bricks.md` | product = bricks |
| `guides/qr.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/qr.md` | product = qr |
| `guides/point.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/point.md` | product = point |
| `guides/subscriptions.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/subscriptions.md` | product = subscriptions |
| `guides/marketplace.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/marketplace.md` | product = marketplace |
| `guides/wallet-connect.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/wallet-connect.md` | product = wallet-connect |
| `guides/payouts.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/payouts.md` | product = money-out (current name: Payouts) |
| `guides/smartapps.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/smartapps.md` | product = smartapps |
| `guides/webhooks.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/guides/webhooks.md` | any product + webhooks |
| `products.md` | `${CLAUDE_PLUGIN_ROOT}/skills/mp-integrate/references/products.md` | test cards per country, API reference |

**Do NOT use MCP before reading all applicable files above.** For live documentation, WebFetch the official `{country_domain}/developers/llms.txt` (tier 1 — see Step 3), falling back to `products.md`.

---

⚠️ **IMPORTANT — when invoked via `/mp-integrate` command:** The command file already ran the environment check and readiness flow. **Start directly at Step 1.a** (auto-detect SDK/client/mode). Do not probe MCP state. Credentials are imported only if the developer explicitly selected that MCP-backed option.

---



## ⚠️ HARD LOCKS — read before doing anything else

These rules override any "what makes sense" judgement during the wizard. Past wizard runs have violated them; do not repeat the mistake.

### LOCK 1 — SDK is never a wizard question

The SDK / language is **NEVER** asked via `AskUserQuestion`. Period.

- Resolve it silently in Step 1.a by globbing the repo for a manifest (`package.json`, `pyproject.toml`, etc.).
- If a single manifest is found → record the SDK and **skip the question entirely**.
- If multiple manifests exist (real polyglot monorepo) → still don't ask. Pick the one that matches the directory the developer is currently editing, or default to `node`. Mention the choice in a single line of chat (`✓ SDK: node — from package.json`) and **continue without asking**.
- If no manifest exists at all → still don't ask. Default to `node`, mention it (`✓ SDK: node — defaulted (no manifest detected; we'll create package.json during scaffolding)`), and continue.
- Resolve the official package for that stack and query its official package registry for the current stable release. “Stable” means the registry's default/latest release, excluding alpha, beta, release-candidate, nightly, or preview builds.
- Compare the installed version with that stable release. Before installing or updating, show the package, current version (or “not installed”), proposed version, and the manifest/lockfile that will change, then request explicit authorization via `AskUserQuestion`.
- If authorized, install or update to the current stable release, adapt code affected by incompatible changes, update the lockfile, and run relevant tests. If declined, do not mutate dependencies and do not report the integration as ready while its required SDK is missing or outdated.

If you find yourself about to call `AskUserQuestion` with `header="SDK"` or `header="Stack"` or `header="Language"`, **stop immediately**. The SDK is never a picker. The Tabs row at the top of the wizard must NOT include "SDK" as one of the tabs.

### LOCK 2 — Product → Mode availability table (NON-NEGOTIABLE)

| Product | The ONLY valid `mode` values | Picker behavior |
|---------|------------------------------|-----------------|
| `checkout-pro` | `preferences` (the Orders API does **not** exist for Checkout Pro) | **Skip the mode question entirely.** Do not call `AskUserQuestion` with `header="Mode"`. Do not show "Orders API" as an option. Use `mode=preferences` silently. |
| `checkout-api` | `orders` | **Always `orders` in ALL countries.** |
| `bricks` | `payments` | Internal routing value. `card-payment` and `payment` create Payments API payments; `wallet` creates `/checkout/preferences`; `status-screen` only displays a `paymentId`. Never add `v1` to the preferences path. |
| `qr` | `orders` | **Always `orders` in ALL countries.** |
| `point` | `orders` | **Always `orders` in ALL countries.** |
| `marketplace` | `preferences` or `payments` | Resolve `marketplace-checkout=` first. Checkout Pro and Wallet Brick use Preferences; Checkout API uses Payments API. Marketplace is not a standalone Orders API mode. |
| `wallet-connect` | `orders` | Always `orders`. Never ask. |
| `subscriptions` | n/a (uses its own `preapproval` API) | Skip the mode question. |
| `money-out` | n/a (current product name: Payouts; country-specific API contract) | Skip the mode question. |
| `smartapps` | n/a | Skip the mode question. |

**If `product=checkout-pro` and you are about to render a Mode picker that includes `Orders API`, abort.** The Orders API is not available for Checkout Pro today. Period. Do not "future-proof" by offering it. Do not add a "Recommended" tag to it. Do not include it in any "Other" fallback.

### LOCK 3 — Always use `init_point`, never `sandbox_init_point`

Mercado Pago removed the sandbox environment. There is no staging URL. Every integration — including test-user flows — runs against the production API.

**Never generate code that references `sandbox_init_point`.** Always use `init_point` from the preference response. The difference between a test run and a production run is only which credentials are loaded (`APP_USR-` from a test user vs. a real account) — not the URL.

If you find `sandbox_init_point` in existing code, flag it as a bug: the redirect will fail silently or land on an error page.

**Also applies to test users:** test users created via `create_test_user` operate against the production API host using the `APP_USR-` credentials returned for that test-user account. There is no separate test base URL or sandbox toggle. This does **not** make `TEST-` credentials invalid: static test credentials for Checkout API, Bricks, and Payments API may use `TEST-`. Code using `sandbox_init_point` with any credential will not work.

### LOCK 4 — Tabs row must reflect only the questions that will actually be asked

The wizard's Tabs row at the top (the `□ Country  □ Product  □ Mode  ✓ Submit` line) must include **only** the dimensions that are actually still unresolved AND non-skipped per LOCK 1 and LOCK 2. Concretely:

- Never include "SDK" in the tabs — see LOCK 1.
- Never include "Mode" in the tabs when `product` is `checkout-pro` / `bricks` / `wallet-connect` / `subscriptions` / `money-out` / `smartapps`.
- Never include "Environment" in the tabs.

### LOCK 5 — Checkout CTA is mandatory for Pro and API

Immediately after the product is resolved, normalize these aliases before any product branch:

- `checkout-api-orders`, `checkout-transparente`, `checkout-transparent`, `checkout_api` → `checkout-api`
- `checkout-pro` remains `checkout-pro`

For either normalized value, run this from the target project root before assembling or writing the checkout UI:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-checkout-cta.mjs" "{product}" .
```

Persist the returned `product`, `status`, `selected`, `candidates`, and `nextAction` for Step 2.5. Do not independently reinterpret `checkout-api-orders` as another product. `nextAction=wire_selected_cta` requires using `selected`; `nextAction=ask_user_for_cta_or_insertion_location` requires an immediate `AskUserQuestion` for a concrete target. A Checkout Pro or Checkout API scaffold may never finish successfully without a wired CTA. This lock applies equally to both products; do not change the working Checkout Pro behavior while fixing Checkout API.

### LOCK 6 — Checkout Pro local back URLs must never enable `auto_return`

When `product=checkout-pro`, `auto_return: "approved"` is valid only when the effective `APP_URL` is a public HTTPS origin. If `APP_URL` is missing, uses `localhost`, `127.0.0.1`, `0.0.0.0`, or is not HTTPS, omit `auto_return` from the preference body. Do not merely provide localhost `back_urls`: the Preferences API rejects that combination before creating the preference.

For applications that support local and production execution, derive an explicit `publicAppUrl` boolean from `APP_URL` (HTTPS and non-local) and conditionally spread `{ auto_return: "approved" }` only when it is true. Before reporting success, run `validate-checkout-pro-server.mjs` as required by Step 3.5.

### LOCK 7 — Point uses Orders API and supports hardware-free test mode

When `product=point`, scaffold only the current Orders API flow: `POST /v1/orders`, `type: "point"`, and `config.point.terminal_id`. Never generate `/point/integration-api/.../payment-intents`, `type: "instore"`, or `config.device.id`.

For a developer without hardware, support the official standard virtual terminal `NEWLAND_N950__SBX0000001`, but only behind an explicit `MP_POINT_TEST_MODE=true` guard. Production must require `MP_POINT_TERMINAL_ID`; it may never silently fall back to the virtual terminal. Include order lookup by ID so the application can reconcile asynchronous status changes. Before reporting success, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-point-server.mjs" "{server_file}"
```

### LOCK 8 — QR uses Orders API with an existing Store and POS

When `product=qr`, scaffold only `POST /v1/orders` with `type: "qr"`, matching
`total_amount` and `transactions.payments[0].amount`, and
`config.qr.external_pos_id`. The only valid QR modes are `static`, `dynamic`, and
`hybrid`. Never generate `/instore/orders/qr/...`, `/instore/qr/...`, a redirect
Checkout order, or a QR whose content is a Checkout URL. Keep the request minimal:
do not invent a `payer` and remove legacy `items[].currency_id` and
`items[].total_amount` fields. Validate client-supplied prices, quantities, and
the computed total as finite positive values. QR cancellation must not copy the
Point-only `X-Allow-Cancelable-Status` header.

Store and POS provisioning is a prerequisite, not a hidden side effect of the
scaffold. Reuse an existing POS when one is explicitly configured. If none is
available, ask for the real Store location before creating persistent resources;
never invent an address. Dynamic and hybrid modes render
`type_response.qr_data` locally. Static mode renders the QR returned when the POS
was created. Include order lookup and cancellation, and run both acceptance
checks before reporting success:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-qr-server.mjs" "{server_file}"
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-qr-client.mjs" "{client_file}" 'data-mp-qr-cta="create-order"' "/api/qr/orders"
```

### LOCK 9 — Bricks behavior is variant-specific

Resolve `brick=` before writing code and read `references/guides/bricks.md`. Never
apply one Brick's backend to all four variants:

- `card-payment`: `CardPayment`/`cardPayment` creates a Payments API payment.
- `payment`: `Payment`/`payment` creates the selected method via Payments API.
- `wallet`: `Wallet`/`wallet` creates a preference using exactly
  `/checkout/preferences`; the path has no version segment.
- `status-screen`: `StatusScreen`/`statusScreen` renders a validated `paymentId`;
  it does not create a payment and must not receive an order ID.

Use the application's actual framework and scan the whole project for a real
checkout CTA. When one exists, preserve its presentation and link it to the new
dedicated Brick page after removing the competing old handler. If none exists,
create the page anyway and report the exact route/invocation the developer must
link. Never collect raw card fields around a Brick. Before reporting success:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . "{brick}"
```

### LOCK 10 — Subscriptions contracts never mix

When `product=subscriptions`, resolve `subscription-model=` before writing code
and read `references/guides/subscriptions.md`. The only valid values are
`with-plan`, `without-plan-authorized`, and `without-plan-pending`.

- `with-plan` uses a server-controlled `preapproval_plan_id`, a securely
  tokenized `card_token_id`, and `status: "authorized"`. Never accept a plan ID
  from the browser or create a plan from the buyer CTA.
- `without-plan-authorized` sends trusted server-side recurrence terms, a
  securely tokenized `card_token_id`, and `status: "authorized"`.
- `without-plan-pending` sends trusted recurrence terms and `status: "pending"`,
  omits `card_token_id`, and redirects only to the returned `init_point`.

Authorized flows must use MercadoPago.js CardForm or the official Card Payment
Brick. Never ask the buyer to paste a card token, never collect raw card data,
and never omit the CardForm lifecycle selects (`issuer`, `installments`, and
`identificationType`). Scan the whole application for every subscription CTA.
All marketing/entry CTAs must converge on the existing or generated dedicated
signup page; only its final CTA may create a preapproval. Remove competing demo
handlers and orphan server routes so exactly one preapproval creator remains.
Before reporting success:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-subscriptions-integration.mjs" . "{subscription-model}"
```

### LOCK 11 — Marketplace is OAuth + one supported checkout

When `product=marketplace`, resolve `marketplace-checkout=` before writing code
and read `references/guides/marketplace.md`. The only supported values are
`checkout-pro`, `checkout-api`, and `bricks-wallet`.

- `checkout-pro` uses the connected seller OAuth access token, exactly
  `/checkout/preferences`, and `marketplace_fee`.
- `checkout-api` uses the integrator public key, the connected seller OAuth
  access token, `/v1/payments`, secure tokenization, and `application_fee`.
- `bricks-wallet` uses the integrator public key, seller OAuth access token,
  exactly `/checkout/preferences`, `marketplace_fee`, a dynamic `preferenceId`,
  and `marketplace: true`.

Every contract must implement one-time server-side OAuth state, exact redirect
URI matching, authorization-code exchange, encrypted persistent seller tokens,
refresh-token rotation, and trusted server-side seller/cart/commission
resolution. Never accept seller ID, amount, commission, collector ID, or OAuth
tokens from the browser. Marketplace is not a standalone Orders API flow and
must not silently fall back to the platform token. Before reporting success:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-marketplace-integration.mjs" . "{marketplace-checkout}"
```

### LOCK 12 — Wallet Connect requires commercial access and server-only linkage

When `product=wallet-connect`, read
`references/guides/wallet-connect.md` before any scaffold decision.

1. Confirm that Mercado Pago enabled Wallet Connect commercially for the
   developer's application. If the developer explicitly says it is not enabled,
   stop with `BLOCKED: active Wallet Connect agreement required` and do not
   write files. If enablement is unknown, ask once before writing.
2. Always use the fixed `orders` mode. Do not ask about mode and do not replace
   this product with the Wallet Brick or Advanced Payments API.
3. Create a dedicated account-linking/payment page and scan the entire project
   for the real final checkout CTA. Preserve and wire it when found; otherwise
   report the exact new route and invocation that the developer must link.
4. Account linking, approval-code exchange, payer-token creation, encryption,
   persistence, and Orders API payment creation all happen on the server. The
   browser receives only safe linkage state, the approval redirect URI, and
   final order status/ID.
5. Derive buyer identity and purchase amount from authenticated server-side
   state. Never accept external user identity, payer token, amount, or stored
   credential semantics as authoritative browser input.
6. Do not load MercadoPago.js, ask for a public key, mount a Wallet Brick, or
   render card fields. Buyer approval happens in the Mercado Pago wallet UI.

Before reporting success, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-wallet-connect-integration.mjs" .
```

### LOCK 13 — SmartApps requires commercial access, Android, and its private SDK

When `product=smartapps`, read `references/guides/smartapps.md` before any
scaffold decision.

1. Confirm that the developer has an active SmartApps agreement with the
   Mercado Pago team. If not explicitly confirmed, stop with
   `BLOCKED: active SmartApps agreement required` and do not write files.
2. Query `mcp__plugin_mercadopago_mcp__search_documentation` for the current
   SmartApps guide even when tier-1 public documentation is available. If MCP
   authentication is missing, run the normal inline authentication flow and
   stop until it succeeds.
3. Require an Android target. Never convert or embed SmartApps into a web,
   backend, desktop, or iOS application. If the repository has no Android app,
   explain that a separate Android application/module is required and ask
   before expanding scope.
4. Resolve `main` versus `mini` and `own` versus `third-party` before writing.
   Main apps own the HOME launcher; mini apps do not. Third-party integrations
   require the SDK OAuth mode.
5. The SDK is the private AAR delivered in the Mercado Pago integration kit.
   Never substitute a public Mercado Pago SDK or invent a Maven coordinate.
   Ask before copying/updating it, verify the latest artifact with the
   integration team, and use only that latest version.
6. Payment methods, payments, printer, scanner/camera, and Bluetooth are used
   through the SmartApps SDK. Do not call payment APIs directly from the
   terminal or request prohibited direct Android permissions.

Before reporting a successful static scaffold, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-smartapps-integration.mjs" . "{main|mini}" "{own|third-party}"
```

Passing this check is not device certification. Compilation requires the real
latest AAR; payment and hardware validation require the Mercado Pago development
terminal and the sandbox-flavor kit.

### LOCK 14 — Money Out is Payouts and its contract is country-specific

When `product=money-out`, read `references/guides/payouts.md` before any scaffold
decision and present the current product name as **Payouts**.

1. Never scaffold a `disbursements` API, Advanced Payments, Marketplace split,
   checkout flow, buyer CTA, or card form. The old Money Out URL now redirects
   to Payouts.
2. Resolve the contract from the country before writing. Argentina uses the
   current batch Payouts contract; Brazil uses the current single Transaction
   Intent contract. For another country, query the current country guide and
   stop with `BLOCKED: verified Payouts country contract required` if it does
   not return a verified contract.
3. Payout creation is server-only and privileged. Require authentication plus
   explicit operator authorization, load amount and destination from a durable
   trusted instruction repository, and write a durable audit trail. The caller
   may provide only an opaque instruction ID.
4. Test mode must be explicit and must send the official Payouts test header.
   Production must use Ed25519 signing of the exact serialized body. Never
   hardcode test mode, a private key, a destination account, or an Access Token.
5. A successful HTTP response is asynchronous acceptance, not final
   accreditation. Persist IDs/statuses and reconcile by lookup plus Webhooks.
6. Do not install an SDK solely for Payouts when the verified country contract
   uses REST and the detected official SDK does not expose that resource. If an
   official SDK is used, LOCK 1 still requires authorization and the latest
   stable version.

Before reporting success, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-payouts-integration.mjs" . "{AR|BR}"
```

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
| `qr-mode=` | `static` / `dynamic` / `hybrid` (only when `product=qr`) |
| `subscription-model=` | `with-plan` / `without-plan-authorized` / `without-plan-pending` (only when `product=subscriptions`) |
| `marketplace-checkout=` | `checkout-pro` / `checkout-api` / `bricks-wallet` (only when `product=marketplace`) |
| `smartapps-agreement=` | `confirmed` (only when `product=smartapps`; absence is never inferred as confirmation) |
| `smartapp-kind=` | `main` / `mini` (only when `product=smartapps`) |
| `smartapp-ownership=` | `own` / `third-party` (only when `product=smartapps`) |

After parsing or inferring `product`, apply LOCK 5 normalization immediately. Use only the normalized internal value for the Product Matrix, guide selection, CTA resolution, and scaffold branches. The presentation-only slug `checkout-api-orders` may appear in the final recommendation metadata, but it must never be used as an internal branch value.

### Step 1.a — Auto-resolve before asking (MANDATORY — exhaust this step first)

**You MUST run this step before any `AskUserQuestion` call.** Every dimension that resolves here is removed from the wizard. The developer should only be asked about dimensions that genuinely cannot be inferred. **Skipping the auto-detection and asking the developer anyway is the single most common mistake — do not do it.**

For every dimension, attempt these resolution sources **in order**:

| Dimension | 0th: agent inference (Step 1.a) | 1st: persisted | 2nd: repo signals | 3rd: ask |
|-----------|--------------------------------|----------------|-------------------|----------|
| `product` | If agent resolved from message keywords → **use it, skip question** | Read from `.mp-integrate-progress.md` | — | `AskUserQuestion` picker |
| `country` | If agent resolved from message keywords → **use it, skip question** | Read from `.mp-integrate-progress.md` | **None — do not grep for country** (unreliable, costs tokens) | `AskUserQuestion` picker. **Persist the answer**. |
| `sdk` | — | — | **MUST run `Glob` for**: `package.json`→node, `pyproject.toml`/`requirements.txt`→python, `pom.xml`/`build.gradle*`→java, `composer.json`→php, `Gemfile`→ruby, `*.csproj`/`Program.cs`→dotnet, `go.mod`→go. Single match → resolved. Multiple matches → choose the manifest in the active application area. No match → default to node. | **Never ask which SDK**; only ask authorization before an install/update. |
| `client` | — | — | Inspect `package.json` deps: `react`/`next`→react, `react-native`/`expo`→react-native, `*.xcodeproj`→ios, Android `build.gradle`→android, `pubspec.yaml`→flutter. Single match → resolved. | `AskUserQuestion` (only if product has client component AND ambiguous) |
| `lang` | — | — | Derive from country (BR→pt, others→es). | Almost never asked — defaulted from country |
| `mode` | — | Read from progress file | `Grep` for `/v1/orders`/`order.create`→orders; `/v1/payments`/`payment.create`→payments; `/checkout/preferences`/`preference.create`→preferences. Product Matrix may pin to single value (e.g. checkout-pro → always preferences). | `AskUserQuestion` (only when matrix allows >1 AND grep didn't disambiguate) |

**Concrete order of operations for the wizard (INFER FIRST, ASK LAST):**

0. **Check for legacy Instore APIs in repo (before any question).** Run `Grep` for legacy QR/Point patterns:
   - `/mpmobile/instore/qr` (QR Instore)
   - `/instore/qr/seller/collectors` (QR Instore V2)
   - `/instore/orders/qr/seller/collectors` (QR Dinámico)
   - `/point/integration-api/devices/.*/payment-intents` (Point PDV + Self Service)

   If any found AND the project is not already fully on `/v1/orders`, ask **once** via `AskUserQuestion`:
   - header: `"Existing integration"`
   - Question: *"I found an existing legacy Instore integration in your project at {file}:{line}. Before scaffolding, would you like to migrate it to the Orders API first?"*
   - Options: `"Yes, migrate first (/mp-integrate migrate)"` / `"No, scaffold the new integration"`
   - If "Yes" → stop and instruct: *"Run `/mp-integrate migrate` to migrate the existing integration, then come back to scaffold the new one."*
   - If "No" → continue normally. Do NOT suggest migration again in this session.
   - **Skip this check entirely** if `$ARGUMENTS` already contains `migrate`.

1. **Check agent inference** — if the agent's Step 1.a resolved `product=` and/or `country=` from the developer's message, those dimensions are already resolved. Do NOT ask for them.
2. Read `.mp-integrate-progress.md` if it exists — pull any previously-resolved values.
3. **Do NOT grep for country.** Country is asked via `AskUserQuestion` unless already resolved by steps 1–2. No locale-string grep, no `mercadopago.com.<tld>` grep, no `currency_id` grep — they cost tokens and produce wrong matches.
4. Run `Glob` over the manifest patterns. **If a single SDK manifest matches, the SDK is RESOLVED — do NOT ask.** The official Mercado Pago SDK for the detected language is the one used. Never propose a third-party SDK.
5. If the product needs a client, run `Glob`/`Grep` on manifest deps. If a single client matches, **client resolved**. Skip the client question.
6. Default `lang` from country. Skip the lang question.
7. Now — and only now — call `AskUserQuestion` for whatever is still missing, one tool call at a time, in the order defined in Step 1.b. After each answer, **persist it** to `.mp-integrate-progress.md`.

**Known MCP limitation — country resolution:** The Mercado Pago MCP does not currently expose a tool that returns the developer's `site_id` (neither `application_list` nor `quality_checklist` nor `notifications_history` carry the country in their response). The OAuth access token would let us call `GET https://api.mercadopago.com/users/me` directly, but the token is held by the MCP server and is not exposed to the plugin client. Until MP ships a new MCP tool (e.g. `current_user_info` or a generic `proxy_request`), country resolution is **just**: read `.mp-integrate-progress.md` if it has a country, otherwise ask via `AskUserQuestion` and persist. **Do not** waste tokens grepping the repo for country signals (locales, URLs, `currency_id`, `site_id`, app-name heuristics) — they don't pay off, and asking the developer once is cheaper and more reliable.

### Step 1.a.iii — Confirm everything that was auto-resolved (mandatory)

After auto-resolving, render a single confirmation block listing every value that was inferred (not just country — also SDK, client, and any other dimension that came from the repo). Then, **before any wizard question**, ask the developer with one `AskUserQuestion`:

- `header="Confirm setup"`
- Question: `"I auto-detected the following from your repo. Is everything correct?"`
- Options:
  - `"Yes, continue"` — proceed to Step 1.b with the auto-resolved values.
  - `"No, let me correct"` — drop the user-selectable auto-resolved values back into the wizard queue. Do not add SDK/language to that queue: re-run repository detection for them and explain the selected official SDK without presenting an SDK picker.

Skip this confirmation **only** when there was nothing to auto-resolve (clean repo, no manifest, no locale, no existing MP URLs). In that case the wizard goes straight to asking.

Example block to render:

```
I auto-detected the following from your repo:

  ✓ App:    My Store (123456789012345) — from application_list
  ✓ SDK:    node — from backend/package.json (mercadopago v2.12.0 already installed)
  ✓ Client: react — from frontend/package.json

Country will be asked next (not auto-detected).
Confirm the above to continue, or correct.
```

The developer must explicitly opt-in to the auto-resolved set. Never proceed silently to Step 1.b after auto-resolving — that's how wrong assumptions propagate to the final bundle.

If the agent already passed flags (`country=`, `sdk=`, `mode=`, etc.), treat those as resolved too.

Anything still unresolved after 1.a goes into the wizard in 1.b.

**Always use the official Mercado Pago SDKs**, listed below, regardless of whether the developer mentions a wrapper or alternative library. The official SDKs are maintained by Mercado Pago and aligned with the live API.

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
| 2 | `mode` | "Mode" | **Cross-reference LOCK 2 first.** Skip entirely when LOCK 2 says "Skip the mode question". When asked, only show modes that LOCK 2 explicitly allows for the chosen product. Never include "Orders API" as an option for `checkout-pro`. |
| 3 | `client` | "Client" | Only if the product has a client component AND repo signals were ambiguous. Show the 3 most likely + Other. |
| 4 | `brick` | "Brick" | Only when `product=bricks`. Options: `payment` / `card-payment` / `wallet` / `status-screen`. |
| 5 | `qr-mode` | "QR mode" | Only when `product=qr`. Options: `static` / `dynamic` / `hybrid`. |
| 5.5 | `subscription-model` | "Subscription" | Only when `product=subscriptions`. Options: `with-plan` / `without-plan-authorized` / `without-plan-pending`. |
| 5.6 | `marketplace-checkout` | "Marketplace" | Only when `product=marketplace`. Options: `checkout-pro` / `checkout-api` / `bricks-wallet`. |
| 5.7 | `smartapps-agreement` | "Agreement" | Only when `product=smartapps`. Ask whether the active commercial/integration agreement with Mercado Pago is confirmed. Options: `confirmed` / `not confirmed`. If not confirmed, stop before any write. |
| 5.8 | `smartapp-kind` | "SmartApp type" | Only when `product=smartapps` and the agreement is confirmed. Options: `main` / `mini`. |
| 5.9 | `smartapp-ownership` | "Terminal use" | Only when `product=smartapps` and the agreement is confirmed. Options: `own` / `third-party`. |
| 6 | `recurrent` | "Recurrent" | Only when the matrix marks it `yes` for the chosen product. Options: `yes` / `no`. |
| 7 | `3ds` | "3DS" | Only when the matrix marks it `yes`. Options: `yes` / `no`. |
| 8 | `marketplace` | "Splits" | Only when the matrix marks it `optional`. Options: `yes` / `no`. |

**`sdk` is intentionally absent from this table** — see LOCK 1 above. The SDK is never asked via `AskUserQuestion`.

**`environment` is NEVER asked.** Mercado Pago no longer has a sandbox/production toggle. Both production credentials and test-user credentials use the `APP_USR-` prefix; the difference is whether the credentials belong to a real account or a test user (handled in `mp-test-setup`). Do not present an "Environment: production / test" picker. Do not write code that branches on `NODE_ENV` to switch MP base URLs.

### Step 1.b.ii — Resolve `mode` without an eager MCP call

Use the Product Matrix below first. If its `mode` cell is fixed for the selected product, use that value and do not connect to MCP.

Only when the product/mode combination is absent or genuinely ambiguous in the bundled sources, use `mcp__plugin_mercadopago_mcp__search_documentation` with a query like `"{product} orders api {country}"`. This is an MCP-backed fallback: authenticate immediately before that query, not earlier. Never run it for `checkout-pro` — LOCK 2 already forbids Orders for that product.

If the fallback docs explicitly confirm a mode, use it for this run. If they do not, do not offer an unverified mode.

This rule exists because the v4 wizard offered Orders for Checkout Pro when the API does not exist for that product. Never offer a mode that does not exist on the MP API today, even if it is rumored or coming-soon.

**`country` will commonly end up in this list.** Today the MCP does not return `site_id`, so unless repo signals or persisted state resolved it in 1.a, you will need to ask. Use `header="Country"` with `AR`, `BR`, `MX`, `CO` as buttons (the 4 most common) — the picker auto-adds an "Other" entry that lets the developer type `CL`, `PE`, or `UY`. After the answer, persist it to `.mp-integrate-progress.md`.

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
✓ App: My Store (123456789012345) — from application_list
✓ SDK: node — from package.json
(Country will be asked next — not auto-detected.)
```

→ then immediately the `AskUserQuestion` call for `product`. The developer picks. Then ≤1 line confirmation. Then the next `AskUserQuestion`. And so on.

### Step 1.c — Persist ALL collected data immediately

**Golden rule of persistence: every piece of information collected — by inference, by wizard, by MCP, by any means — is written to `.mp-integrate-progress.md` immediately after collection. It is never asked again unless the developer explicitly changes it.**

At the start of every run, read this file first and use every value found in it. Only ask for dimensions that are genuinely absent.

Fields to persist (write after each is resolved, do not wait until the end):

```markdown
# mp-integrate progress

- country: AR
- product: checkout-pro
- mode: preferences
- sdk: node
- client: react
- lang: es
- credential_type: test
- application_id: 123456789012345
- brick: card-payment
- qr_mode: dynamic
- subscription_model: with-plan
- marketplace_checkout: checkout-pro
- recurrent: no
- three_ds: no
```

**Rules:**
- Write the file after EACH field is resolved — not only at the end of the wizard.
- If the developer changes a value mid-session (e.g. "actually I want Brazil"), update the file immediately.
- Add `.mp-integrate-progress.md` to `.gitignore` if not already there.
- Delete on successful bundle render, or keep on cancel/error for next run to pick up.

### Product Matrix — which flags apply (and which don't)

| Product | sdk | client | mode (allowed values) | recurrent | 3ds | marketplace | sub-flag |
|---|---|---|---|---|---|---|---|
| `checkout-pro` | yes | optional | **`preferences` only** — Checkout Pro does NOT have an Orders API mode | n/a | n/a | optional | n/a |
| `checkout-api` | yes | yes | **`orders` (ALL countries)** | yes | yes | optional | n/a |
| `bricks` | yes (server) | yes | internal `payments` routing; backend is variant-specific per LOCK 9 | yes (payment, card-payment) | yes (payment, card-payment, status-screen) | optional | `brick=` |
| `qr` | yes | n/a | **`orders` (ALL countries)** | n/a | n/a | n/a | `qr-mode=` |
| `point` | yes | n/a | **`orders` (ALL countries)** | n/a | n/a | n/a | n/a |
| `subscriptions` | yes | conditional (authorized contracts use MercadoPago.js) | n/a (own `preapproval` API) | implicit | n/a | optional | `subscription-model=` |
| `marketplace` | yes | conditional | `preferences` for Checkout Pro/Wallet; `payments` for Checkout API | n/a | n/a | implicit | `marketplace-checkout=` |
| `wallet-connect` | yes | n/a | `orders` | n/a | n/a | n/a | n/a |
| `money-out` | conditional (verified REST is valid) | n/a | n/a (Payouts; country-specific contract) | n/a | n/a | n/a | country resolves contract |
| `smartapps` | n/a (private kit AAR) | Android | n/a | n/a | n/a | n/a | `smartapp-kind=`, `smartapp-ownership=` |

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

## Step 3 — Resolve docs and context

Resolve documentation in **tiers**. The official `llms.txt` per country is always fresh — fetch it first since the developer has internet and the file is a few KB. Fall back gracefully if unreachable.

| Tier | Source | Auth | When |
|------|--------|------|------|
| 1 | `https://www.{country_domain}/developers/llms.txt` (WebFetch — official, always current) | none | **Always first** — fetch using resolved country domain. If fails (403, timeout), fall to tier 2. |
| 2 | `{plugin_base}/skills/mp-integrate/references/products.md` (bundled) | none | **Always** — product guides, API reference, code snippets, country-specific test cards. |
| 3 | `mcp__plugin_mercadopago_mcp__search_documentation` | MCP OAuth | **Fallback only**, except SmartApps where it is mandatory — use when tiers 1–2 don't cover the combination, and always for `product=smartapps`. |

**Country domain for tier 1:**

| Country | llms.txt URL |
|---------|-------------|
| AR (MLA) | `https://www.mercadopago.com.ar/developers/llms.txt` |
| BR (MLB) | `https://www.mercadopago.com.br/developers/llms.txt` |
| MX (MLM) | `https://www.mercadopago.com.mx/developers/llms.txt` |
| CO (MCO) | `https://www.mercadopago.com.co/developers/llms.txt` |
| CL (MLC) | `https://www.mercadopago.cl/developers/llms.txt` ← no `.com` |
| PE (MPE) | `https://www.mercadopago.com.pe/developers/llms.txt` |
| UY (MLU) | `https://www.mercadopago.com.uy/developers/llms.txt` |

Country is **always resolved before Step 3**. Never fetch tier 1 without a resolved country.

**If tier 1 fetch fails:** silently fall to tier 2 (`references/products.md`). Do NOT show an error or retry.

**Only when tier 3 is actually needed:** attempt `search_documentation` directly. If it is unavailable or returns an authentication error, call `mcp__plugin_mercadopago_mcp__authenticate`, show the OAuth link in the developer's language, and instruct them to Cmd+Click (Mac) or Ctrl+Click (Windows/Linux) without copying the URL into an external browser. When the developer returns, retry `search_documentation` directly. Do not call `application_list` as a probe.

### Tier 3 — MCP query templates (fallback)

Build 1–3 targeted queries and call `mcp__plugin_mercadopago_mcp__search_documentation` with each. Use `language` from the resolved doc language.

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
| Payouts (legacy alias: Money Out) | `"payouts money transfer {country} {sdk}"` |
| Wallet Connect | `"wallet connect agreements payer token orders {sdk} {country}"` |
| SmartApps | `"smartapps {main|mini} android payment flow restrictions {country}"` |

Do **not** issue more than 3 queries. If a query returns generic results, refine once and stop.

### When MCP returns documentation but no code snippet (honest fallback)

If `search_documentation` returns a result that contains **only overview or landing prose** (no code blocks), do NOT fabricate code. Output exactly:

> **No verified snippet available** for {product} / {country} / {sdk}.
> The MCP returned documentation for this combination but no code snippet. Review the guide manually: `https://{DOMAIN}/developers/{LANG}/docs/{product-slug}/overview`

Then stop. Specifically:

- **Do NOT reconstruct code from training-data memory** — a reconstructed snippet (this is what produced the `CardForm` hallucination) must never be presented as if it were MCP-verified.
- **Do NOT make another arbitrary WebFetch as a substitute.** The single official country `llms.txt` request is tier 1, bundled references are tier 2, and MCP is tier 3. If none contains a verified snippet, report that it is unavailable.
- **Label the output explicitly** as "No verified snippet available" so the developer knows the difference between verified and unavailable.

---

## Step 4 — Assemble the bundle

### SmartApps bundle override

When `product=smartapps`, do not render the generic server/web checkout bundle
below and do not create `.env` credentials. Render a SmartApps-specific bundle
from `references/guides/smartapps.md` plus the authenticated MCP result with
these sections: commercial agreement, Android project eligibility, app kind
(`main|mini`), ownership (`own|third-party`), latest private SDK artifact,
Manifest/initialization contract, SDK-only payment flow, static validation,
development-terminal tests, and homologation. Label anything that still
depends on the private kit or terminal as blocked; never replace it with a
guessed public SDK or API call. Then continue to Step 4.5.

### Payouts bundle override

When `product=money-out`, label the bundle **Payouts** and render a server-only
bundle from `references/guides/payouts.md` plus the current country source. Do
not render the generic client/payment-form section, do not request a public key,
and do not create a checkout CTA. Include these sections: country contract,
privileged service boundary, durable trusted instruction repository, operator
authorization, audit trail, idempotency, explicit test mode, production
Ed25519 signing, resource lookup, notifications, safe automated test, and
production release controls. Use raw REST when the verified official SDK does
not expose Payouts and do not install a payment SDK merely to wrap `fetch`.

Render the result with this exact structure. Code blocks come from the resolved documentation tier (verbatim where possible). Do not invent payloads or endpoints.

````markdown
# Mercado Pago Integration — {Product} ({Country} · {SDK} · {mode})

## 1. Install
```bash
{install command for the chosen SDK}
```

## 2. Credentials

Get your credentials from the Mercado Pago Developer Dashboard:
👉 **https://{DOMAIN}/developers/panel/app**

- Under your application, click **Credentials**.
- For **testing**: click the **{test_tab}** to get test credentials.
- For **production**: use the credentials in the **{prod_tab}** tab.

Credentials come in two valid prefixes: **`APP_USR-`** (Orders API, Checkout Pro, Point, QR; also test-user credentials from `create_test_user`) and **`TEST-`** (Checkout API, Bricks, Payments API). Both are valid and actively issued — never tell a developer to change their prefix. What matters is which tab they come from: {test_tab} = test, {prod_tab} = production.

Create `.env` from the template below (**never commit `.env`**):

```
MP_ACCESS_TOKEN=APP_USR-...   # server-side, keep secret
MP_PUBLIC_KEY=APP_USR-...     # client-side, can be public
MP_WEBHOOK_SECRET=...         # from Dashboard → Webhooks → Signature secret
APP_URL=http://localhost:3000
```
Also ensure `.env` is in `.gitignore` (and `.env.example` is **not** ignored).

## 3. Server code
```{language}
{snippet from the resolved documentation tier — server-side creation, e.g., create order/preference/subscription/disbursement}
```

## 4. Client code (if applicable)

**Always show the total amount above the payment form** (do not bury it inside the brick):

```html
<!-- Total amount — always visible above the payment form -->
<p class="checkout-total">Total: <strong>{currency} {amount}</strong></p>
```

```{language}
{snippet from the resolved documentation tier — tokenization, brick mount, redirect, etc.}
```

**Payment feedback states — include ALL THREE in the scaffold (not as TODOs):**

```jsx
// Loading state — show while the payment is processing
{isLoading && (
  <div className="checkout-loading">
    <p>Processing your payment…</p>
  </div>
)}

// Success state
{paymentStatus === 'approved' && (
  <div className="checkout-success">
    <h2>Payment approved!</h2>
    <p>Order: <strong>{orderId}</strong></p>
    <p>Next step: run <code>/mp-review</code> to validate your integration before going live.</p>
  </div>
)}

// Error state — actionable, not the raw API error
{paymentStatus === 'error' && (
  <div className="checkout-error">
    <p>Payment could not be processed: {errorMessage}</p>
    <p>If testing, check your test card data or try a different scenario code —
       e.g. cardholder name <strong>APRO</strong> for approved, <strong>FUND</strong> for insufficient funds.</p>
  </div>
)}
```

> These three blocks are **part of the default scaffold on every run** — never leave them as `{/* TODO */}` placeholders. Adapt the conditional syntax to the detected client framework (React shown; use the equivalent for vanilla-js, Vue, etc.).

## 5. Webhook receiver
> Webhook validation is handled by the `mp-webhooks` skill — invoke it next, or run `/mp-integrate webhook` to scaffold the receiver with HMAC validation.

## 6. Test
- Get test credentials and test users via the `mp-test-setup` skill (or run `/mp-integrate test-setup`).
- Test cards for the country: see `references/products.md` (AR/BR/MX/CO/CL) or query MCP for others.
- After your first successful test payment → run `/mp-review` (**step 6 of 7 — MANDATORY before production**).

## 7. Docs (country-specific)
- Product guide: https://{DOMAIN}/developers/{LANG}/docs/{product-slug}/overview (fallback: /landing)
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

## Step 4.5 — Offer to scaffold files

⚠️ **MANDATORY — bundle must be visible to the user before this step.**

The full bundle from Step 4 MUST appear in the chat as rendered markdown output BEFORE this `AskUserQuestion` call — every time, on every run, even if references were already loaded in a previous turn of the same session. Never skip the render. Never say "referências já carregadas" or equivalent and jump here directly. If the bundle is not visibly rendered in the current response, render it now before proceeding.

Immediately after rendering the bundle, **before listing next steps**, call `AskUserQuestion` with:

- `header="Scaffold files"`
- Question: `"Do you want me to write these files to your project now?"`
- Options:
  - `"Yes, write the files"` → execute the scaffold below
  - `"No, just the code"` → skip to Step 5

**If the developer chooses to scaffold**, execute this sequence (in order — each step depends on the previous):

1. **Install or update the SDK only with authorization** — query the official registry and apply LOCK 1. If a change is needed, ask explicit authorization with the exact stable version before running `npm install mercadopago@latest` (or the equivalent stable-release command for the detected SDK) in the directory that contains the server-side manifest. Never select a prerelease. Update the lockfile, adapt incompatible integration code, run relevant tests, and stop on a non-zero exit. If the current dependency already resolves to the registry's stable release, do not mutate it; report the verified version.
2. **Write the server snippet** — create or edit the server file (e.g., `backend/index.js`, `backend/src/routes/mercadopago.js`) inserting the snippet from Step 4. If the file already exists, inject the new route after existing routes rather than overwriting.

   **When `product=point`:** run the Point server acceptance check immediately after writing the server integration. Fix every failure before continuing or reporting success:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-point-server.mjs" "{server_file}"
   ```

   **When `product=qr`:** run the QR server acceptance check immediately after writing the server integration. After wiring the client in the application's real charge CTA, run the client acceptance check as well. Fix every failure before continuing or reporting success:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-qr-server.mjs" "{server_file}"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-qr-client.mjs" "{client_file}" 'data-mp-qr-cta="create-order"' "/api/qr/orders"
   ```

   **When `product=bricks`:** apply LOCK 9 and run the application-wide validator
   after the dedicated Brick page, server route (when applicable), runtime public
   configuration, and CTA wiring have all been written:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . "{brick}"
   ```

   **When `product=subscriptions`:** apply LOCK 10 after the subscription CTA,
   signup page, tokenization (when authorized), server route, and lifecycle routes
   have been written:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-subscriptions-integration.mjs" . "{subscription-model}"
   ```

   **When `product=marketplace`:** apply LOCK 11 after seller OAuth,
   encrypted persistence/refresh, the selected checkout contract, and both the
   seller-connect and buyer-checkout CTAs have been written:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-marketplace-integration.mjs" . "{marketplace-checkout}"
   ```

   **When `product=wallet-connect`:** apply LOCK 12 after the dedicated page,
   checkout CTA wiring, account-linking routes, encrypted payer-token storage,
   and Orders API routes have been written:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-wallet-connect-integration.mjs" .
   ```

   **When `product=smartapps`:** apply LOCK 13 after the Android Manifest,
   application initialization, and SDK payment flow have been written. Run the
   validator with the resolved app kind and ownership. Do not report the AAR as
   current or the build as passing unless the real latest kit artifact was
   supplied and compiled successfully:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-smartapps-integration.mjs" . "{main|mini}" "{own|third-party}"
   ```

   **When `product=money-out`:** apply LOCK 14 after the privileged service,
   durable instruction repository, authorization/audit controls, resolved
   country contract, explicit test mode, production signing, and lookup routes
   have been written:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-payouts-integration.mjs" . "{AR|BR}"
   ```

2.5. **`checkout-pro` and `checkout-api` — Mandatory checkout CTA discovery** (skip for all other products):

   This step is unconditional for both checkout products. The scaffold is incomplete until a concrete CTA target has been resolved. The products use the same detector but different wiring in Step 3.5:

   - `checkout-pro`: place a visible **Pay with Mercado Pago** button at the resolved CTA location; it submits to the preference-creation route and redirects to `init_point`.
   - `checkout-api`: link the resolved CTA to the new, separate checkout screen.

   Reuse the LOCK 5 result. If it is unavailable for any reason, run the bundled resolver from the project root exactly once:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-checkout-cta.mjs" "{product}" .
   ```

   First replace `{product}` with the normalized internal value returned by LOCK 5. The resolver scans HTML and common web templates/components (JSX, TSX, Vue, Svelte, Astro, PHP, ERB, EJS, Handlebars, Twig, JavaScript, and TypeScript). It scores semantic evidence from visible text, attributes, and the actual click/navigation handler; it contains no application-specific selectors.

   **Resolve the target:**

   1. A match qualifies only when its element, visible text, location, and current handler together indicate the final action that starts checkout. A generic navigation link or a “buy” button on a product card is not sufficient evidence.
   2. Exclude the submit button inside the generated payment form (`form-checkout`, `type="submit"`, `mp-pay-btn`) — that button submits payment; it is not the link into the form.
   3. Read the candidate's existing `onclick`, `onClick`, `href`, or `addEventListener` before changing anything.
   4. If the detector returns `status=selected`, use that CTA and report `{file}:{line}`. This result is mandatory; do not downgrade it to “not found”.
   5. If it returns `status=ambiguous`, ask via `AskUserQuestion` which candidate is the checkout CTA (maximum four candidates). A target must be selected before scaffolding continues.
   6. If it returns `status=not_found`, inspect the application's actual cart/order/product entry screens and ask via `AskUserQuestion` where the new checkout CTA should be inserted (maximum four concrete file/location choices). After the developer chooses, set `cta_status=create` and use that exact location.
   7. If the developer does not provide a target after an ambiguous or not-found result, stop with `BLOCKED: checkout CTA target required`. Never finish the scaffold, silently omit the CTA, or report success.

   Store `{cta_file}`, `{cta_line_or_region}`, `{cta_selector}`, `{cta_status}`, and any existing handler for Step 3.5. Do not edit it yet; the server route and, for Checkout API, the new checkout screen must exist first.

3. **`checkout-api` only — Always create a separate checkout screen in a new file** — generate the client form from Step 4 using the project's architecture. For `checkout-pro`, skip directly to Step 3.5; Checkout Pro redirects to Mercado Pago and must not create a local payment-form screen.

   This is unconditional for Checkout API: the screen is created after Step 2.5 has resolved where its entry CTA will live.

   - **Server-rendered/static app:** create a new HTML/template file for the checkout screen and a GET route or static URL that serves that file.
   - **React/Vue/Angular/SPA:** create a new page/screen component file and register a dedicated route through the application's existing router.
   - **Mobile app:** create a new screen file and register it in the existing navigation stack.
   - **Single-file application without a router:** still create a separate checkout page file and expose it through a URL. Do not append another hidden view to the existing file.

   **Separation rule:** never place the generated payment form inside an existing cart, product, drawer, modal, accordion, tab, or conditionally hidden section. Never append the form markup to an existing screen file. Shared layouts, styles, and components may be imported or reused, but the checkout screen itself must be owned by its new file and opened through its own route/URL/navigation destination.

   Reuse the project's naming and route conventions. Record:

   - `{checkout_screen_file}` — the new file created for the screen;
   - `{checkout_screen_destination}` — its route, URL, or navigation name;
   - `{checkout_screen_invocation}` — the framework-appropriate code needed to open it.

   Do not link anything to the destination until the new file exists and the route/navigation registration has been verified.

   **Checkout API public-key delivery — mandatory and application-agnostic:**

   1. Detect the target application's existing client-configuration convention before generating the checkout screen. Reuse its established public runtime configuration for React, Next.js, Vue, Nuxt, Angular, mobile, or server-rendered templates; do not impose an Express-specific pattern on another stack.
   2. Never put `%MP_PUBLIC_KEY%` or another text-replacement token in generated client files. Never depend on rewriting the checkout HTML response: browsers, CDNs, service workers, and static hosts can retain a stale document containing the literal token.
   3. For vanilla/no-build applications with a backend, add a JSON configuration endpoint using the project's server framework and route conventions. It must read `MP_PUBLIC_KEY` on the server, return `{ publicKey }`, send `Cache-Control: no-store, max-age=0`, and return a non-2xx response with a clear error when the variable is missing. The checkout screen must request that endpoint with `cache: 'no-store'` before constructing `MercadoPago`.
   4. For build-based clients, use only the framework's public-variable convention (for example the existing Vite, Next.js, Nuxt, or Angular mechanism) and explain whether a server restart or rebuild is required. Do not expose `MP_ACCESS_TOKEN` or any other private credential.
   5. A static-only server cannot complete Checkout API because payment creation requires a backend. If the application is currently run with a static file server, wire the generated backend into the project's real start/dev command and tell the developer to use that command. Never claim success while instructing them to open the HTML file directly.
   6. Mark the generated form or screen root with `data-mp-public-key-source="runtime-endpoint"` or `data-mp-public-key-source="framework-public-config"`, matching the strategy actually used.
   7. Before success, verify that the generated client contains no unresolved public-key token, the client and server use the exact same config route when the endpoint strategy is selected, the missing-key path is visible and actionable, and the checkout screen is reached through the application's actual server/router.

   **Checkout API secure-field integrity — mandatory and application-agnostic:**

   - Build the smallest valid form. The always-visible card inputs are `cardNumber`, `expirationDate`, `securityCode`, and `cardholderName`.
   - Payer email and identification are required payment data, but they are not automatically required **visible inputs**. Reuse trusted values already available from the authenticated buyer/session/cart. Only render their inputs when the application does not have those values, and mark the selected strategy on the form with `data-mp-payer-email-source="form|application"` and `data-mp-payer-identification-source="form|application"`.
   - The SDK JS CardForm map requires `issuer`, `installments`, and `identificationType` even when the product UX does not show those controls. Always render exactly one `<select>` for each, keep it inside the form, mark it with `data-mp-sdk-required-field="issuer|installments|identificationType"`, and reference its exact ID in `mp.cardForm({ form: ... })`. Omitting any of the three is a scaffold failure because the SDK populates them during its payment-method lifecycle and can leave the secure iframe fields unresponsive when their DOM targets do not exist.
   - When one of those three controls is not part of the visible UX, use a real hidden lifecycle node: `<select hidden aria-hidden="true" tabindex="-1">`. Do not use `disabled`, because disabled controls cannot participate in form/SDK state. These hidden selects are SDK plumbing, not payment data trusted by the backend.
   - Derive the identification type from the resolved country and buyer context. For example, an individual buyer in Brazil uses `CPF`. Keep the required `identificationType` lifecycle select hidden when the type is known; make it a labeled visible selector only when the application genuinely supports multiple types and cannot infer the correct one.
   - Keep the required `issuer` lifecycle select hidden by default. Make it a labeled visible selector only if the payment-method metadata reports `additional_info_needed` containing `issuer_id`; do not send `issuer_id` inside Orders API `payment_method`.
   - Keep the required `installments` lifecycle select hidden for the minimal one-time flow and enforce `installments: 1` on the server. Make it a labeled visible selector only when the developer explicitly wants to offer installments. Never trust the hidden browser value instead of the server rule.
   - Every field registered under `mp.cardForm({ form: ... })` must have exactly one matching element in the DOM before `mp.cardForm(...)` runs. Never configure an optional field after choosing to source it from application state or omit it from the UI.
   - The form ID in `form.id` must exactly match the rendered `<form id="...">`.
   - Render a persistent visible label for every field, localized to the project's language. Placeholders such as `MM/AA` and `CVC` are hints, not labels, and may not render inside secure iframes.
   - For iframe fields (`cardNumber`, `expirationDate`, `securityCode`), keep the SDK host `<div>` empty and interactive. Never add `disabled`, `readonly`, `pointer-events: none`, or an overlapping decorative element to the host or its iframe.
   - Give each secure host a non-zero height and `position: relative`; make the injected iframe `display: block`, `width: 100%`, and `height: 100%`. The visible border belongs to the host, not to an overlay.
   - Mount secure fields only after the new checkout screen route is visible and the host has non-zero dimensions. Use the application's lifecycle/router hook or `requestAnimationFrame`; never initialize into `display: none`, and never use an arbitrary `setTimeout` as the visibility mechanism.
   - Mount exactly once per visible form instance. In SPAs, unmount/destroy the previous SDK controller or field instances before remounting.
   - Group each secure host with an external visible label and an accessible relationship, for example:

     ```html
     <div class="checkout-field" role="group" aria-labelledby="expiration-label">
       <span id="expiration-label" class="checkout-label">Validade do cartão (MM/AA)</span>
       <div id="form-checkout__expirationDate" class="secure-input"></div>
     </div>
     ```

   - Only disable the payment submit button while fetching or submitting. Never disable card-data fields as part of loading state management.
   - In `onFormMounted`, verify that every secure host contains exactly one iframe, has non-zero dimensions, has a visible external label, and that neither host nor iframe resolves to `pointer-events: none`. Surface failures both in the console and in a visible form error; do not report the scaffold as successful.

   Before continuing, compare the registered field IDs with the rendered IDs in both directions. Then inspect the generated source for `disabled`, `readonly`, `aria-disabled`, `inert`, overlays, and `pointer-events` affecting secure hosts or their ancestors. Missing labels, hidden mounting, duplicated instances, and non-interactive hosts are scaffold failures and must be fixed immediately.

   Mark every visible field wrapper with `data-mp-field="{fieldName}"`; mark the three SDK iframe hosts with `data-mp-secure-field="cardNumber|expirationDate|securityCode"`; mark the three required CardForm lifecycle selects with `data-mp-sdk-required-field="issuer|installments|identificationType"`. The form must declare whether payer email and identification come from the form or application state using the source markers above. After writing the new screen, run the deterministic acceptance check:

   ```bash
   # runtime-endpoint strategy: pass the file that implements the config route
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-checkout-screen.mjs" "{checkout_screen_file}" "{server_or_config_route_file}" "{cta_file}"

   # framework-public-config strategy: no server config file is needed
   node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-checkout-screen.mjs" "{checkout_screen_file}" "" "{cta_file}"
   ```

   If it fails, fix the new screen and rerun it. Never show a successful scaffold summary until this command exits with code 0.

3.5. **`checkout-pro` and `checkout-api` — Always wire the resolved CTA:**

   A resolved CTA is mandatory. Preserve the surrounding layout and reuse the project's button classes and accessibility conventions. Mark the final element with `data-mp-checkout-cta="{product}"` so the deterministic check can verify the integration.

   **When `product=checkout-api`:** preserve the existing CTA's visible text and styling, then replace only its navigation behavior so it opens `{checkout_screen_destination}`.

   - Existing `<a>`: add `data-mp-checkout-cta="checkout-api"` and set or update `href="{checkout_screen_destination}"`.
   - Vanilla `<button>`: add `data-mp-checkout-cta="checkout-api"` and replace its existing checkout handler with exactly one `window.location.assign('{checkout_screen_destination}')` action.
   - React/Vue/router app: add `data-mp-checkout-cta="checkout-api"` and use the existing router navigation API. Do not introduce `window.location` when the application already uses client-side routing.
   - When `cta_status=create`, insert one project-styled button/link at the exact location selected in Step 2.5 and wire it to the new screen.

   **When `product=checkout-pro`:** place a visible button labeled **Pay with Mercado Pago** (localized to the application language) at the resolved location. The button must start preference creation and redirect to the returned `init_point`; it must not open a local card form.

   - Server-rendered/static app: replace the chosen CTA, or insert at the chosen region, with a form that posts to the preference route:

     ```html
     <form action="{preference_route}" method="POST">
       <button type="submit" data-mp-checkout-cta="checkout-pro" class="{existing_button_classes}">
         Pagar com Mercado Pago
       </button>
     </form>
     ```

   - SPA/framework app: keep one visible project-styled button with `data-mp-checkout-cta="checkout-pro"`; its single handler must call the backend preference route and navigate to the returned `init_point`. Remove the old checkout handler instead of stacking a second listener.
   - Never create a second checkout page for Checkout Pro. The chosen CTA location is where the Mercado Pago button belongs.

   **Mandatory verification after editing:**

   1. Confirm exactly one final element has `data-mp-checkout-cta="{product}"`.
   2. For Checkout API, confirm `{checkout_screen_file}` is separate, `{checkout_screen_destination}` resolves to it, and the CTA has exactly one navigation action to that destination.
   3. For Checkout Pro, confirm the visible button says Mercado Pago and reaches the preference-creation route that redirects to `init_point`.
   4. Confirm the old CTA handler is gone and clicking cannot trigger two checkout flows.
   5. For Checkout API, confirm the payment form's own submit button was not mistaken for or rewired as the entry CTA.
   6. Run the deterministic CTA acceptance check and fix any failure before continuing:

      ```bash
      node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-checkout-cta.mjs" "{product}" "{cta_file}" "{checkout_screen_destination_or_preference_route}"
      ```

      For Checkout Pro, also run the server validator. It rejects unconditional `auto_return` when the application has a localhost fallback:

      ```bash
      node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-checkout-pro-server.mjs" "{server_file}"
      ```

   7. Report `✓ {cta_file}:{cta_line_or_region} → {checkout_screen_destination_or_preference_route}`. There is no successful “CTA not linked” outcome for Checkout Pro or Checkout API.
4. **Create `.env.example`** — write the template vars (MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, APP_URL) to `.env.example`. Only create `.env` with real values if the developer explicitly selected credential import and `get_credentials` succeeded; do not overwrite an existing `.env` without confirmation. Otherwise, never create `.env` — the developer must fill in their own credentials.
5. **Update `.gitignore`** — add `.env`, `.env.*.local`, `.mp-integrate-progress.md` if not already present.
5.5. **Delete `.mp-integrate-progress.md` after successful scaffolding** — this file is only a crash/cancel resume checkpoint. Remove it before running the final product validator and before printing a success summary. Keep it only when the run is canceled, blocked, or failed. Never leave a completed integration with this file present.
6. After all writes, print the product-specific summary. Both successful outcomes must include a wired CTA:

**Checkout API:**
```
✓ npm install mercadopago — OK
✓ {server_file} — Checkout API route added
✓ {checkout_screen_file} — separate checkout screen created
✓ MP_PUBLIC_KEY — loaded through {detected_config_strategy}; no HTML placeholder
✓ {cta_file}:{line} {cta_selector} → {checkout_screen_destination} → {checkout_screen_file}
✓ .env.example — created (fill in your credentials)
✓ .gitignore — updated
```

**Checkout Pro:**
```
✓ npm install mercadopago — OK
✓ {server_file} — preference route added
✓ {cta_file}:{line} — Pay with Mercado Pago button → {preference_route}
✓ .env.example — created (fill in your credentials)
✓ .gitignore — updated
```

**Scaffold guardrails:**
- Never write to files outside the current working directory.
- **If credentials were fetched via `get_credentials`:** do not overwrite the confirmed `.env`; only create `.env.example` with placeholders.
- **If credentials were not imported:** create `.env.example` with `APP_USR-...` placeholders. Never create `.env` here.
- If a target file exists and the developer said "write all", inject code rather than overwrite — show a `+diff`-style preview of what changed.
- If any write fails, report the exact error and stop; do not continue to the next file.
- **No HTML credential injection:** Do not generate `%MP_PUBLIC_KEY%`, `.replace(...)`, template-token substitution, or an inline hard-coded public key. Use the detected framework's public configuration convention, or a no-store JSON runtime-config endpoint for vanilla/server applications.

---

## Step 5 — Suggest next steps

Always close with:

1. **Run `/mp-integrate webhook`** to add the webhook receiver (HMAC validation included).
2. **Run `/mp-integrate test-setup`** to create a test user and load funds.
2.5. **For Orders API products (checkout-api / qr / point — ALL countries):** Ask via `AskUserQuestion` before listing next steps:
   - Question: *"Orders API requires a test buyer user to process payments. Do you want me to create one now?"*
   - Options: `"Yes, create test user now"` → invoke `mp-test-setup` skill inline; `"No, I'll do it later"` → show reminder: *"⚠️ Run `/mp-integrate test-setup` before testing — Orders API returns 422 without a test user."*
   - Note: Card Payment and Payment Bricks use Payments API and do not require the Orders buyer flow. Wallet still needs a buyer logged into Mercado Pago; Status Screen needs an existing payment ID.

3. **Run `/mp-review` — MANDATORY before going to production.** This is **step 6 of 7** in your integration journey. The auto-checker validates your integration automatically after the first payment. Do **not** switch to production credentials (step 7) until `/mp-review` passes.

> You are at step 6 of 7. After `/mp-review` passes, the only remaining step is switching to production credentials.

---

## Gotchas Bank

Render only the section that matches the chosen product. These are the experiential traps that the docs do not surface clearly. Keep them short.

### checkout-pro
- **Always use `init_point`, never `sandbox_init_point`.** Mercado Pago has no sandbox — there is only the production API. Test runs use test-user credentials (`APP_USR-`), not a different URL.
- `currency_id` must match the country (ARS, BRL, MXN, CLP, COP, PEN, UYU).
- Never trust `back_url` query params alone — always re-fetch payment status server-side.
- `auto_return=approved` requires `back_urls.success` set; otherwise it is silently ignored.
- `external_reference` is your reconciliation anchor — set it on every preference/order.

### checkout-api
- **⛔ Orders API requires a test user buyer** — `422 unprocessable_content` if you use an arbitrary email. Run `/mp-integrate test-setup` **before** testing. This applies to ALL countries.
- **`getCardFormData()` returns camelCase** — `paymentMethodId` and `issuerId`, not `payment_method_id` and `issuer_id`. Map them on the server.
- **`issuer_id` is NOT allowed inside `payment_method`** for Orders API — remove it from the payload or you get `additionalProperties not allowed`.
- **Minimal Checkout API UI** — always show card number, expiration, security code, and cardholder name. Collect payer email/identification only when trusted application state does not already provide them. Keep the SDK-required `issuer`, `installments`, and `identificationType` selects in the DOM/CardForm map but hidden from the minimal UI; enforce `installments: 1` server-side unless the merchant explicitly offers installments.
- **`total_amount` and `amount` must be `"10.00"` not `"10"`** — use `Number(x).toFixed(2)`.
- **Brazil (MLB)**: this product is called **Checkout Transparente** — use that name in MCP queries.
- Card tokens are single-use and expire in 7 days.
- Always send an idempotency key on payment creation; retries without it create duplicate charges.

### bricks
- **The backend is variant-specific.** `card-payment` and `payment` create via Payments API; `wallet` creates a dynamic preference at `/checkout/preferences` (without `v1`); `status-screen` only displays an existing `paymentId`.
- **Always show the charge amount above the brick.** The brick does not render the total prominently — buyers cannot see what they're paying. Add `<p>Total: <strong>{currency} {amount}</strong></p>` above the container div.
- **Always include three payment states in your UI.** (1) Loading/spinner while the brick initializes and while `onSubmit` runs. (2) Success state showing payment ID and "Payment approved" message. (3) Error state with an actionable message ("Card declined — try a different card"), not the raw API error string. Missing these states means buyers don't know if the payment went through.
- The container `<div id="..."></div>` must exist in the DOM **before** calling `bricksBuilder.create(...)`. A `setTimeout` is not a fix; use `onReady` or React `useEffect` with the ref mounted.
- `onSubmit` must return a **Promise** that resolves after the server responds — returning `void` makes the brick stay in the loading state forever.
- For Card Payment Brick: amount validation happens server-side; never trust the amount echoed by the brick.
- Wallet Brick requires the buyer to be logged into Mercado Pago — test users count as logged in if you use their credentials.
- Status Screen Brick handles 3DS challenge rendering; do not also render your own 3DS iframe.
- **Ad-blockers (uBlock, AdBlock Plus, Brave shields) block `sdk.mercadopago.com`** → the brick raises `FIELDS_SETUP_FAILED` and silently fails to mount. If a developer reports "the brick doesn't appear", check the ad-blocker before debugging code.
- **Debit cards do NOT show an installments selector** — this is correct behavior, not a bug. Make sure the server accepts `installments: 1` for debit and does not require the selector field to be present.
- **Never hardcode `preferenceId` as a placeholder** (e.g., `<PREFERENCE_ID>`, `YOUR_PREFERENCE_ID`, `"preference_id"`): the brick fails silently. The `preferenceId` must always be created dynamically on the server per buyer session.
- **Never trust Wallet item prices from the browser.** Send an opaque cart/purchase ID and rebuild the preference items and amount from trusted server-side state before calling Mercado Pago.
- **Preferences never use a version prefix or segment.** The valid path is exactly `/checkout/preferences`.
- **Status Screen Brick needs a `payment_id`** — extract it from the `POST /v1/payments` response (`response.id`) and pass it to the brick. Do not pass an order ID.
- **Vanilla builder lifecycle:** retain the controller returned by `bricksBuilder.create()` and call `controller.unmount()` before rebuilding or removing its container. The React SDK component owns its own controller lifecycle; do not create a second controller around it.
- **`back_urls` must be on the same origin as the page that mounts the brick.** Cross-domain back_urls fail silently — the redirect after payment lands on a blank page with no error.

### qr
- New integrations always use Orders API with `type: "qr"`; legacy `/instore/...` routes and QR-encoded Checkout redirect URLs are scaffold failures.
- Store + POS must exist before the order. `config.qr.external_pos_id` must exactly match the POS `external_id` and belong to the seller whose token creates the order.
- Valid modes are `static`, `dynamic`, and `hybrid`. Only dynamic and hybrid return `type_response.qr_data`; static uses the QR returned by POS creation.
- Encode QR data locally and never send it to a third-party image generator. Poll the order and handle `created`, `processed`, `canceled`, `expired`, and `refunded` explicitly.
- QR Orders webhooks use the `orders` topic. A real processed/refund test still requires scanning with the buyer test account; do not invent the Point `/events` simulator for QR.

### point
- New integrations use Orders API with `type: "point"` and `config.point.terminal_id`; never scaffold `/point/integration-api/.../payment-intents`, `type: "instore"`, or `config.device.id`.
- Without physical hardware, use the standard virtual terminal `NEWLAND_N950__SBX0000001` only behind explicit test mode and simulate each order result through `/v1/orders/{order_id}/events`. It is not valid for integration-quality measurement.
- A physical device must be paired to a User ID (not the application) and run in PDV mode. A device paired to the wrong user will silently reject orders.
- After a firmware update the device may take ~2 minutes to come back online; do not retry order creation aggressively.
- Webhook topic for Point (Orders API) is `orders`. The legacy `point_integration_wh` topic belongs to the old Point Integration API — do not use it for new integrations.

### subscriptions
- Pick `with-plan`, `without-plan-authorized`, or `without-plan-pending` before scaffolding. A preapproval created without a plan cannot be migrated to one later.
- Never expose a manual card-token field. Authorized contracts require secure MercadoPago.js tokenization; pending omits the token and redirects to `init_point`.
- Associated plan IDs and all recurrence terms are server-controlled. Never accept plan ID, amount, currency, or frequency from the browser.
- Recurring charges retry on failure; support `authorized`, `pending`, `paused`, and `canceled` explicitly and reconcile through GET/webhooks.
- The `back_url` must be HTTPS in production; HTTP is only acceptable for a local-development fallback.

### marketplace
- Marketplace is OAuth plus a checkout contract, not a standalone Orders API. Resolve Checkout Pro, Checkout API/Payments, or Wallet Brick first.
- Use a cryptographic one-time OAuth `state`, the exact configured redirect URI, encrypted persistent tokens, and atomic refresh-token rotation. Never expose or log seller tokens.
- Resolve seller, cart amount, and commission from trusted server state. Never accept `seller_id`, `collector_id`, amount, or fee from the buyer request.
- Checkout Pro/Wallet use `marketplace_fee` on `/checkout/preferences`; Checkout API uses `application_fee` on `/v1/payments`. The seller OAuth token in the Authorization header determines the receiving seller; do not invent `collector_id` in the payment payload.

### wallet-connect
- **Requires commercial enablement by Mercado Pago.** If it is not explicitly active, stop before changing project files.
- The user must approve the linkage in MP wallet UI — there is no silent linking.
- Create a dedicated account-linking page and wire the application's real final checkout CTA to it when one exists.
- The approval code and payer token are server-only. Encrypt the payer token in persistent storage and never expose it to the browser or logs.
- Once linked, payments use the buyer's saved methods through Orders API — do not pass card details, load MercadoPago.js, or substitute the Wallet Brick.
- Use a unique idempotency key, trusted purchase data, and matching two-decimal order/payment amounts.

### money-out
- The current product name is **Payouts**. Never scaffold the obsolete generic `disbursements` contract or substitute Advanced Payments.
- The API contract is country-specific: resolve it before generating code and never reuse Argentina payloads for Brazil or vice versa.
- Payouts is a privileged server-side money-movement operation. Require operator authorization, trusted durable instructions, persisted idempotency, and an audit trail; never trust destination or amount from a browser.
- Test calls require explicit Payouts test mode and the official test header. Production requires Ed25519 signing of the exact serialized body.
- Accepted, created, and pending are not final accreditation. Reconcile the returned resource by lookup and Webhooks.

### smartapps
- **Requires direct contact with the Mercado Pago team** — SmartApps is not self-service. Do not scaffold without confirming the developer has an active agreement with MP.
- SmartApps run on Point devices — code limits and APIs differ from server SDKs. Always query MCP for the SmartApps-specific guide.
- Never retrofit a web application as a SmartApp. The target must be Android; create a separate Android app/module only after the developer authorizes that scope.
- The SDK is a private AAR from the Mercado Pago integration kit. Ask before updating it, use only the latest artifact confirmed by the integration team, and never substitute a public SDK coordinate.
- A static validator cannot replace compilation with the real AAR, sandbox mock tests on a development terminal, or Mercado Pago homologation.

---

## What this skill does NOT do

- It does **not** validate webhooks. Use the `mp-webhooks` skill (or `/mp-integrate webhook`).
- It does **not** create test users. Use the `mp-test-setup` skill (or `/mp-integrate test-setup`).
- It does **not** evaluate integration quality. Use the `mp-review` skill (or `/mp-review`).
- It does **not** invent code from memory. Snippets come from the WebFetched official `llms.txt` per country (tier 1), `references/products.md` (tier 2), or MCP `search_documentation` (tier 3 fallback). Never from training-data memory alone.
