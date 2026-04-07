---
name: mp-checkout-bricks
description: Checkout Bricks integration for Mercado Pago. Routes to specialized sub-skills for Payment Brick, Card Payment Brick, Wallet Brick, and Status Screen Brick. Use when: Bricks, Payment Brick, Card Payment Brick, Wallet Brick, Status Screen Brick, embedded payment form, formulário de pagamento embutido, componente de pago.
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
|       Read: ./payment/SKILL.md
|
+-- Needs card-only form (PCI tokenization, brand detection)?
|   +-- YES --> Card Payment Brick
|       Read: ./card-payment/SKILL.md
|
+-- Needs "Pay with MercadoPago" button (saved cards, balance, Mercado Crédito)?
|   +-- YES --> Wallet Brick
|       Read: ./wallet/SKILL.md
|
+-- Needs payment result screen or 3DS challenge handling?
    +-- YES --> Status Screen Brick
        Read: ./status-screen/SKILL.md
```

## Sub-Skills

| Brick | Sub-Skill | Description |
|-------|-----------|-------------|
| Payment Brick | `./payment/SKILL.md` | All-in-one form: cards, local methods, installments, MercadoPago wallet |
| Card Payment Brick | `./card-payment/SKILL.md` | Card-only PCI form with tokenization and brand detection |
| Wallet Brick | `./wallet/SKILL.md` | One-click button for logged-in MP users |
| Status Screen Brick | `./status-screen/SKILL.md` | Payment result display with automatic 3DS challenge |

## Shared Setup

All Bricks share prerequisites: SDK initialization, container div, credential configuration.

Read: `./references/rules-bricks-setup.md`

## Country Availability

All 7 markets: Argentina (MLA), Brazil (MLB), Mexico (MLM), Colombia (MCO), Chile (MLC), Peru (MPE), Uruguay (MLU).
