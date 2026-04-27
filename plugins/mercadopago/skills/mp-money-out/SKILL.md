---
name: mp-money-out
description: Mercado Pago money-out operations. Covers disbursements and bank transfers. Use when implementing payouts, withdrawals, or transfers from MP accounts.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, disbursement, transfer, money-out, payout, bank-transfer"
---

# mp-money-out

Mercado Pago money-out operations. Covers disbursements and bank transfers for payouts and withdrawals.

## Products Covered

- **Disbursements**: Pay out funds to third parties (sellers, partners, employees) via bank transfer or Mercado Pago account.
- **Bank Transfers**: Withdraw funds from your Mercado Pago account to an external bank account.

## When to Use This Skill

Trigger on keywords: disbursement, transfer, money out, payout, bank_transfer, withdrawal, retiro, transferencia, desembolso.

**NOT** for payment collection -- redirect to `mp-checkout-online` instead.

## Decision Tree

```
Need to send money out
|-- Pay to seller/third-party?
|   +-- Disbursement API
+-- Withdraw to own bank account?
    +-- Bank Transfer / Withdrawal API
```

## Integration Flow

1. Verify sufficient balance in the Mercado Pago account.
2. Create a disbursement or transfer request with recipient details.
3. Include recipient bank details (CBU/CVU, CLABE, Pix key, etc.) or Mercado Pago account ID.
4. Monitor the transfer status via webhooks.
5. Reconcile completed transfers with your internal reports.

## Gotchas

- Disbursements may take **1-3 business days** depending on the destination bank and country.
- Bank account validation is **asynchronous**. The initial API response confirms the request was received, not that the transfer succeeded.
- Insufficient balance returns a specific error code. Always check balance before attempting a transfer.
- Some operations require **additional KYC** (Know Your Customer) verification on the account.
- Transfer limits vary by country and account level. Check the current limits before building your UI.
- Weekend and holiday transfers may be delayed until the next business day.

## Prerequisites

- Approved application with disbursement permissions (requires Mercado Pago review).
- Sufficient available balance in the Mercado Pago account.
- Active Mercado Pago account with credentials (access token).

## Country Availability

- AR, BR, MX, CL, CO (availability and specific features vary by country).

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Disbursement creation endpoints and payload schemas
- Bank transfer endpoints
- Status query endpoints
- Error codes and their meanings
- Transfer limits by country and account level

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/money-out/landing` (if available)
- `{DOMAIN}/developers/{LANG}/reference/disbursements`
