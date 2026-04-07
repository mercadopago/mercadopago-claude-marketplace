---
name: mp-checkout-online
description: Online checkout integration patterns for Mercado Pago. Covers Checkout Pro, Payments API, 3D Secure, and Cross-Border Payments. Use when implementing any web-based payment flow.
license: Apache-2.0
metadata:
  version: "3.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, checkout, preference, payments, sdk, 3ds, cbp"
---

# mp-checkout-online

Online checkout integration intelligence for Mercado Pago. This skill contains stable integration patterns, decision trees, and flow descriptions. For dynamic data (current SDK code, payload schemas, test cards), consult the MCP server or fetch docs.

## Products Covered

- **Checkout Pro**: Redirect-based, preference-driven. Best for fast integration.
- **Payments API**: Direct server-to-server payment creation with card tokenization. Full control.
- **3D Secure (3DS)**: Additional cardholder authentication layer. Required by some acquirers.
- **Cross-Border Payments (CBP)**: Accept payments from buyers in other countries.

## When to Use This Skill

Use when the conversation mentions: preference, init_point, back_urls, Checkout Pro, payment.create, card tokenization, 3DS, cross-border.

Do NOT use for: QR/Point (use mp-instore), subscriptions (use mp-subscriptions), marketplace splits (use mp-marketplace).

## Decision Tree: Which Checkout Variant?

```
Developer needs to accept online payments
|
+-- Wants fastest integration, OK with redirect?
|   +-- YES --> Checkout Pro
|       +-- Create preference --> redirect to init_point
|
+-- Wants full control over payment flow?
|   +-- YES --> Payments API
|       +-- Tokenize card client-side --> create payment server-side
|
+-- Needs 3DS authentication?
    +-- Add 3DS to any of the above flows
```

## Integration Flow: Checkout Pro

1. Server: Create a preference with items, back_urls, notification_url
2. Client: Redirect buyer to `init_point`.
3. Buyer completes payment on MP checkout page
4. MP redirects buyer to back_url with query params (collection_id, status, etc.)
5. Server: Verify payment status via Payments API (NEVER trust redirect params alone)
6. Server: Process webhook notification for definitive status

**Key fields for preference**: items[].title, items[].unit_price, items[].quantity (required). back_urls, auto_return, notification_url, statement_descriptor, external_reference (recommended).

**Gotcha**: `currency_id` must match the country. ARS for Argentina, BRL for Brazil, etc. See agent country detection.

## Integration Flow: Checkout API (Direct)

1. Client: Tokenize card using MercadoPago.js `cardForm` or `createCardToken`
2. Client: Send token + payment details to server
3. Server: Create payment with token, transaction_amount, payment_method_id, installments, payer
4. Server: Return status to client
5. Server: Process webhook for definitive status

**Gotcha**: Card tokens are single-use and expire in 7 days.

**Gotcha**: `issuer_id` is required for some payment methods.

## 3D Secure (3DS) -- Skeleton

- 3DS adds an authentication step before payment processing
- Required by some acquirers/issuers for fraud prevention
- Adds an iframe challenge flow for the buyer
- Only integrable for Check Out API or Check Out Bricks. Check Out PRO is already integrated by default
- Always use `binary_mode: false`, otherwise the payment won't be able to show the challenge or `pending` status. 
- **For endpoints, payloads, and implementation details**: Consult the MCP server or fetch docs at `{DOMAIN}/developers/{LANG}/docs/checkout-api/3ds`

## Cross-Border Payments (CBP) -- Skeleton

- Allows accepting payments from buyers in countries different from the seller's
- Requires specific configuration and approval
- Currency conversion is handled by MP
- **For endpoints, payloads, and implementation details**: Consult integrator or Key Account Manager. The product doesn't have public documentation yet.

## Payment Status Reference

| Status | Status Detail | Meaning |
|--------|--------------|---------|
| approved | accredited | Payment approved and credited |
| in_process | pending_contingency | Under review |
| in_process | pending_review_manual | Manual review |
| rejected | cc_rejected_bad_filled_card_number | Wrong card number |
| rejected | cc_rejected_bad_filled_date | Wrong expiration |
| rejected | cc_rejected_bad_filled_security_code | Wrong CVV |
| rejected | cc_rejected_high_risk | Fraud risk |
| rejected | cc_rejected_insufficient_amount | Insufficient funds |
| rejected | cc_rejected_max_attempts | Too many attempts |
| pending | pending_waiting_payment | Awaiting offline payment |

## Prerequisites

- Mercado Pago account with approved application
- Access Token (server-side) and Public Key (client-side)
- SDK installed (Node.js: `mercadopago`, Python: `mercadopago`, etc.)
- HTTPS endpoint for notification_url (webhooks)

## Country Availability

All 7 countries: Argentina, Brazil, Mexico, Chile, Colombia, Peru, Uruguay.

CBP: Requires specific country-pair approval.

## Testing

- Use `init_point` for Checkout Pro
- Use production credentials (`APP_USR-*`) of a **test user** — Mercado Pago no longer uses `TEST-` sandbox credentials
- Create test users from the Developer Dashboard or via the MCP tool `create_test_user`
- Load balance into test users with the MCP tool `add_money_test_user`
- **For current test cards and test user emails**: Consult MCP server or fetch `{DOMAIN}/developers/{LANG}/docs/your-integrations/test/cards`

## What to Fetch from MCP

When helping a developer, use the Mercado Pago MCP server (`mercadopago`) to get:

- Current SDK initialization code per language
- Preference creation endpoint and full payload schema
- Payment creation endpoint and payload schema
- 3DS configuration endpoints
- Test card numbers and test user patterns
- Current error codes and messages

## What to Fetch from Docs (WebFetch fallback)

If MCP is unavailable:

- `{DOMAIN}/developers/{LANG}/docs/checkout-pro/landing` -- Checkout Pro guide
- `{DOMAIN}/developers/{LANG}/docs/checkout-bricks/landing` -- Bricks guide
- `{DOMAIN}/developers/{LANG}/docs/checkout-api/landing` -- Payments API guide
- `{DOMAIN}/developers/{LANG}/docs/checkout-api/3ds` -- 3DS guide
- `{DOMAIN}/developers/{LANG}/docs/your-integrations/test/cards` -- Test cards
