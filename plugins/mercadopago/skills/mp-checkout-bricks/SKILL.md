---
name: mp-checkout-bricks
description: Checkout Bricks integration for Mercado Pago. Single skill with internal modules for Payment Brick, Card Payment Brick, Wallet Brick, and Status Screen Brick. Use when: Bricks, Payment Brick, Card Payment Brick, Wallet Brick, Status Screen Brick, embedded payment form, formulário de pagamento embutido, componente de pago.
license: Apache-2.0
metadata:
  version: "1.0.0"
  author: "checkout-bricks"
  category: "development"
  tags: "mercadopago, bricks, payment, card-payment, wallet, status-screen, checkout, embedded"
---

# Checkout Bricks

## Decision Tree

```
Developer needs embedded payment UI
|
+-- Needs full payment form (cards + Pix, Boleto, OXXO, PSE, Yape...)?
|   +-- YES --> Payment Brick
|       Read: ./payment/index.md
|
+-- Needs card-only form (PCI tokenization, brand detection)?
|   +-- YES --> Card Payment Brick
|       Read: ./card-payment/index.md
|
+-- Needs "Pay with MercadoPago" button (saved cards, balance, Mercado Crédito)?
|   +-- YES --> Wallet Brick
|       Read: ./wallet/index.md
|
+-- Needs payment result screen or 3DS challenge handling?
    +-- YES --> Status Screen Brick
        Read: ./status-screen/index.md
```

## Brick Modules

| Brick | Module | Description |
|-------|-----------|-------------|
| Payment Brick | `./payment/index.md` | All-in-one form: cards, local methods, installments, MercadoPago wallet |
| Card Payment Brick | `./card-payment/index.md` | Card-only PCI form with tokenization and brand detection |
| Wallet Brick | `./wallet/index.md` | One-click button for logged-in MP users |
| Status Screen Brick | `./status-screen/index.md` | Payment result display with automatic 3DS challenge |

## Shared Setup

All Bricks share prerequisites: SDK initialization, container div, credential configuration.

Read: `./references/rules-bricks-setup.md`

## Orders API Policy (MANDATORY)

For `mp-checkout-bricks`, use Orders API in `automatic` mode only.

- Endpoint: `POST /v1/orders`
- Mode: `processing_mode: "automatic"`
- Do not use manual flow endpoints (`add-transaction`, `update-transaction`, `delete-transaction`, `process-order`) in this skill.
- For Status Screen, pass the `payment_id` returned in the order response (first payment transaction id).

## Country Availability

All 7 markets: Argentina (MLA), Brazil (MLB), Mexico (MLM), Colombia (MCO), Chile (MLC), Peru (MPE), Uruguay (MLU).
