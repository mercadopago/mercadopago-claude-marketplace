# Mercado Pago — Product Reference
# Version: 4.3.1 | Updated: 2026-08-21
# Source: Official Mercado Pago developer documentation
#
# This file is tier-2 in the documentation hierarchy:
#   (1) WebFetch official llms.txt per country → (2) this file → (3) MCP search_documentation
#
# Contains: product descriptions, when to use each, best practices, key payload fields,
# SDK component map, and test card data per country.

---

## @mercadopago/sdk-react — Component Map

| Component | Use for | Notes |
|-----------|---------|-------|
| `CardPayment` | Card-only payment form (Checkout API / Bricks) | Tokenizes card, calls your server on submit |
| `Payment` | Full multi-method form (cards + wallets + cash) | Superset of CardPayment |
| `Wallet` | Mercado Pago wallet button (one-click) | Buyer must be logged into MP account |
| `StatusScreen` | Post-payment result screen | Requires `payment_id`, NOT `order_id` |
| ~~`CardForm`~~ | **Does not exist** | Use `CardPayment`. Any `CardForm` import is a hallucination. |

Install: `npm install @mercadopago/sdk-react`
Vanilla JS CDN: `<script src="https://sdk.mercadopago.com/js/v2"></script>`

---

## Products

---

### Checkout Pro

**What it is:** Hosted redirect checkout. The buyer leaves your site, pays on Mercado Pago's secure page, and returns via `back_url`. Mercado Pago handles all card data — no PCI scope for you.

**When to use:**
- You want the fastest integration with minimal frontend work
- You don't need to keep the buyer on your page during payment
- You want Mercado Pago's full payment method catalog (saved cards, MP balance, cash, BNPL) with zero configuration

**When NOT to use:**
- You need the buyer to stay on your page (use Bricks or Checkout API instead)
- You need granular control over the payment form layout

**Key payload fields (create preference):**
```json
{
  "items": [{ "title": "Product", "quantity": 1, "unit_price": 100.0, "currency_id": "ARS" }],
  "back_urls": {
    "success": "https://yoursite.com/success",
    "failure": "https://yoursite.com/failure",
    "pending": "https://yoursite.com/pending"
  },
  "auto_return": "approved",
  "notification_url": "https://yoursite.com/webhooks/mp",
  "external_reference": "order-uuid-here",
  "statement_descriptor": "YOUR STORE"
}
```

**Use `init_point`** from the preference response to redirect the buyer. Never use `sandbox_init_point` (deprecated, returns errors).

**Best practices:**
- Always set `external_reference` for reconciliation
- Always verify payment status server-side after redirect — never trust `back_url` query params alone
- `auto_return: "approved"` requires `back_urls.success` set; otherwise silently ignored
- `currency_id` must match the country (ARS, BRL, MXN, CLP, COP, PEN, UYU)
- The Orders API does NOT exist for Checkout Pro — always use `/checkout/preferences`

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/checkout-pro/landing

---

### Checkout API (Orders mode)

**What it is:** Card payments processed entirely on your page. Buyer never leaves your site. Full control over the UI. Also called **Checkout Transparente** in Brazil.

**When to use:**
- You need the buyer to stay on your page
- You want full UI customization
- You're building a card-only or card-primary checkout

**Modes:**
- `orders` (recommended, new integrations) — uses `/v1/orders`
- `payments` (legacy) — uses `/v1/payments`. Still works but being deprecated.

**Flow (Orders mode):**
1. Client tokenizes the card via Mercado Pago JS SDK or Bricks `CardPayment`
2. Client sends card token + amount to your server
3. Server creates an order via `POST /v1/orders` with the card token
4. Server returns order status to client

**Key order creation payload:**
```json
{
  "type": "online",
  "processing_mode": "automatic",
  "total_amount": "100.00",
  "external_reference": "order-uuid",
  "payer": { "email": "buyer@example.com" },
  "transactions": {
    "payments": [{
      "amount": "100.00",
      "payment_method": {
        "id": "master",
        "type": "credit_card",
        "token": "<card_token_from_frontend>",
        "installments": 1,
        "statement_descriptor": "YOUR STORE"
      }
    }]
  }
}
```

