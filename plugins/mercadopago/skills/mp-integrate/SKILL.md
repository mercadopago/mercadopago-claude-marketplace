---
name: mp-integrate
description: Wizard that scaffolds a complete Mercado Pago integration for any product. Asks the developer the minimum questions needed (country, product, variant, SDK, mode), queries the MCP server for live docs, and produces a ready-to-paste code bundle. Use whenever the developer wants to add or migrate a Mercado Pago payment flow.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.3.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, integration, wizard, checkout, bricks, qr, point, subscriptions, marketplace, orders, sdk"
---

# mp-integrate

This skill is the single entry point for building a Mercado Pago integration. It collects the minimum context from the developer and assembles a ready-to-paste bundle using curated reference files and, as fallback, the MCP server.

## Reference files — read BEFORE generating any code

**Finding the references directory:** `{version}` is the installed plugin version. Resolve it via Bash:
```bash
PLUGIN_BASE=$(ls -d ~/.claude/plugins/cache/claude-plugins-official/mercadopago/*/ 2>/dev/null | sort -V | tail -1)
```
Then use `$PLUGIN_BASE` as the base path. Example:
- `$PLUGIN_BASE/skills/mp-integrate/references/terminology-rules.md`

Alternatively use the path: `~/.claude/plugins/cache/claude-plugins-official/mercadopago/{version}/` where `{version}` = the version shown in the plugin listing.

| File | Absolute path | Read when |
|---|---|---|
| `terminology-rules.md` | `{base}references/terminology-rules.md` | **Always first** |
| `recommendation-template.md` | `{base}references/recommendation-template.md` | **Always** — mandatory output structure |
| `guides/checkout-pro.md` | `{base}references/guides/checkout-pro.md` | product = checkout-pro |
| `guides/checkout-api.md` | `{base}references/guides/checkout-api.md` | product = checkout-api |
| `guides/bricks.md` | `{base}references/guides/bricks.md` | product = bricks |
| `guides/qr.md` | `{base}references/guides/qr.md` | product = qr |
| `guides/point.md` | `{base}references/guides/point.md` | product = point |
| `guides/subscriptions.md` | `{base}references/guides/subscriptions.md` | product = subscriptions |
| `guides/marketplace.md` | `{base}references/guides/marketplace.md` | product = marketplace |
| `guides/webhooks.md` | `{base}references/guides/webhooks.md` | any product + webhooks |
| `products.md` | `{base}references/products.md` | test cards per country, API reference |

**Do NOT use MCP before reading all applicable files above.** For live documentation, WebFetch the official `{country_domain}/developers/llms.txt` (tier 1 — see Step 3), falling back to `products.md`.

---

⚠️ **IMPORTANT — when invoked via `/mp-integrate` command:** The command file already ran env check, journey map, MCP state check, and credential fetch. **Start directly at Step 1.a** (auto-detect SDK/client/mode). Do NOT run any pre-flight or Step 0 checks again — they are done.

---



## ⚠️ HARD LOCKS — read before doing anything else

These rules override any "what makes sense" judgement during the wizard. Past wizard runs have violated them; do not repeat the mistake.

### LOCK 1 — SDK is never a wizard question

The SDK / language is **NEVER** asked via `AskUserQuestion`. Period.

