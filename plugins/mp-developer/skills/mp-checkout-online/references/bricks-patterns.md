# Checkout Bricks Integration Patterns

## Available Bricks

| Brick | Purpose | Key Props |
|-------|---------|-----------|
| Payment Brick | Full payment form (cards + other methods) | amount, preferenceId |
| Card Payment Brick | Card-only form | amount |
| Status Screen Brick | Payment result display | paymentId |
| Wallet Brick | MP wallet payment button | preferenceId |
| Brand Brick | MP branding display | -- |

## Integration Architecture

1. Include MercadoPago.js SDK: `https://sdk.mercadopago.com/js/v2`
2. Initialize with Public Key: `const mp = new MercadoPago("PUBLIC_KEY")`
3. Create brick via `mp.bricks().create(type, containerId, settings)`
4. Handle callbacks: onReady, onSubmit, onError

## Payment Brick Flow

- `initialization.amount` -- Transaction amount (required)
- `initialization.preferenceId` -- Links to server preference (optional but recommended)
- `customization.paymentMethods` -- Configure which methods to show
- `callbacks.onSubmit` -- Receives `{ selectedPaymentMethod, formData }`, POST to server

## Server-Side Processing

After receiving formData from Brick:

- Create payment via Payments API
- Include: transaction_amount, token, payment_method_id, installments, issuer_id, payer
- Always use idempotency key
- Return status to Brick for display

## Common Gotchas

- Public Key must be from the same application as the Access Token
- Container div must exist in DOM before creating brick
- Amount in Brick must match server-side transaction_amount
- Brick handles card tokenization automatically -- do not tokenize twice
- For card payments, payer.identification is required in some countries

## What to Fetch from MCP

- Current Brick initialization parameters per Brick type
- Available customization options
- Payment processing endpoint and payload schema
- Country-specific required fields