**Best practices:**
- Always send `X-Idempotency-Key` header on every creation request
- `issuer_id` is required for some BINs in Argentina — include it when returned by tokenization
- Card tokens are single-use and expire in 7 days
- `installments` is required even for 1 in Argentina (MLA)
- For 3DS: set `binary_mode: false` on the payment to allow `pending` status (3DS challenge)
- Brazil queries: use "checkout transparente orders node brazil" in MCP `search_documentation`

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/checkout-api/landing

---

### Checkout Bricks

**What it is:** Modular, pre-built React/JS UI components that handle card tokenization, payment method selection, and status display. PCI-compliant without touching card data directly.

**When to use:**
- You want a polished, ready-made checkout UI with minimal frontend work
- You want card tokenization handled by Mercado Pago (no PCI scope)
- You need to support multiple payment methods (cards + cash + wallet)

**Variant contracts:**

| Variant | SDK component | Backend behavior |
|---|---|---|
| Card Payment | `CardPayment` / `cardPayment` | Tokenizes card; `onSubmit` creates a Payments API payment |
| Payment | `Payment` / `payment` | Multi-method form; `onSubmit` creates the selected method through Payments API |
| Wallet | `Wallet` / `wallet` | Mount with a preference created dynamically at `/checkout/preferences` |
| Status Screen | `StatusScreen` / `statusScreen` | Mount with an existing Payments API `payment.id`; does not create a payment |

**Critical behavior:**
- `onSubmit` for Payment/Card Payment must return a Promise and settle only after the server response. Returning void leaves the Brick loading.
- Wallet preference IDs are generated server-side per checkout session. Never hardcode a placeholder; the preferences path has no version segment.
- Status Screen receives `paymentId`, not an Orders API order ID.
- The vanilla mount container must exist before `bricksBuilder.create()`; retain and unmount the returned controller before rebuilding it.
- React SDK components manage their own controller lifecycle.
- Ad-blockers can block `sdk.mercadopago.com` and produce `FIELDS_SETUP_FAILED`.
- Debit cards do not show an installments selector; that is expected behavior.
- Show the trusted total above Payment/Card Payment and scaffold initializing, processing, success, and actionable error states.
- Load `MP_PUBLIC_KEY` through the framework's public configuration mechanism or a no-store runtime JSON endpoint; never substitute a placeholder into cached HTML.

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/checkout-bricks/landing

---

### QR Code

**What it is:** In-person payments where buyers scan a QR code on a display or printed sticker to pay via the Mercado Pago app.

**When to use:**
- Physical point of sale (retail, restaurants, events)
- Self-service kiosks
- Cashierless checkout

**Modes:**
| Mode | Use case | TTL |
|------|----------|-----|
| Static | Fixed QR per POS — buyer enters amount or amount is preset | No TTL |
| Dynamic | One QR per transaction — most secure and auditable | Short TTL per transaction |
| Hybrid | Static QR + amount displayed on screen | Per transaction |

**Setup flow (all QR modes):**
1. Create a Store via the Stores API
2. Create a POS linked to that store via the POS API and retain its `external_id` and static QR response
3. Create a QR order via `POST /v1/orders` with `type: "qr"`, `config.qr.external_pos_id`, and `config.qr.mode`
4. Display the QR to the buyer
5. Receive webhook notification when buyer pays

**Best practices:**
- Store + POS are prerequisites and are never silently auto-created with an invented address
- Dynamic and hybrid use `type_response.qr_data`; static uses the QR returned by POS creation
- Wire new integrations only to the `orders` topic
- Use `external_pos_id` for reconciliation across multiple registers

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/qr-code/landing

---

### MP Point

**What it is:** Physical card reader terminals (Point Smart 1, Point Smart 2) controlled through the Orders API. Accepts chip, NFC, magnetic stripe, and QR.

**When to use:**
- Physical retail with unified POS management
- Businesses needing automatic reconciliation across terminals
- When you want to create payment intents from your system and push them to a device

