# Guide: Migration to Orders API — Instore (QR Code + Point)
# Updated: 2026-07-07 | Source: Official Mercado Pago migration docs
#
# PURPOSE: Field mapping reference for /mp-integrate migrate.
# Read this BEFORE proposing any diff. Always complement with the live doc
# fetched in Step 2 of SKILL-migrate.md — this file is the structural skeleton,
# the live doc confirms the latest field names.
#
# Scope: QR Instore, QR Instore V2, QR Dinámico, MP Point (PDV + Self Service)
# NOT covered: Online products (Checkout API, Marketplace, Bricks, Checkout Pro, Subscriptions)

---

## QR Instore (Órdenes presenciales)

**Doc:** https://www.mercadopago.com.ar/developers/es/docs/qr-code/migrate-instore-orders-to-orders

### Endpoint mapping

| Operation | Before | After |
|-----------|--------|-------|
| Create | `POST /mpmobile/instore/qr/{user_id}/{external_id}` | `POST /v1/orders` |
| Query | webhook-only | `GET /v1/orders/{order_id}` |
| Cancel | `DELETE /mpmobile/instore/qr/{user_id}/{external_id}` | `POST /v1/orders/{order_id}/cancel` |
| Refund | via Payments API | `POST /v1/orders/{order_id}/refund` |

### Payload mapping (create)

| Before | After | Notes |
|--------|-------|-------|
| `{user_id}` in URL path | derived from Access Token | removed from path |
| `{external_id}` in URL path | `config.qr.external_pos_id` in body | moved to body — hyphens and underscores are allowed per API docs |
| `X-Ttl-Store-Preference` header | `expiration_time` (ISO 8601 duration) | e.g. `"PT5M"` = 5 min |
| `items[].currency_id` | removed | not needed |
| `items[].unit_price` (number) | `items[].unit_price` (string decimal) | `"10.00"` not `10` |
| `items[].total_amount` | **removed entirely** | `400: items[0].total_amount is not a valid property` — strip from diff |
| `items[].description` | `description` at root level | moved up |
| `title` at root level (if present) | `description` at root level | **`title` is NOT valid** — `400: title is not a valid property`. Use `description`. Never generate both. |
| `sponsor_id` | `integration_data.sponsor.id` | nested |
| `site_id` | `country_code` (uppercase) | e.g. `"AR"` |
| — | `type: "qr"` | **new required field** |
| — | `external_reference` (max 64 chars; letters, numbers, hyphens, and underscores) | **new required field** |
| — | `transactions: { payments: [{ amount: "10.00" }] }` | **new required field for every QR mode** |
| — | `X-Idempotency-Key` header (UUID) | **new required header** |

### Status mapping

| Before | After |
|--------|-------|
| dual-topic webhook monitoring | single `status` field |
| — | `created`, `processed`, `canceled`, `refunded`, `expired` |

---

## QR Instore V2 (Órdenes presenciales V2)

**Doc:** https://www.mercadopago.com.ar/developers/es/docs/qr-code/migrate-instore-orders-v2-to-orders

### Endpoint mapping

| Operation | Before | After |
|-----------|--------|-------|
| Create | `PUT /instore/qr/seller/collectors/{user_id}/stores/{store_id}/pos/{pos_id}/qrs` | `POST /v1/orders` |
| Retrieve | `GET /instore/qr/seller/collectors/{user_id}/pos/{pos_id}/qrs` | `GET /v1/orders/{order_id}` |
| Cancel | `DELETE /instore/qr/seller/collectors/{user_id}/pos/{pos_id}/qrs` | `POST /v1/orders/{order_id}/cancel` |
| Refund | via Payments API | `POST /v1/orders/{order_id}/refund` |

### Payload mapping (create)

| Before | After | Notes |
|--------|-------|-------|
| `{user_id}` in URL path | derived from Access Token | removed |
| external_id in URL path | `config.qr.external_pos_id` | moved to body — hyphens and underscores are allowed per API docs |
| `expiration_date` (absolute) | `expiration_time` (ISO 8601 duration) | e.g. `"PT10M"` |
| amounts as numbers | amounts as string decimals | `"10.00"` not `10` |
| `external_reference` optional | `external_reference` **required** (64 chars max; letters, numbers, hyphens, and underscores) | |
| `items[].total_amount` | **removed entirely** | field does not exist in Orders API spec — strip from diff |
| — | `type: "qr"` | **new required** |
| — | `transactions: { payments: [{ amount: "10.00" }] }` | **new required for every QR mode** |
| — | `X-Idempotency-Key` header (UUID) on create AND cancel | **new required** — cancel returns `400 empty_required_header` if missing |
| response: `204 No Content` | response: `201 Created` + full order object | update response handling |