- Resolve it silently in Step 1.a by globbing the repo for a manifest (`package.json`, `pyproject.toml`, etc.).
- If a single manifest is found → record the SDK and **skip the question entirely**.
- If multiple manifests exist (real polyglot monorepo) → still don't ask. Pick the one that matches the directory the developer is currently editing, or default to `node`. Mention the choice in a single line of chat (`✓ SDK: node — from package.json`) and **continue without asking**.
- If no manifest exists at all → still don't ask. Default to `node`, mention it (`✓ SDK: node — defaulted (no manifest detected; we'll create package.json during scaffolding)`), and continue.

If you find yourself about to call `AskUserQuestion` with `header="SDK"` or `header="Stack"` or `header="Language"`, **stop immediately**. The SDK is never a picker. The Tabs row at the top of the wizard must NOT include "SDK" as one of the tabs.

### LOCK 2 — Product → Mode availability table (NON-NEGOTIABLE)

| Product | The ONLY valid `mode` values | Picker behavior |
|---------|------------------------------|-----------------|
| `checkout-pro` | `preferences` (the Orders API does **not** exist for Checkout Pro) | **Skip the mode question entirely.** Do not call `AskUserQuestion` with `header="Mode"`. Do not show "Orders API" as an option. Use `mode=preferences` silently. |
| `checkout-api` | `orders` | **Always `orders` in ALL countries.** |
| `bricks` | `payments` | **Always `payments` in ALL countries.** Bricks tokenizes client-side; server calls `POST /v1/payments`. |
| `qr` | `orders` | **Always `orders` in ALL countries.** |
| `point` | `orders` | **Always `orders` in ALL countries.** |
| `marketplace` | `orders` | Always `orders`. |
| `wallet-connect` | `orders` | Always `orders`. Never ask. |
| `subscriptions` | n/a (uses its own `preapproval` API) | Skip the mode question. |
| `money-out` | n/a (uses its own `disbursements` API) | Skip the mode question. |
| `smartapps` | n/a | Skip the mode question. |

**If `product=checkout-pro` and you are about to render a Mode picker that includes `Orders API`, abort.** The Orders API is not available for Checkout Pro today. Period. Do not "future-proof" by offering it. Do not add a "Recommended" tag to it. Do not include it in any "Other" fallback.

### LOCK 3 — Always use `init_point`, never `sandbox_init_point`

Mercado Pago removed the sandbox environment. There is no staging URL. Every integration — including test-user flows — runs against the production API.

**Never generate code that references `sandbox_init_point`.** Always use `init_point` from the preference response. The difference between a test run and a production run is only which credentials are loaded (`APP_USR-` from a test user vs. a real account) — not the URL.

If you find `sandbox_init_point` in existing code, flag it as a bug: the redirect will fail silently or land on an error page.

**Also applies to test users:** test users created via `create_test_user` operate against the production API using `APP_USR-` credentials. There is no separate test base URL, no `TEST-` prefix, and no toggle. Code using `sandbox_init_point` with test-user credentials will not work.

### LOCK 4 — Tabs row must reflect only the questions that will actually be asked

The wizard's Tabs row at the top (the `□ Country  □ Product  □ Mode  ✓ Submit` line) must include **only** the dimensions that are actually still unresolved AND non-skipped per LOCK 1 and LOCK 2. Concretely:

- Never include "SDK" in the tabs — see LOCK 1.
- Never include "Mode" in the tabs when `product` is `checkout-pro` / `bricks` / `wallet-connect` / `subscriptions` / `money-out` / `smartapps`.
- Never include "Environment" in the tabs.

---

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

| Dimension | 0th: agent inference (Step 1.a) | 1st: persisted | 2nd: repo signals | 3rd: ask |
|-----------|--------------------------------|----------------|-------------------|----------|
| `product` | If agent resolved from message keywords → **use it, skip question** | Read from `.mp-integrate-progress.md` | — | `AskUserQuestion` picker |
| `country` | If agent resolved from message keywords → **use it, skip question** | Read from `.mp-integrate-progress.md` | **None — do not grep for country** (unreliable, costs tokens) | `AskUserQuestion` picker. **Persist the answer**. |
| `sdk` | — | — | **MUST run `Glob` for**: `package.json`→node, `pyproject.toml`/`requirements.txt`→python, `pom.xml`/`build.gradle*`→java, `composer.json`→php, `Gemfile`→ruby, `*.csproj`/`Program.cs`→dotnet, `go.mod`→go. Single match → resolved, do NOT ask. | `AskUserQuestion` (only if no manifest or polyglot) |
| `client` | — | — | Inspect `package.json` deps: `react`/`next`→react, `react-native`/`expo`→react-native, `*.xcodeproj`→ios, Android `build.gradle`→android, `pubspec.yaml`→flutter. Single match → resolved. | `AskUserQuestion` (only if product has client component AND ambiguous) |
| `lang` | — | — | Derive from country (BR→pt, others→es). | Almost never asked — defaulted from country |
| `mode` | — | Read from progress file | `Grep` for `/v1/orders`/`order.create`→orders; `/v1/payments`/`payment.create`→payments; `/v1/checkout/preferences`/`preference.create`→preferences. Product Matrix may pin to single value (e.g. checkout-pro → always preferences). | `AskUserQuestion` (only when matrix allows >1 AND grep didn't disambiguate) |

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
  - `"No, let me correct"` — drop ALL auto-resolved values back into the wizard queue and ask each one via `AskUserQuestion` in Step 1.b. Do not try to guess which one was wrong; let the developer reset.

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
| 5 | `qr-mode` | "QR mode" | Only when `product=qr`. Options: `static` / `dynamic` / `attended`. |
| 6 | `recurrent` | "Recurrent" | Only when the matrix marks it `yes` for the chosen product. Options: `yes` / `no`. |
| 7 | `3ds` | "3DS" | Only when the matrix marks it `yes`. Options: `yes` / `no`. |
| 8 | `marketplace` | "Splits" | Only when the matrix marks it `optional`. Options: `yes` / `no`. |

**`sdk` is intentionally absent from this table** — see LOCK 1 above. The SDK is never asked via `AskUserQuestion`.

**`environment` is NEVER asked.** Mercado Pago no longer has a sandbox/production toggle. Both production credentials and test-user credentials use the `APP_USR-` prefix; the difference is whether the credentials belong to a real account or a test user (handled in `mp-test-setup`). Do not present an "Environment: production / test" picker. Do not write code that branches on `NODE_ENV` to switch MP base URLs.

### Step 1.b.ii — Validate `mode` against the MCP before offering

The Product Matrix below is a static fallback. Mercado Pago's API surface evolves (Orders API is being extended to more products over time), so before offering `mode` options for a product, **validate against the MCP**:

1. Call `mcp__plugin_mercadopago_mcp__search_documentation` with a query like `"{product} orders api {country}"` (e.g. `"checkout-api orders api argentina"`). Never run this query for `checkout-pro` — LOCK 2 already forbids Orders for that product.
2. Inspect the results:
   - If the docs explicitly say the Orders API is available for this product → include `orders` in the offered options.
   - If the docs only mention preferences/payments and never Orders for this product → **do NOT include Orders**, even if the developer asks for it.
3. Cross-check with the Product Matrix below. If the matrix and the MCP disagree, **trust the MCP** and update your understanding for this run; the matrix is the static fallback, not the source of truth.

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
| `bricks` | yes (server) | yes | **`payments` (ALL countries)** — server calls `POST /v1/payments` | yes (payment, card-payment) | yes (payment, card-payment, status-screen) | optional | `brick=` |
| `qr` | yes | n/a | **`orders` (ALL countries)** | n/a | n/a | n/a | `qr-mode=` |
| `point` | yes | n/a | **`orders` (ALL countries)** | n/a | n/a | n/a | n/a |
| `subscriptions` | yes | n/a | n/a (own `preapproval` API) | implicit | n/a | optional | n/a |
| `marketplace` | yes | n/a | **`orders` (ALL countries)** | n/a | n/a | implicit | n/a |
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

## Step 3 — Resolve docs and context

Resolve documentation in **tiers**. The official `llms.txt` per country is always fresh — fetch it first since the developer has internet and the file is a few KB. Fall back gracefully if unreachable.

| Tier | Source | Auth | When |
|------|--------|------|------|
| 1 | `https://www.{country_domain}/developers/llms.txt` (WebFetch — official, always current) | none | **Always first** — fetch using resolved country domain. If fails (403, timeout), fall to tier 2. |
| 2 | `{plugin_base}/skills/mp-integrate/references/products.md` (bundled) | none | **Always** — product guides, API reference, code snippets, country-specific test cards. |
| 3 | `mcp__plugin_mercadopago_mcp__search_documentation` | MCP OAuth | **Fallback only** — when tiers 1–2 don't cover the product/country combination. |

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

