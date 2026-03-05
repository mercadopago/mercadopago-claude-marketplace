---
name: mp-instore
description: In-store payment integration for Mercado Pago. Covers QR Attended, QR Dynamic, Point devices, and Kiosk mode. Use when implementing face-to-face payment flows.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, qr, point, pos, instore, presencial, kiosko"
---

# mp-instore

In-store payment integration for Mercado Pago. Covers QR Attended, QR Dynamic, Point devices, and Kiosk mode.

## Products Covered

- **QR Attended**: Cashier creates order, buyer scans a fixed QR at the point of sale.
- **QR Dynamic**: Generate a unique QR per transaction. Single-use, displayed to the buyer.
- **Point**: Physical card reader devices (Smart, Plus, Mini) for card-present payments.
- **Kiosk**: Self-service payment terminals where the customer initiates and completes the payment.

## When to Use This Skill

Trigger on keywords: QR, qr_code, Point, POS, kiosko, instore, presencial, pago presencial, lector de tarjeta.

**NOT** for online payments -- redirect to `mp-checkout-online` instead.

## Decision Tree

```
Need in-store payments
|-- Fixed POS / cashier?
|   |-- Cashier creates order --> QR Attended
|   +-- Each transaction gets unique QR --> QR Dynamic
|-- Need physical card reader?
|   +-- Point device (Smart, Plus, Mini)
+-- Self-service terminal?
    +-- Kiosk mode
```

## Integration Flow: QR Attended

1. Create a QR code for a POS (one-time setup).
2. Create an order associated to that POS.
3. Buyer scans the QR code with the Mercado Pago app.
4. Mercado Pago processes the payment.
5. Receive webhook notification with payment result.

## Integration Flow: QR Dynamic

1. Create an order that includes the QR data payload.
2. Display the generated QR to the buyer (on screen or printed).
3. Buyer scans with the Mercado Pago app.
4. Receive webhook notification with payment result.

## Integration Flow: Point

1. Register the physical device in the Mercado Pago dashboard.
2. Create a payment intent via the Point API.
3. The device processes the card (chip, swipe, or contactless).
4. Receive the result via API polling or webhook.

## Gotchas

- QR codes are tied to a specific POS identified by `store_id` + `external_pos_id`. Do not reuse QR codes across POS terminals.
- Point devices need firmware updates before first use. Ensure the device is on the latest firmware.
- QR Attended requires the order to be created BEFORE the buyer scans. If the buyer scans first, there is no order to pay.
- The notification type for Point is `point_integration_wh`, which is different from standard payment webhooks.
- QR Dynamic QR codes are single-use. Once scanned (or expired), they cannot be reused.

## Prerequisites

- Active Mercado Pago account with credentials (public key + access token).
- Store and POS configured in the Mercado Pago Dashboard.
- For Point: a physical device registered to the account.

## Country Availability

- **QR**: AR, BR, MX, CL, CO, PE, UY
- **Point**: AR, BR, MX, CL (device availability varies by country)

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Store and POS creation endpoints and payloads
- Order creation payload schema for QR Attended and QR Dynamic
- QR generation endpoints
- Point device registration and payment intent APIs
- Payment intent schema and status codes

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/qr-code/landing`
- `{DOMAIN}/developers/{LANG}/docs/mp-point/landing`
