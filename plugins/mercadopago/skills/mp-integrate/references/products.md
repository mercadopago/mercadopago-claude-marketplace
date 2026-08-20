# Mercado Pago — Product Reference
# Version: 4.2.0 | Updated: 2026-06-10
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

**Components:**

#### CardPayment Brick
Card-only form. Collects number, expiry, CVV, name, ID, email. Tokenizes and calls `onSubmit`.

```jsx
import { CardPayment } from '@mercadopago/sdk-react';

<CardPayment
  initialization={{ amount: 100.00 }}
  onSubmit={async (formData) => {
    // formData.token = card token, formData.installments, formData.issuer_id
    const response = await fetch('/api/process-payment', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    return response.json(); // must return a Promise
  }}
  onError={(error) => console.error(error)}
/>
```

**Critical:** `onSubmit` MUST return a Promise. Returning void keeps the brick in loading state forever.

#### Payment Brick
Full multi-method form (cards + MP wallet + cash). Superset of CardPayment.

```jsx
import { Payment } from '@mercadopago/sdk-react';

<Payment
  initialization={{ amount: 100.00, preferenceId: '<preference_id>' }}
  onSubmit={async (formData) => { /* same as CardPayment */ }}
/>
```

Note: `preferenceId` must be created server-side per buyer session. Never hardcode a placeholder.

#### Wallet Brick
MP wallet button. Buyer must be logged into Mercado Pago.

```jsx
import { Wallet } from '@mercadopago/sdk-react';
<Wallet initialization={{ preferenceId: '<preference_id>' }} />
```

#### StatusScreen Brick
Post-payment result display. Shows success, pending, or error state.

```jsx
import { StatusScreen } from '@mercadopago/sdk-react';
<StatusScreen initialization={{ paymentId: '<payment_id_from_order>' }} />
```

**Critical:** Pass `payment_id` from `order.transactions.payments[0].id`, NOT the `order_id`.

**Best practices for all Bricks:**
- The container `<div id="...">` must exist in the DOM before `bricksBuilder.create()`
- Call `brickController.unmount()` in React `useEffect` cleanup before re-mounting
- `back_urls` must be on the same origin as the page mounting the brick
- Ad-blockers (uBlock, Brave) block `sdk.mercadopago.com` → brick shows `FIELDS_SETUP_FAILED`
- Debit cards do NOT show installment selector — this is correct, not a bug
- Always show the total amount above the brick — the brick does not display it prominently
- Always scaffold loading/success/error states; never leave them as TODOs

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

**Two models:**
| Model | How | Best for |
|-------|-----|---------|
| With plan | Create a `preapproval_plan` first, then subscriptions reference it | Multiple subscribers to the same tier |
| Without plan | Create a `preapproval` directly per subscriber | One-off or custom subscriptions |

**Key payload (preapproval with plan):**
```json
{
  "preapproval_plan_id": "<plan_id>",
  "payer_email": "subscriber@example.com",
  "card_token_id": "<token>",
  "back_url": "https://yoursite.com/subscription/confirm"
}
```

**Best practices:**
- A `preapproval` without `preapproval_plan_id` cannot be migrated to a plan later — choose model upfront
- Recurring charges retry automatically on failure; `paused` status is reachable both manually and after N failed attempts
- `back_url` for plan signup must be HTTPS in production
- Monitor `subscription_preapproval` and `subscription_authorized_payment` webhook topics

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/subscriptions/landing

---

### Marketplace

**What it is:** Split payment platform where a marketplace collects payments and distributes funds to sellers, keeping an `application_fee`.

**When to use:**
- Platforms with multiple sellers (e marketplace, on-demand services, gig economy)
- When you need to split a payment between your platform and a seller

**How it works:**
1. Seller authorizes your platform via OAuth flow → you receive seller's access token
2. Payment is created using seller's token + `application_fee` for your platform
3. Funds split automatically at settlement

**Key payload:**
```json
{
  "transaction_amount": 100.0,
  "application_fee": 5.0,
  "collector_id": "<seller_collector_id>",
  "token": "<card_token>",
  "installments": 1
}
```

**Best practices:**
- `application_fee` cannot exceed configured limits per country — check before charging
- OAuth Access Tokens for sellers expire in 6 months — always store `refresh_token` and renew before expiry
- Both `collector_id` and `application_fee` are required; missing either sends the full amount to the marketplace owner
- Sellers must explicitly authorize your platform — there is no silent linking

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/marketplace/landing

---

### Wallet Connect

**What it is:** One-click payments using the buyer's saved credentials in their Mercado Pago wallet, without re-entering card details.

**When to use:**
- Mobile commerce apps where buyers already have MP accounts
- Reducing checkout friction for returning buyers
- Subscription-like flows where you want to reuse buyer's saved payment method

**Flow:**
1. Buyer creates an agreement (authorization) linking their wallet to your app
2. You receive a payer token representing the buyer's saved method
3. Use the payer token to create payments without card data

**Best practices:**
- Buyer must explicitly approve the linkage via MP wallet UI — no silent linking possible
- Once linked, payments use buyer's saved methods — you don't pass card details
- Implement idempotency to prevent duplicate transactions
- Handle webhook notifications for agreement status changes

**Docs:** https://www.mercadopago.com.{country}/developers/en/docs/wallet-connect/landing

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
| GET | `/authorized_payment/{id}` | Get invoice |
| GET | `/authorized_payment/search` | Search invoices |
| GET | `/preapproval/{id}/payments/search` | List subscription payments |

**Create plan + subscription:**
```js
// Step 1: Create plan
const plan = await fetch('https://api.mercadopago.com/preapproval_plan', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reason: 'Monthly subscription',
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 100.0, currency_id: 'BRL' }
  })
});
// Step 2: Create subscription for a buyer
const sub = await fetch('https://api.mercadopago.com/preapproval', {
  method: 'POST',
  body: JSON.stringify({ preapproval_plan_id: plan.id, payer_email: 'buyer@example.com', card_token_id: token })
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