**If MCP is not authenticated at tier 4:** call `mcp__plugin_mercadopago_mcp__authenticate` immediately and show:
> To access live Mercado Pago documentation, open this link to connect: **[Connect Mercado Pago]({url})**
> When you see "Authentication Successful" in the browser, come back and continue.

When the user returns, call `application_list` directly (do NOT call `complete_authentication` first), then retry `search_documentation`.

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
| Money out / disbursement | `"disbursement {sdk}"` |

Do **not** issue more than 3 queries. If a query returns generic results, refine once and stop.

### When MCP returns documentation but no code snippet (honest fallback)

If `search_documentation` returns a result that contains **only overview or landing prose** (no code blocks), do NOT fabricate code. Output exactly:

> **No verified snippet available** for {product} / {country} / {sdk}.
> The MCP returned documentation for this combination but no code snippet. Review the guide manually: `https://{DOMAIN}/developers/{LANG}/docs/{product-slug}/overview`

Then stop. Specifically:

- **Do NOT reconstruct code from training-data memory** — a reconstructed snippet (this is what produced the `CardForm` hallucination) must never be presented as if it were MCP-verified.
- **Do NOT use WebFetch as a substitute** — tiers 1 and 2 are bundled files; tier 3 is MCP. There is no WebFetch tier in this hierarchy.
- **Label the output explicitly** as "No verified snippet available" so the developer knows the difference between verified and unavailable.