**Flow:**
1. Pair the physical terminal to a User ID (NOT just the application) and enable PDV mode
2. Create a `type: "point"` order via `POST /v1/orders` with `config.point.terminal_id`
3. The terminal loads the order and the buyer pays on the device
4. Receive an `orders` webhook and reconcile the returned order/payment IDs

**Testing without hardware:**
- Use the standard virtual terminal `NEWLAND_N950__SBX0000001` with app test credentials
- Create a fresh order per scenario and simulate the result through `POST /v1/orders/{order_id}/events`
- Exercise `processed`, `failed`, `refunded`, `canceled`, `expired`, and `action_required`
- The virtual terminal is not valid for official integration-quality measurement or final hardware validation

**Critical gotchas:**
- New integrations must use Orders API; `/point/integration-api/.../payment-intents` is deprecated
- Use `type: "point"` and `config.point.terminal_id`; `type: "instore"` and `config.device.id` are invalid for this flow
- A production device must be paired to the correct User ID — wrong user pairing silently rejects orders
- After a firmware update the device may take ~2 min to come back online; don't retry aggressively
- Webhook topic for Orders API is `orders`. The legacy `point_integration_wh` topic belongs to the old API — do not use for new integrations
- A physical terminal is still required for final card, PIN, printing, connectivity, and production checks

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/mp-point/landing

---

### Subscriptions

**What it is:** Recurring automated payments on a weekly, monthly, or yearly schedule. Mercado Pago handles retries on failure.

**When to use:**
- SaaS, memberships, clubs
- Donation platforms (variable amounts)
- Subscription boxes or recurring services

**Three integration contracts:**
| Contract | How | Buyer experience |
|-------|-----|---------|
| With plan | Provision a reusable `preapproval_plan`; create each `preapproval` with its server-controlled ID, a secure card token, and `authorized` status | Card is tokenized on the merchant page |
| Without plan, authorized | Create `preapproval` with trusted recurrence terms, a secure card token, and `authorized` status | Card is tokenized on the merchant page |
| Without plan, pending | Create `preapproval` with trusted recurrence terms and `pending` status, without a token | Redirect buyer to returned `init_point` to select a payment method |

**Minimal payloads:**
```jsonc
// With plan
{
  "preapproval_plan_id": "<server-controlled-plan-id>",
  "payer_email": "subscriber@example.com",
  "card_token_id": "<single-use-secure-token>",
  "external_reference": "subscription-uuid",
  "back_url": "https://yoursite.com/subscription/confirm",
  "status": "authorized"
}

// Without plan, pending
{
  "reason": "Monthly membership",
  "external_reference": "subscription-uuid",
  "payer_email": "subscriber@example.com",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": 100,
    "currency_id": "BRL"
  },
  "back_url": "https://yoursite.com/subscription/confirm",
  "status": "pending"
}
```

**Best practices:**
- A `preapproval` without `preapproval_plan_id` cannot be migrated to a plan later — choose model upfront
- Never ask a buyer to paste a token and never collect raw card fields. Authorized contracts tokenize with MercadoPago.js CardForm or Card Payment Brick; pending omits the token and redirects through `init_point`.
- Plan ID, amount, currency, frequency, billing rules, and trial settings are trusted server-side configuration, not browser input.
- Associated-plan subscriptions do not repeat browser-supplied recurrence terms; the plan owns them.
- Recurring charges retry automatically on failure; `paused` status is reachable both manually and after N failed attempts
- `back_url` for plan signup must be HTTPS in production
- Monitor `subscription_preapproval_plan`, `subscription_preapproval`, `subscription_authorized_payment`, and `payments` webhook topics as applicable

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/subscriptions/landing

---

### Marketplace

**What it is:** Split Payments 1:1 where each connected seller authorizes the marketplace through OAuth and the selected checkout applies the platform commission.

**When to use:**
- Platforms with multiple sellers (e marketplace, on-demand services, gig economy)
- When you need to split a payment between your platform and a seller

**How it works:**
1. Seller authorizes your platform via OAuth flow → you receive seller's access token
2. Resolve the trusted seller/cart and create the selected checkout using the seller OAuth token
3. Funds split automatically at settlement

