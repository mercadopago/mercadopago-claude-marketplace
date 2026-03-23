---
name: mp-instore
description: In-store payment integration for Mercado Pago. Covers QR Attended, QR Dynamic, Point devices, and Kiosk mode. Use when implementing face-to-face payment flows.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, qr, point, pos, instore, presencial, kiosko, pagos presenciales, terminal, dispositivo, self-service, terminal de pago, lectores de tarjeta"
---

# mp-instore

In-store payment integration for Mercado Pago. Covers QR in three modes—static, dynamic, and hybrid—and Point devices, which can operate in point-of-sale mode or kiosk mode (self-service).

## Products Covered

- **QR Static**: A fixed code linked to a point of sale (also known as attended mode). The order is assigned to this permanent code.
- **QR Dynamic**: Generates a unique QR code per transaction, single-use.
- **QR Hybrid**: Allows payment using either a static QR or a dynamic QR for the same order.
- **Point PDV**: Payment device operated by a seller at the point of sale.
- **Point Self-Service**: Device in self-service mode (also known as kiosk mode), where the customer completes the payment on their own.

## When to Use This Skill

Trigger on keywords: QR, qr_code, Point, POS, kiosko, instore, presencial, pago presencial, lector de tarjeta.

**User intent signals:**
- "I want to accept payments at my store / restaurant / event / market stall"
- "I have a point-of-sale system" / "I have a POS"
- "I want customers to scan a QR code to pay"
- "I need a physical card reader"
- "face-to-face payment" / "in-person payment"
- "self-service kiosk" / "customer pays on their own"


**NOT** for online payments -- redirect to `mp-checkout-online` instead.

## Decision Tree

```
Need in-store payments
|-- Fixed POS / cashier?
|   |-- Cashier creates order, fixed QR at POS --> QR Static (attended)
|   |-- Each transaction gets unique QR --> QR Dynamic
|   +-- Need both static and dynamic at the same POS --> QR Hybrid
+-- Need physical card reader?
    |-- Seller operates the device --> Point PDV
    +-- Customer pays on their own --> Point Self-Service (Kiosk)
```

## Integration Flow: QR Static (Attended)

1. Create a Store and a POS in Mercado Pago (one-time setup). The QR code is generated when the POS is created.
2. Create an order associated to that POS via the Unified Orders API.
3. Buyer scans the QR code with the Mercado Pago app.
4. Mercado Pago processes the payment.
5. Receive webhook notification with payment result.

## Integration Flow: QR Dynamic

1. Create an order via the Unified Orders API. The response includes the QR data to display.
2. Display the generated QR to the buyer (on screen or printed). Note: the QR expires after a set time — refresh if needed.
3. Buyer scans with the Mercado Pago app.
4. Mercado Pago processes the payment.
5. Receive webhook notification with payment result.

## Integration Flow: QR Hybrid

1. Create a Store and a POS in Mercado Pago (one-time setup). The static QR code is generated when the POS is created.
2. Create an order via the Unified Orders API. The order is linked to the static QR of the POS and a unique dynamic QR is generated simultaneously.
3. Display either the static or dynamic QR to the buyer.
4. Buyer scans one of the QR codes with the Mercado Pago app.
5. Mercado Pago processes the payment. The other QR is automatically invalidated.
6. Receive webhook notification with payment result.

## Integration Flow: Point

1. Create a Store and a POS in Mercado Pago (one-time setup).
2. Register the physical device and associate it to the POS.
3. Set the operating mode of the device via the Point API (`PDV` or `SELF_SERVICE`).
4. Create an order via the Unified Orders API.
5. The device processes the card (chip, swipe, or contactless).
6. Receive the result via webhook.

## Gotchas

- QR codes are tied to a specific POS identified by `store_id` + `external_pos_id`. Do not reuse QR codes across POS terminals.
- QR Static requires the order to be created BEFORE the buyer scans. If the buyer scans first, there is no order to pay.
- QR Dynamic codes are single-use. Once scanned (or expired), they cannot be reused.
- QR Hybrid: if the buyer pays with one of the two QR codes, the other is automatically invalidated.
- When changing the operating mode of a Point device (`PDV` ↔ `SELF_SERVICE` ↔ `STANDALONE`), the device must be restarted for the change to take effect. Note: `STANDALONE` refers to non-integrated mode (device operates independently, without API integration).
- A POS can only have one Point device associated in integrated mode (`PDV` or `SELF_SERVICE`).
- Point webhook topic is `order`, same as QR products.

## Prerequisites

- Active Mercado Pago account with an application created in Your Integrations to obtain the access token.
- Store and POS created via API.
- For Point: a physical device registered in Mercado Pago and associated to a POS.

## Country Availability

- **QR**: AR, BR, CL, PE, UY
- **Point**: AR, BR, MX, CL

**Point devices by country:**

| Country | Available Devices |
|---------|------------------|
| AR | Smart 2, Smart Pro 2, Plus |
| BR | Smart 2, Smart Pro 2, Smart Pro 3 |
| CL | Smart 2 |
| MX | Smart 2, Smart Pro 2 |

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Store and POS creation endpoints and payloads
- Unified Orders API schema and endpoints (for QR Static, QR Dynamic, QR Hybrid and Point)
- Point device registration and operating mode configuration API
- Order status codes and webhook payload examples

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/qr-code/landing`
- `{DOMAIN}/developers/{LANG}/docs/mp-point/landing`