---

## Step 4 — Assemble the bundle

Render the result with this exact structure. Code blocks come from MCP responses (verbatim where possible). Do not invent payloads or endpoints.

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
{snippet from MCP — server-side creation, e.g., create order/preference/subscription/disbursement}
```

## 4. Client code (if applicable)

**Always show the total amount above the payment form** (do not bury it inside the brick):

```html
<!-- Total amount — always visible above the payment form -->
<p class="checkout-total">Total: <strong>{currency} {amount}</strong></p>
```

```{language}
{snippet from MCP — tokenization, brick mount, redirect, etc.}
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

1. **Install the SDK** — run `npm install mercadopago` (or the equivalent for the detected SDK) in the directory that contains the server-side manifest. Report any non-zero exit code and stop.
2. **Write the server snippet** — create or edit the server file (e.g., `backend/index.js`, `backend/src/routes/mercadopago.js`) inserting the snippet from Step 4. If the file already exists, inject the new route after existing routes rather than overwriting.

2.5. **`checkout-api` only — Payment trigger button** (skip for all other products):

   Scan the project for any element that looks like a payment trigger area. Run two `Bash` passes:

   **Pass 1 — elements by ID/class containing payment keywords (language-agnostic):**
   ```bash
   grep -rn -i \
     -e 'id="[^"]*\(pay\|checkout\|pago\|pagar\|pagamento\|compra\|payment\)[^"]*"' \
     -e "id='[^']*\(pay\|checkout\|pago\|pagar\|pagamento\|compra\|payment\)[^']*'" \
     -e 'class="[^"]*\(pay\|checkout\|pago\|pagar\|pagamento\|compra\|payment\)[^"]*"' \
     --include="*.html" --include="*.jsx" --include="*.tsx" --include="*.vue" \
     . 2>/dev/null | head -20
   ```

   **Pass 2 — button/div text that looks like a payment call-to-action:**
   ```bash
   grep -rn -i \
     -e '<button[^>]*>\s*\(pay\|pagar\|checkout\|finalizar\|comprar\|pagar\|ir\s*ao\s*pagamento\|proceder\|proceed\)' \
     -e 'coming.soon\|próximamente\|em\s*breve\|en\s*construcción\|add.*payment\|integrar.*pago' \
     --include="*.html" --include="*.jsx" --include="*.tsx" --include="*.vue" \
     . 2>/dev/null | head -20
   ```

   **Evaluate the results:**

   - **No matches at all:** Output the warning and snippet below — do not block the flow.
   - **Exactly one clear match:** Tell the user what was found (`{file}:{line}: {matched line}`) and offer to inject the trigger button there.
   - **Multiple matches:** Show all candidates with file and line, then ask via `AskUserQuestion`:
     - header: `"Payment location"`
     - Question: *"I found multiple potential payment areas. Which one should receive the Mercado Pago checkout form?"*
     - Options: one per candidate (show filename + matched text, max 4; add "None of these" as Other)

   **When injecting into an identified location:**
   - Edit the file at that location. Replace the matched element (or inject immediately after it) with:
   ```html
   <!-- Mercado Pago payment trigger — generated by /mp-integrate -->
   <button id="mp-pay-btn" onclick="mpShowForm()">
     💳 Pagar con Mercado Pago
   </button>
   <div id="mp-form-container" style="display:none">
     <!-- Checkout API form mounts here — do not remove this div -->
   </div>
   ```
   Inject this helper in the file's `<script>` block (create one before `</body>` if none exists):
   ```js
   function mpShowForm() {
     document.getElementById('mp-form-container').style.display = 'block';
     document.getElementById('mp-pay-btn').style.display = 'none';
   }
   ```
   Adapt button classes to match the project's existing style (copy classes from nearby buttons if present).
   Update the client snippet from Step 4 to mount the form inside `#mp-form-container`.

   **Warning + snippet when nothing was found (or user chose "None of these"):**
   ```
   ⚠️  Integration code is ready, but no payment button was found in your project.
       Add the snippet below wherever "Pay now" should appear in your UI:
   ```
   ```html
   <!-- Place this where your payment button should appear -->
   <button id="mp-pay-btn" onclick="mpShowForm()">
     💳 Pagar con Mercado Pago
   </button>
   <div id="mp-form-container" style="display:none">
     <!-- Checkout API form mounts here — do not remove this div -->
   </div>
   <script>
   function mpShowForm() {
     document.getElementById('mp-form-container').style.display = 'block';
     document.getElementById('mp-pay-btn').style.display = 'none';
   }
   </script>
   ```
   The client code from Step 4 must mount the Checkout API form inside `#mp-form-container`.