**Supported contracts:**
- Checkout Pro: exactly `/checkout/preferences` + `marketplace_fee`
- Checkout API/Transparente: `/v1/payments` + `application_fee`
- Wallet Brick: exactly `/checkout/preferences` + `marketplace_fee`, dynamic `preferenceId`, and `marketplace: true`

**Checkout API key payload:**
```json
{
  "transaction_amount": 100.0,
  "application_fee": 5.0,
  "token": "<single_use_card_token>",
  "installments": 1,
  "external_reference": "<trusted_order_id>"
}
```

**Best practices:**
- Generate and consume one-time OAuth `state`; require the exact configured redirect URI
- Encrypt seller access/refresh tokens at rest and rotate both values atomically on refresh
- Use the seller OAuth access token in the backend Authorization header; never expose it to the browser
- Derive seller, items, amount, and commission from trusted server-side state
- Do not add `collector_id` to the payment payload; OAuth `user_id` is stored as the seller connection identity
- Sellers must explicitly authorize your platform — there is no silent linking

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/split-payments/split-1-1/overview

---

### Wallet Connect

**What it is:** One-click payments using the buyer's saved credentials in their Mercado Pago wallet, without re-entering card details.

**Availability:** Commercially enabled product, not self-service. Confirm that
Mercado Pago enabled the application before scaffolding or calling its APIs.

**When to use:**
- Mobile commerce apps where buyers already have MP accounts
- Reducing checkout friction for returning buyers
- Subscription-like flows where you want to reuse buyer's saved payment method

**Flow:**
1. Server creates an agreement and redirects the buyer to the returned approval URI
2. Buyer explicitly approves linking in the Mercado Pago wallet UI
3. Server exchanges the one-time approval code for a payer token and stores it encrypted
4. Server uses that payer token to create an idempotent `online` order through Orders API

**Best practices:**
- Buyer must explicitly approve the linkage via MP wallet UI — no silent linking possible
- The payer token and approval code are server-only; never return, log, or store them in the browser
- Derive buyer identity, purchase amount, and reconciliation reference from authenticated server state
- Once linked, payments use buyer's saved methods — do not pass card details or load MercadoPago.js
- Orders use `type: "online"`, wallet payment method, matching two-decimal amounts, and a unique idempotency key
- Handle webhook notifications for agreement status changes and order reconciliation
- Do not substitute Wallet Brick or Advanced Payments for the Orders API contract

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/wallet-connect/landing

---

### Payouts (legacy alias: Money Out)

**What it is:** A privileged, server-only transfer from the integrator's
Mercado Pago balance to trusted destination accounts. It is not a buyer
checkout, Marketplace split, Advanced Payment, or public withdrawal form.

**Country boundary:** The current contract is country-specific. Argentina uses
batch Payouts; Brazil uses a single Transaction Intent. Resolve the site before
scaffolding and never copy one country's payload into another. For any other
country, require a verified current country guide before generating code.

**Critical boundaries:**
- Require operator authorization and load destination, amount, currency, and
  reconciliation data from durable trusted server state
- Persist one idempotency key per logical instruction and reconcile accepted
  resources asynchronously through lookup plus Webhooks
- Make test mode explicit and isolated from production
- Sign the exact serialized production body with the registered Ed25519 key
- Do not add a CTA, public payment page, card fields, MercadoPago.js, or a
  public key

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/payouts/overview

---

### SmartApps

**What it is:** A private business-management application distributed to
Mercado Pago Point Smart terminals through a closed approval process. Main apps
become the terminal's primary interface; mini apps are launched from the
terminal marketplace.

**Non-negotiable prerequisites:**
- Active contact/agreement with the Mercado Pago business and integration team
- Android target application and Android Studio
- Private development kit with the current SmartApps AAR
- Mercado Pago development terminal with the approved test firmware for full testing

**Critical boundaries:**
- Never scaffold into a web/backend/iOS project as if it were a SmartApp
- Always query the authenticated MCP for the current product guide
- Ask before copying/updating the private AAR and use only the latest artifact
  confirmed by the integration team
- Payment and terminal capabilities are invoked through the SmartApps SDK, not
  through direct Android hardware permissions or browser/server SDKs