---

## QR Dinámico

**Doc:** https://www.mercadopago.com.ar/developers/es/docs/qr-code/migrate-dynamic-qr-model-to-orders

> **CRITICAL — two different legacy methods map to two different modes:**
>
> | Legacy method | `config.qr.mode` | `transactions.payments` in request |
> |---------------|------------------|------------------------------------|
> | `POST /instore/orders/qr/seller/collectors/.../qrs` | `"dynamic"` | **REQUIRED** |
> | `PUT /instore/orders/qr/seller/collectors/.../qrs` | `"hybrid"` | **REQUIRED** |
>
> Always grep the legacy file for the HTTP method before inferring the mode. Never default to `"dynamic"` without checking. A wrong mode changes QR behavior silently: `dynamic` creates a new QR per transaction; `hybrid` updates a fixed QR tied to a specific POS.

### Endpoint mapping

| Operation | Before | After |
|-----------|--------|-------|
| Create (POST legacy) | `POST /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` | `POST /v1/orders` with `mode: "dynamic"` |
| Update (PUT legacy) | `PUT /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` | `POST /v1/orders` with `mode: "hybrid"` |
| Cancel | `DELETE /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` | `POST /v1/orders/{order_id}/cancel` |

### Key changes
- `type: "qr"` required
- `config.qr.external_pos_id` replaces URL path params — hyphens and underscores are allowed per API docs
- `external_reference` required at root level (letters, numbers, hyphens, and underscores; max 64 chars)
- `transactions: { payments: [{ amount }] }` — required for `static`, `dynamic`, and `hybrid`.
- `items[].total_amount` — **remove entirely**. Field does not exist in Orders API spec. Strip it from the diff regardless of legacy value.
- `X-Idempotency-Key` — required on **both** create AND cancel (`POST /v1/orders/{id}/cancel`). Cancel returns `400 empty_required_header` if missing.

### Payload shape — dynamic (POST legacy)

```js
// ✅ POST legacy → mode: "dynamic"
{
  type: 'qr',
  external_reference: 'alphanumericOnly',
  description: '...',
  total_amount: '10.00',
  items: [{ title: '...', unit_price: '10.00', quantity: 1, unit_measure: 'unit' }],
  transactions: { payments: [{ amount: '10.00' }] },
  config: { qr: { mode: 'dynamic', external_pos_id: 'POS-001' } }
}
```

### Payload shape — hybrid (PUT legacy)

```js
// ✅ PUT legacy → mode: "hybrid" — transactions REQUIRED
{
  type: 'qr',
  external_reference: 'alphanumericOnly',
  description: '...',
  total_amount: '10.00',
  items: [{ title: '...', unit_price: '10.00', quantity: 1, unit_measure: 'unit' }],
  transactions: { payments: [{ amount: '10.00' }] },  // required for hybrid
  config: { qr: { mode: 'hybrid', external_pos_id: 'POS-001' } }
}
```

---

## MP Point (PDV + Self Service)

**Doc PDV:** https://www.mercadopago.com.ar/developers/es/docs/mp-point/migrate-payment-intent-to-orders
**Doc Self Service:** https://www.mercadopago.com.ar/developers/es/docs/mp-point-v2/migrate-payment-intent-to-orders

> Both PDV and Self Service modes use the same legacy endpoint and the same migration path. The two docs exist because the terminal configuration context differs, not the API.

### Endpoint mapping

| Operation | Before | After |
|-----------|--------|-------|
| Create | `POST /point/integration-api/devices/{deviceId}/payment-intents` | `POST /v1/orders` |
| Get status | `GET /point/integration-api/payment-intents/{id}` | `GET /v1/orders/{orderId}` |
| Cancel | `DELETE /point/integration-api/devices/{deviceId}/payment-intents/{id}` | `POST /v1/orders/{orderId}/cancel` + header `X-Allow-Cancelable-Status: at_terminal,created` |
| Refund | N/A | `POST /v1/orders/{orderId}/refund` |

### Payload mapping (create)