3. **Write the client component** — create `frontend/src/components/CheckoutButton.{jsx|tsx|vue|…}` (or the framework-appropriate path/extension) with the client snippet from Step 4. If the file already exists, warn and ask the developer before overwriting.
4. **Create `.env.example`** — write the template vars (MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, APP_URL) to `.env.example`. Only create `.env` with real values if credentials were already fetched via `get_credentials` in Step 0.b (State A) — in that case `.env` already exists; do NOT overwrite it. In State B (no MCP), never create `.env` — the developer must fill in their own credentials.
5. **Update `.gitignore`** — add `.env`, `.env.*.local`, `.mp-integrate-progress.md` if not already present.
6. After all writes, print a short summary:

```
✓ npm install mercadopago — OK
✓ backend/index.js — route /api/create-preference added
✓ frontend/src/components/CheckoutButton.jsx — created
✓ .env.example — created (fill in your credentials)
✓ .gitignore — updated
```

**Scaffold guardrails:**
- Never write to files outside the current working directory.
- **If credentials were fetched via `get_credentials`:** `.env` was already created in Step 0.b with real values — do NOT overwrite it here. Only create `.env.example` with placeholders.
- **If credentials were NOT fetched (State B):** create `.env.example` with `APP_USR-...` placeholders. Never create `.env` here.
- If a target file exists and the developer said "write all", inject code rather than overwrite — show a `+diff`-style preview of what changed.
- If any write fails, report the exact error and stop; do not continue to the next file.
- **HTML placeholder injection (vanilla JS projects):** When generating server-side code that injects a placeholder (e.g., `%MP_PUBLIC_KEY%`) into an HTML file at runtime, always use a **regex with the global flag** — never a plain string replace. Example: `.replace(/%MP_PUBLIC_KEY%/g, ...)` not `.replace('%MP_PUBLIC_KEY%', ...)`. A plain string replace only substitutes the first occurrence; if the placeholder also appears in an HTML comment (e.g., `<!-- %MP_PUBLIC_KEY% is injected here -->`), the comment is replaced and the actual code line is left with the literal placeholder, silently breaking the SDK initialization. Same rule applies to any other placeholder token (`%MP_ACCESS_TOKEN%`, `%APP_URL%`, etc.).

