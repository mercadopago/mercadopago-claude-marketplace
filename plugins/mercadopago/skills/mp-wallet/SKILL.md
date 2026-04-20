---
name: mp-wallet
description: Mercado Pago Wallet integrations. Covers Wallet Connect, debt payments, and massive payment links. Use when integrating with MP wallet features.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, wallet, wallet-connect, debt, payment-link, link-masivo"
---

# mp-wallet

Mercado Pago Wallet integrations. Covers Wallet Connect, debt payments, and massive payment links.

## Products Covered

- **Wallet Connect**: Link a user's Mercado Pago wallet to your platform via OAuth. Enables persistent account linking for seamless payments.
- **Debt Payment**: Bill and debt collection via Mercado Pago. Send payment requests for outstanding debts.
- **Massive Payment Links**: Bulk generation of payment links for large-scale distribution.

## When to Use This Skill

Trigger on keywords: Wallet Connect, cuenta MP, deuda, debt, link de pago, payment_link, massive links, link masivo, billetera.

**NOT** for checkout flows -- redirect to `mp-checkout-online` instead.

## Decision Tree

```
Wallet integration needed
|-- Link user's MP account to platform?
|   +-- Wallet Connect (OAuth-based, persistent link)
|-- Collect bill/debt payments?
|   +-- Debt Payment flow
+-- Generate many payment links at once?
    +-- Massive Payment Links API
```

## Integration Flow: Wallet Connect

1. Redirect user to Mercado Pago authorization URL.
2. User logs in to their MP account and authorizes the connection.
3. Mercado Pago redirects back to your platform with an authorization code.
4. Exchange the authorization code for an access token (user-scoped).
5. Use the token to access the user's wallet features (read balance, create charges).

## Integration Flow: Debt Payment

1. Create a debt record with the payer's identification.
2. Generate a payment link or send a notification to the payer.
3. Payer accesses the link and pays via Mercado Pago.
4. Receive webhook notification with payment result.

## Integration Flow: Massive Payment Links

1. Prepare a batch of payment links (via API or CSV upload).
2. Submit the batch for generation.
3. Each link gets a unique ID and tracks its own payment status.
4. Distribute links to payers.
5. Monitor payment status per link via webhooks or polling.

## Gotchas

- Wallet Connect requires an **OAuth authorization flow**. The access token is user-scoped and must be refreshed periodically.
- Debt payments have **specific regulatory requirements** that vary by country. Verify compliance before implementing.
- Massive links have **rate limits** on batch generation. Plan accordingly for large batches.
- Wallet Connect tokens can be revoked by the user at any time. Handle token revocation gracefully.
- The `offline_access` scope is required for long-lived tokens (refresh token support).

## Prerequisites

- Approved application for Wallet Connect (requires Mercado Pago review).
- Specific permissions for debt payment functionality.
- Active Mercado Pago account with credentials (public key + access token).

## Country Availability

- **Wallet Connect**: AR, BR, MX
- **Debt Payment**: AR
- **Massive Payment Links**: AR, BR, MX

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Wallet Connect OAuth authorization and token exchange endpoints
- Debt payment creation endpoints and payload schemas
- Massive links batch API and status endpoints
- Token refresh and revocation endpoints

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/wallet-connect/landing`
