# Mercado Pago — Terminology Rules
# Version: 1.0.0 | Updated: 2026-06-19
#
# PURPOSE: Anti-hallucination anchor for naming, prefixes, and deprecated terms.
# Read this file BEFORE generating any code or instructions.
# These rules override general knowledge about the Mercado Pago platform.

---

## Critical distinction — three types of credentials (never confuse them)

| Type | What it is | Where it comes from | Where it goes |
|---|---|---|---|
| **App test credentials** | `MP_ACCESS_TOKEN` + `MP_PUBLIC_KEY` for your app | DevPanel → your app → {test_tab} tab | Your `.env` file — used in backend to create orders/payments |
| **Test user login** | email + password of the simulated buyer/seller | Returned by `create_test_user` MCP tool | Used to **log in at the checkout page** during a test purchase — NEVER in `.env` |
| **Test user API credentials** | `APP_USR-` credentials of the test user account | Returned by `create_test_user` | Only needed for marketplace/OAuth flows where you act AS the test user — NOT the general MP_ACCESS_TOKEN |

**The most common error:** after creating a test user, the developer puts the test user's nickname, email, or password in the `MP_ACCESS_TOKEN` field. Never do this. `MP_ACCESS_TOKEN` always comes from DevPanel → your app → {test_tab} tab.

---

## Credentials

| ❌ Never say / use | ✅ Always say / use | Why |
|---|---|---|
| Telling dev to change prefix | Use whichever prefix the app issues — both are valid. `get_credentials` returns the correct one. |
| "legacy credentials" or "obsolete format" | "test credentials (from {test_tab})" | There is no sandbox. The difference is which DevPanel tab they come from. |
| "sandbox environment" | "test run with test-user credentials" | Mercado Pago has no sandbox. Everything runs against the production API. |
| "production vs sandbox API URL" | "same API URL, different credentials" | The base URL is always `https://api.mercadopago.com`. |

**Credential prefixes by product:**
- `APP_USR-` → Orders API, Checkout Pro, Point, QR Code
- `TEST-` → Checkout API / Payments API, Checkout Bricks, legacy

Both are valid. Never tell a developer to change prefix. `get_credentials` returns the correct format.

**Credential tabs by language:**
- Spanish → `Prueba` (test) · `Producción` (production)
- Portuguese → `Teste` (test) · `Produção` (production)
- English → `Test tab` · `Production tab`

Never combine both languages in the same term (never write "Prueba/Teste").

---

## SDK React components (`@mercadopago/sdk-react`)

| ❌ Never use | ✅ Always use | Use case |
|---|---|---|
| `CardForm` | `CardPayment` | Card-only payment form |
| `CheckoutForm` | `Payment` | Multi-method payment form |
| `PaymentForm` | `Payment` | Multi-method payment form |
| `StatusForm` | `StatusScreen` | Post-payment result screen |

`CardForm` does not exist in any version of `@mercadopago/sdk-react`. Any import of `CardForm` will silently fail with a blank screen.

`StatusScreen` requires `payment_id` — NOT `order_id`. Extract it from `order.transactions.payments[0].id`.

---

## Checkout redirect URL

| ❌ Never use | ✅ Always use |
|---|---|
| `sandbox_init_point` | `init_point` |
| `response.sandbox_init_point` | `response.init_point` |

`sandbox_init_point` was removed. Using it causes a silent redirect failure or error page.

---

## API mode naming

| ❌ Avoid | ✅ Prefer | Note |
|---|---|---|
| "legacy payments" | "Payments API (`/v1/payments`)" | Be specific about which API |
| "new orders" | "Orders API (`/v1/orders`)" | Be specific |
| "old checkout" | "Preferences API (`/checkout/preferences`)" | For Checkout Pro |
| "QR legacy" | "QR Code with Payments API" | Legacy = Payments API path |
| "orders mode" | "Orders API" | Spell it out |

---

## Mode and Orders API availability

Orders API is available in **all** countries. Default mode for card payments is `orders` everywhere.

| Country | Card payments mode | Offline methods limitation |
|---------|-------------------|---------------------------|
| AR (MLA) | `orders` | Full coverage |
| BR (MLB) | `orders` | Full coverage |
| MX (MLM) | `orders` | QR not available |
| CL (MLC) | `orders` | Full coverage |
| CO (MCO) | `orders` | Point not available · QR not available |
| PE (MPE) | `orders` | Point not available · QR not available |
| UY (MLU) | `orders` | Point not available |

For card payments:
- checkout-api: always `orders` (Orders API)
- bricks: always `payments` (Payments API — server calls `POST /v1/payments`)
For Point/QR: verify availability — use Payments API as fallback if unavailable in that country.

---

## Product naming

| ❌ Never say | ✅ Always say |
|---|---|
| "Checkout Transparente" (outside Brazil) | "Checkout API" |
| "Checkout API" (in Brazil) | "Checkout Transparente" |
| "Card Payment Form" | "CardPayment brick" |
| "Wallet button" | "Wallet brick" |
| "Status screen" | "StatusScreen brick" |
| "MP wallet" (for integration) | "Wallet Connect" |
| "POS integration" | "MP Point" |

---

## Required fields — never omit

| Context | Field | Why |
|---|---|---|
| Any order/payment creation | `X-Idempotency-Key` header | Without it, retries create duplicate charges |
| Argentina (MLA) card payment | `installments` | Required even for 1 installment |
| Argentina (MLA) card payment | `issuer_id` (when returned by tokenization) | Required for certain BINs |
| Checkout Pro redirect | `init_point` (not `sandbox_init_point`) | `sandbox_init_point` is deprecated |
| StatusScreen brick | `payment_id` (not `order_id`) | Brick expects a payment ID specifically |

---

## Card tokens

- Card tokens are **single-use** and expire in **7 days**.
- Never reuse a token across requests or sessions.
- Never store or log card tokens.

---

## Webhooks

| ❌ Deprecated | ✅ Use instead |
|---|---|
| IPN (`?id=&topic=` GET-style) | Signed webhooks with `x-signature` |
| `point_integration_wh` topic | `orders` topic (new integrations) |
| `merchant_order` topic (new code) | `orders` topic |

Always respond `200` before processing. Validate `x-signature` with HMAC-SHA256 before touching the payload.