- Static validation does not replace compilation with the real AAR, tests on a
  development terminal, or Mercado Pago homologation

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/smartapps/overview

---

## Test Cards per Country

All cards: expiry `11/30` | CVV `123` (Amex: `1234`)
Set cardholder name to a status code to force the outcome:

| Code | Result |
|------|--------|
| `APRO` | Approved |
| `FUND` | Declined — insufficient funds |
| `CONT` | Pending |
| `OTHE` | Declined — general error |
| `CALL` | Declined — requires authorization |
| `SECU` | Declined — invalid CVV |
| `EXPI` | Declined — expired card |
| `FORM` | Declined — form error |
| `DUPL` | Rejected — duplicate |
| `LOCK` | Rejected — card disabled |

### Argentina (MLA)

| Type | Brand | Number | Document |
|------|-------|--------|----------|
| Credit | Mastercard | 5031 7557 3453 0604 | DNI 12345678 |
| Credit | Visa | 4509 9535 6623 3704 | DNI 12345678 |
| Credit | Amex | 3711 803032 57522 | DNI 12345678 |
| Debit | Mastercard | 5287 3383 1025 3304 | — |
| Debit | Visa | 4002 7686 9439 5619 | — |

### Brazil (MLB)

| Type | Brand | Number | Document |
|------|-------|--------|----------|
| Credit | Mastercard | 5031 4332 1540 6351 | CPF 12345678909 |
| Credit | Visa | 4235 6477 2802 5682 | CPF 12345678909 |
| Credit | Amex | 3753 651535 56885 | CPF 12345678909 |
| Debit | Elo | 5067 7667 8388 8311 | — |

### Mexico (MLM)

| Type | Brand | Number |
|------|-------|--------|
| Credit | Mastercard | 5474 9254 3267 0366 |
| Credit | Visa | 4075 5957 1648 3764 |
| Credit | Amex | 3711 803032 57522 |
| Debit | Mastercard | 5579 0534 6148 2647 |
| Debit | Visa | 4189 1412 2126 7633 |

### Colombia (MCO)

| Type | Brand | Number | Document |
|------|-------|--------|----------|
| Credit | Mastercard | 5254 1336 7440 3564 | 123456789 |
| Credit | Visa | 4013 5406 8274 6260 | 123456789 |
| Debit | Visa | 4915 1120 5524 6507 | — |

### Chile (MLC)

> Official page blocks automated fetch — numbers below are from a prior known version. Verify at https://www.mercadopago.cl/developers/en/docs/your-integrations/test/cards or use MCP `search_documentation("test cards chile")`.

| Type | Brand | Number |
|------|-------|--------|
| Credit | Mastercard | 5416 7526 0258 2580 |
| Credit | Visa | 4168 8188 4444 7115 |
| Credit | Amex | 3757 781744 61804 |
| Debit | Mastercard | 5241 0198 2664 6950 |
| Debit | Visa | 4023 6535 2391 4373 |

### Peru (MPE)

| Type | Brand | Number | Document |
|------|-------|--------|----------|
| Credit | Mastercard | 5031 7557 3453 0604 | 123456789 |
| Credit | Visa | 4009 1753 3280 6176 | 123456789 |
| Credit | Amex | 3711 803032 57522 | — |
| Debit | Mastercard | 5178 7816 2220 2455 | — |

### Uruguay (MLU)

| Type | Brand | Number | Document |
|------|-------|--------|----------|
| Credit | Mastercard | 5031 7557 3453 0604 | CI 12345678 |
| Credit | Visa | 4509 9535 6623 3704 | CI 12345678 |
| Debit | Visa | 4410 1036 7243 6886 | — |

---

## Update sources

Re-fetch when this reference ages:
- AR: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards
- BR: https://www.mercadopago.com.br/developers/en/docs/your-integrations/test/cards
- MX: https://www.mercadopago.com.mx/developers/en/docs/your-integrations/test/cards
- CO: https://www.mercadopago.com.co/developers/en/docs/your-integrations/test/cards
- PE: https://www.mercadopago.com.pe/developers/en/docs/your-integrations/test/cards
- UY: https://www.mercadopago.com.uy/developers/en/docs/your-integrations/test/cards
- CL: https://www.mercadopago.cl/developers/en/docs/your-integrations/test/cards (may require manual access)

