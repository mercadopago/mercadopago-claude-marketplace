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

- **Orders**: A single order that supports multiple payment methods and partial payments. The `merchant_order` entity tracks the overall order state.
- **OU + QR**: Order combined with QR payment flow, enabling in-store payments within the unified order framework.

## When to Use This Skill

Trigger on keywords: unified order, orden unificada, merchant_order, OU + QR, multi-payment, multiple payment methods on one order.

## Decision Tree

```
Need flexible order management
|-- Single order with multiple payment methods?
|   +-- Unified Order
|-- Need unified order paid via QR in-store?
|   +-- OU + QR flow
+-- Simple single-payment order?
    +-- Use mp-checkout-online instead
```

## Integration Flow

1. Create a unified order with items, amounts, and configuration.
2. Associate one or more payment methods to the order.
3. Process payment(s) -- each payment is tracked individually.
4. Receive webhooks per payment event.
5. Reconcile via the `merchant_order` entity, which aggregates all payments.

## Gotchas

- Unified orders can have **partial payments**. The `merchant_order` is not closed until the full amount is covered.
- The `merchant_order.status` reflects the aggregate state across all its payments.
- Each individual payment within the order has its own independent status lifecycle.
- When using OU + QR, the QR flow follows the same rules as `mp-instore` but is wrapped in the unified order context.
- Modifying a unified order after payments have started may not be possible -- check the current state before attempting updates.

## Prerequisites

- Active Mercado Pago account with credentials (public key + access token).
- Understanding of the `merchant_order` concept and how it relates to individual payments.

## Country Availability

- AR, BR, MX (check Mercado Pago documentation for expansion to additional countries).

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Unified order creation endpoints and payload schemas
- `merchant_order` query and status endpoints
- OU + QR integration flow specifics
- Payment association endpoints

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/orders/landing` (if available)
- `{DOMAIN}/developers/{LANG}/reference/merchant_orders`