| Before | After | Notes |
|--------|-------|-------|
| `{deviceId}` in URL path | `config.point.terminal_id` in body | use `GET /terminals/v1/list` to get ID |
| `amount` (integer, centavos) | `transactions.payments[].amount` (string decimal) | `"15.00"` not `1500` |
| `description` / `title` (if present) | `description` at root level | **`title` is NOT a valid field** — the Orders API rejects it with `unsupported_properties`. Always use `description`. |
| `additional_info.external_reference` | `external_reference` at root | moved + **required** |
| `print_on_terminal: true` (boolean) | `config.point.print_on_terminal: "seller_ticket"` | enum string |
| `payment_type` / `installments` | `config.payment_method.default_type` / `config.payment_method.default_installments` | **CRITICAL: `payment_method` belongs in `config`, NOT in `transactions.payments[]`**. Field names change: `type` → `default_type`, `installments` → `default_installments`. Putting it in `transactions.payments[]` causes `unsupported_properties` 400. |
| `X-platform-id` header | `integration_data.platform_id` in body | moved |
| `X-integrator-id` header | `integration_data.integrator_id` in body | moved |
| `x-test-scope` header | **removed entirely** | |
| — | `type: "point"` | **new required field** |
| — | `X-Idempotency-Key` header (UUID) on create AND cancel | **new required** — cancel returns `400 empty_required_header` if missing |
| — | `X-Allow-Cancelable-Status: at_terminal,created` on cancel requests | **add preemptively** — required to cancel orders already at terminal |

### Payload structure — correct shape (Point, create)

```js
// ✅ CORRECT — verified against live Orders API
{
  type: 'point',
  description: 'Venda PDV',            // NOT "title" — title is rejected with unsupported_properties
  external_reference: 'ALPHANUMERIC',  // no hyphens, max 64 chars
  transactions: {
    payments: [{ amount: '15.00' }]    // payment_method does NOT go here
  },
  config: {
    point: {
      terminal_id: 'PAX_A920__...',
      print_on_terminal: 'seller_ticket'
    },
    payment_method: {                  // payment_method goes in config, not in transactions.payments[]
      default_type: 'credit_card',     // "type" → "default_type"
      default_installments: 1,         // "installments" → "default_installments"
      installments_cost: 'seller'
    }
  }
}
```

### Response — payment_method_id and payment_type_id

These fields do **NOT** exist at the root of the Orders API response (verified against live API). Read them from the correct path:

```js
// ❌ WRONG — undefined, field does not exist at root:
data.payment_method_id
data.payment_type_id

// ✅ CORRECT — verified path:
data.transactions?.payments?.[0]?.payment_method?.id    // e.g. "master"
data.transactions?.payments?.[0]?.payment_method?.type  // e.g. "credit_card"
```

### Status mapping

| Before | After |
|--------|-------|
| `OPEN` | `created` |
| `ON_TERMINAL` | `created` (intermediate) |
| `FINISHED` | `processed` |
| `ERROR` | `failed` |
| `CANCELED` | `canceled` |

### Webhook topic change
- Before: `point_integration_wh`
- After: `orders`

### Order ID format change
- Before: UUID format (`550e8400-e29b-41d4-a716-446655440000`)
- After: alphanumeric (`ORDTST01KW2N1HBZN8EC970E5HXC2ERS`)

Update any DB columns, comparisons, or logging that depend on UUID format.

---

## Refund (Point + QR — all variants)

Refunds for payments generated by Point or QR legacy integrations used the Payments API refund endpoint. After migrating to Orders API, refunds must use the Orders API refund endpoint.

### Endpoint mapping

| Operation | Before | After |
|-----------|--------|-------|
| Full refund | `POST /v1/payments/{paymentId}/refunds` | `POST /v1/orders/{orderId}/refund` |
| Partial refund | `POST /v1/payments/{paymentId}/refunds` with `{ amount }` | `POST /v1/orders/{orderId}/refund` with `{ amount }` |

### Key changes

| Before | After | Notes |
|--------|-------|-------|
| `paymentId` in URL | `orderId` in URL | Use the order ID, not the payment ID |
| `POST /v1/payments/{id}/refunds` | `POST /v1/orders/{id}/refund` | Note: `refund` (singular), not `refunds` |
| Body: `{ amount: Number }` (optional for full) | Body: `{ amount: Number }` (optional for full) | Amount format unchanged |

### Important

The `orderId` is the ID returned by `POST /v1/orders` when the payment was created. If the project stores the legacy `paymentId` to issue refunds later, it must now store the `orderId` instead. Flag this in the migration diff with a comment:
```js
// ⚠️ Store orderId (from POST /v1/orders response) instead of paymentId for future refunds
```