---

## API Reference

> Base URL for all endpoints: `https://api.mercadopago.com`
> All requests require: `Authorization: Bearer <ACCESS_TOKEN>`
> Full reference: https://www.mercadopago.com.br/developers/pt/reference

---

### Checkout Pro — Preferences API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/checkout/preferences` | Create preference |
| GET | `/checkout/preferences/{id}` | Get preference |
| PUT | `/checkout/preferences/{id}` | Update preference |
| GET | `/checkout/preferences/search` | Search preferences |

**Create preference (Node.js):**
```js
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const preference = new Preference(client);
const result = await preference.create({
  body: {
    items: [{ title: 'Product', quantity: 1, unit_price: 100.0, currency_id: 'ARS' }],
    back_urls: { success: 'https://yoursite.com/success', failure: 'https://yoursite.com/failure' },
    auto_return: 'approved',
    notification_url: 'https://yoursite.com/webhooks/mp',
    external_reference: 'order-uuid',
  }
});
// redirect buyer to: result.init_point  (never sandbox_init_point)
```

---

### Checkout API — Orders (new, recommended)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/orders` | Create order |
| GET | `/v1/orders/{id}` | Get order |
| POST | `/v1/orders/{id}/process` | Process order |
| POST | `/v1/orders/{id}/capture` | Capture order |
| POST | `/v1/orders/{id}/cancel` | Cancel order |
| POST | `/v1/orders/{id}/refund` | Refund order |
| POST | `/v1/orders/{id}/transactions` | Add transaction to order |
| PUT | `/v1/orders/{id}/transactions/{txn_id}` | Update transaction |
| DELETE | `/v1/orders/{id}/transactions/{txn_id}` | Remove transaction |
| GET | `/v1/orders/search` | Search orders |

**Create order (Node.js):**
```js
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const order = new Order(client);
const result = await order.create({
  body: {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: '100.00',
    external_reference: 'order-uuid',
    payer: { email: 'buyer@example.com' },
    transactions: {
      payments: [{
        amount: '100.00',
        payment_method: {
          id: 'master',
          type: 'credit_card',
          token: cardToken,   // from frontend tokenization
          installments: 1,
          statement_descriptor: 'YOUR STORE',
        }
      }]
    }
  },
  requestOptions: { idempotencyKey: uuid() }
});
```

---

### Payments API (legacy — use Orders for new integrations)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/payments` | Create payment |
| GET | `/v1/payments/{id}` | Get payment |
| PUT | `/v1/payments/{id}` | Update payment (e.g. cancel) |
| GET | `/v1/payments/search` | Search payments |
| POST | `/v1/payments/{id}/refunds` | Create refund |
| GET | `/v1/payments/{id}/refunds` | List refunds |
| GET | `/v1/payments/{id}/refunds/{refund_id}` | Get refund |

**Create payment (Node.js, legacy):**
```js
const payment = new Payment(client);
const result = await payment.create({
  body: {
    transaction_amount: 100.0,
    token: cardToken,
    description: 'Product description',
    installments: 1,
    payment_method_id: 'visa',
    issuer_id: issuerId,
    payer: { email: 'buyer@example.com', identification: { type: 'CPF', number: '12345678909' } },
    notification_url: 'https://yoursite.com/webhooks/mp',
    external_reference: 'order-uuid',
  },
  requestOptions: { idempotencyKey: uuid() }
});
```

---

### Customers & Cards API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/customers` | Create customer |
| GET | `/v1/customers/{id}` | Get customer |
| PUT | `/v1/customers/{id}` | Update customer |
| GET | `/v1/customers/search` | Search customers (by email) |
| POST | `/v1/customers/{id}/cards` | Save card to customer |
| GET | `/v1/customers/{id}/cards` | List customer cards |
| GET | `/v1/customers/{id}/cards/{card_id}` | Get card |
| PUT | `/v1/customers/{id}/cards/{card_id}` | Update card |
| DELETE | `/v1/customers/{id}/cards/{card_id}` | Delete card |

