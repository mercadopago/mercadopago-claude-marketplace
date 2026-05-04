---
name: mp-orders
description: Mercado Pago Orders (Orden Unificada). Use when implementing order flows, combining online+offline payments, or integrating with QR.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, orders, orden-unificada, merchant-order, ou-qr"
---

# mp-orders

Mercado Pago Orders (Orden Unificada). Covers order flows, multi-payment orders, and OU + QR integration.

## Products Covered

- **Orders API**: The unified orders system (`POST /v1/orders`). Supports multiple payment methods, partial payments, and QR integration. Recommended for all new integrations.
- **Orders + QR**: Order combined with QR payment flow, enabling in-store payments within the Orders API framework.
- **merchant_orders (Legacy)**: The older order entity from the legacy API. If you find `merchant_orders` in existing code, consider migrating to the Orders API.

## Products That Use Orders API

Orders API is the backend for multiple MP products — not a standalone product:

| Product | Countries |
|---------|-----------|
| Checkout API / Checkout Transparente | AR, BR, CL, MX (default); UY, PE, CO (available) |
| Checkout Bricks (automatic mode) | All countries |
| Point | AR, BR, CL, MX |
| QR Code | AR, BR, CL, UY |

## When to Use This Skill

Trigger on keywords: Orders API, order de pago, order de pagamento, multi-payment, multiple payment methods on one order.

## Decision Tree

```
Need flexible order management
|-- New integration?
|   +-- Use Orders API (POST /v1/orders)
|-- Existing code uses merchant_orders?
|   +-- Legacy -- consider migration to Orders API
|-- Need order paid via QR in-store?
|   +-- Orders + QR flow (via Orders API)
+-- Simple single-payment order?
    +-- Use mp-checkout-online instead
```

## Integration Flow

1. Create an order via `POST /v1/orders` with items, amounts, and configuration.
2. Associate one or more payment methods to the order.
3. Process payment(s) -- each payment is tracked individually.
4. Receive webhooks per payment event (`order.created`, `order.updated`).
5. Reconcile via the order entity, which aggregates all payments.

## Gotchas

- Orders can have **partial payments**. The order is not closed until the full amount is covered.
- The order status reflects the aggregate state across all its payments.
- Each individual payment within the order has its own independent status lifecycle.
- When using Orders + QR, the QR flow follows the same rules as `mp-instore` but is wrapped in the order context.
- Modifying an order after payments have started may not be possible -- check the current state before attempting updates.
- **Legacy note**: If you encounter `merchant_orders` in existing code, this is the old API. The Orders API (`/v1/orders`) is the recommended replacement.

## Prerequisites

- Active Mercado Pago account with credentials (public key + access token).
- Understanding of the Orders API and how orders relate to individual payments.

## Country Availability

Orders API is available across all 7 countries, with scope varying by product:

- **Checkout API / Checkout Transparente**: default in AR, BR, CL, MX — also available (non-default) in UY, PE, CO.
- **Point**: AR, BR, CL, MX only.
- **QR Code**: AR, BR, CL, UY only.
- **Checkout Bricks**: all countries (automatic mode).

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Orders API creation endpoints and payload schemas (`POST /v1/orders`)
- Order query and status endpoints
- Orders + QR integration flow specifics
- Payment association endpoints

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/checkout-api-orders/overview`