---

## Step 5 — Suggest next steps

Always close with:

1. **Run `/mp-integrate webhook`** to add the webhook receiver (HMAC validation included).
2. **Run `/mp-integrate test-setup`** to create a test user and load funds.
2.5. **For Orders API products (checkout-api / qr / point — ALL countries):** Ask via `AskUserQuestion` before listing next steps:
   - Question: *"Orders API requires a test buyer user to process payments. Do you want me to create one now?"*
   - Options: `"Yes, create test user now"` → invoke `mp-test-setup` skill inline; `"No, I'll do it later"` → show reminder: *"⚠️ Run `/mp-integrate test-setup` before testing — Orders API returns 422 without a test user."*
   - Note: Bricks uses Payments API (`/v1/payments`), not Orders API — this step does not apply to Bricks.

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
- **`total_amount` and `amount` must be `"10.00"` not `"10"`** — use `Number(x).toFixed(2)`.
- **Brazil (MLB)**: this product is called **Checkout Transparente** — use that name in MCP queries.
- Card tokens are single-use and expire in 7 days.
- Always send an idempotency key on payment creation; retries without it create duplicate charges.

### bricks
- **Server-side uses Payments API, not Orders API.** The Brick tokenizes the card client-side and calls `onSubmit` with the token. Your backend must call `POST /v1/payments` (not `/v1/orders`) with `transaction_amount`, `token`, `installments`, `payment_method_id`, and `payer.email`.
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
- **Status Screen Brick needs a `payment_id`** — extract it from the `POST /v1/payments` response (`response.id`) and pass it to the brick. Do not pass an order ID.
- **React: call `brickController.unmount()` in the `useEffect` cleanup** before re-mounting. Re-rendering without unmounting leaves zombie listeners that break form submission silently.
- **`back_urls` must be on the same origin as the page that mounts the brick.** Cross-domain back_urls fail silently — the redirect after payment lands on a blank page with no error.

### qr
- Static QR (printed sticker) requires **Store + POS** to be created via API before generating the QR — they are not auto-created.
- Dynamic QR has a short TTL — generate one per buyer interaction, not one shared QR.
- Attended QR (cashier app) with Orders API uses the `orders` topic. Legacy attended QR flows through `merchant_orders` — wire the webhook to `merchant_order` topic only if using the legacy API.

### point
- The device must be paired to a User ID (not the application). A device paired to the wrong user will silently reject `payment_intent`s.
- After a firmware update the device may take ~2 minutes to come back online; do not retry `payment_intent` creation aggressively.
- Webhook topic for Point (Orders API) is `orders`. The legacy `point_integration_wh` topic belongs to the old Point Integration API — do not use it for new integrations.

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
- **Requires direct contact with the Mercado Pago team** — SmartApps is not self-service. Do not scaffold without confirming the developer has an active agreement with MP.
- Smart Apps run on Point devices — code limits and APIs differ from server SDKs. Always query MCP for the SmartApp-specific guide.

---

## What this skill does NOT do

- It does **not** validate webhooks. Use the `mp-webhooks` skill (or `/mp-integrate webhook`).
- It does **not** create test users. Use the `mp-test-setup` skill (or `/mp-integrate test-setup`).
- It does **not** evaluate integration quality. Use the `mp-review` skill (or `/mp-review`).
- It does **not** invent code from memory. Snippets come from the WebFetched official `llms.txt` per country (tier 1), `references/products.md` (tier 2), or MCP `search_documentation` (tier 3 fallback). Never from training-data memory alone.