**Save card to customer:**
```js
const customerClient = new Customer(client);
// First create customer, then save card token
await customerClient.createCard({ customerId: id, body: { token: cardToken } });
```

---

### Subscriptions API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/preapproval_plan` | Create plan |
| GET | `/preapproval_plan/{id}` | Get plan |
| PUT | `/preapproval_plan/{id}` | Update plan |
| GET | `/preapproval_plan/search` | Search plans |
| POST | `/preapproval` | Create subscription |
| GET | `/preapproval/{id}` | Get subscription |
| PUT | `/preapproval/{id}` | Update subscription (pause/cancel) |
| GET | `/preapproval/search` | Search subscriptions |
| GET | `/authorized_payments/{id}` | Get invoice |
| GET | `/authorized_payments/search` | Search invoices |
| GET | `/v1/payments/search` | Search underlying payments (last 12 months) |

**Create a plan (operator/deployment action) and an authorized subscription:**
```js
// Step 1: provision once; do not expose this as a buyer-facing route
const plan = await fetch('https://api.mercadopago.com/preapproval_plan', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reason: 'Monthly subscription', back_url: 'https://yoursite.com/subscription/confirm',
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 100.0, currency_id: 'BRL' },
  })
}).then(response => response.json());
// Step 2: cardToken comes only from secure MercadoPago.js tokenization
const sub = await fetch('https://api.mercadopago.com/preapproval', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    preapproval_plan_id: plan.id,
    payer_email: 'buyer@example.com',
    card_token_id: cardToken,
    external_reference: crypto.randomUUID(),
    back_url: 'https://yoursite.com/subscription/confirm',
    status: 'authorized',
  }),
});
```

---

### QR Code API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/orders` | Create QR order (`type: "qr"`) |
| GET | `/v1/orders/{id}` | Retrieve and reconcile QR order |
| POST | `/v1/orders/{id}/cancel` | Cancel a QR order while it is `created` |
| POST | `/v1/orders/{id}/refund` | Refund a processed QR order |

**Create QR order:**
```js
await fetch('https://api.mercadopago.com/v1/orders', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': randomUUID(),
  },
  body: JSON.stringify({
    type: 'qr',
    total_amount: '100.00',
    external_reference: 'order-uuid',
    config: { qr: { external_pos_id: externalPosId, mode: 'dynamic' } },
    transactions: { payments: [{ amount: '100.00' }] },
  })
});
```

---

### MP Point API (Orders API — current)

The Point endpoints migrated from the legacy Payment Intent API to the Orders API. Use the **`/terminals/v1/`** family for device management and **`POST /v1/orders`** for transactions.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/terminals/v1/list` | List terminals (filter by `store_id`, `pos_id`) |
| PATCH | `/terminals/v1/setup` | Update terminal operating mode (terminal id in body; supports batch) |
| POST | `/v1/orders` | Create order on terminal (`type: 'point'`, `config.point.terminal_id`) |
| GET | `/v1/orders/{orderId}` | Get order status |

> **Legacy (Payment Intent API) — do NOT use for new integrations:** `GET /point/integration-api/devices`, `POST /point/integration-api/devices/{deviceId}/payment-intents`. These still work but are superseded by the Orders API above.

**List terminals:**
```js
await fetch('https://api.mercadopago.com/terminals/v1/list?limit=50&offset=0', {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
});
// terminals[].id format: "NEWLAND_N950__N950NCB801293324" (type + "__" + serial)
```

**Create order on terminal:**
```js
await fetch('https://api.mercadopago.com/v1/orders', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify({
    type: 'point',
    external_reference: 'order-uuid',
    transactions: { payments: [{ amount: '15.00' }] },
    config: { point: { terminal_id: 'NEWLAND_N950__N950NCB801293324', print_on_terminal: true } }
  })
});
```

---

### Payment Methods & Identification Types

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/payment_methods` | List available payment methods |
| GET | `/v1/identification_types` | List ID types for country |

```js
// Get available payment methods for the authenticated account's country
const methods = await fetch('https://api.mercadopago.com/v1/payment_methods', {
  headers: { Authorization: `Bearer ${token}` }
});
```
