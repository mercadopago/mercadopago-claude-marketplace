---
name: mp-marketplace
description: Mercado Pago Marketplace integrations. Covers marketplace splits, seller onboarding, VTEX integration, and application fees. Use when building multi-seller platforms.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, marketplace, split, application-fee, vtex, sellers, oauth"
---

# mp-marketplace

## Products Covered

- **Marketplace Checkout**: Collect payments on behalf of sellers
- **Split Payments**: Distribute funds between marketplace and seller
- **Seller Onboarding**: OAuth-based seller connection
- **VTEX Integration**: MP on VTEX platform
- **Application Fees**: Marketplace commission on each payment

## When to Use

Use this skill when the query involves: marketplace, split, application_fee, VTEX, sellers, multi-vendor.

**NOT** for single-seller payments -- use mp-checkout-online instead.

## Decision Tree

```
Building a marketplace
├── Need to collect and split payments?
│   ├── Marketplace processes payment → Split Payment
│   └── Seller processes payment → Application Fee
├── Need to onboard sellers?
│   └── OAuth flow → get seller access_token
├── Using VTEX?
│   └── MP VTEX integration module
└── Need to manage seller payouts?
    └── Combine with mp-money-out skill
```

## Integration Flow: Marketplace Split

1. Onboard seller via OAuth
2. Buyer pays via marketplace checkout
3. Payment created with application_fee (marketplace commission)
4. MP splits: seller gets (amount - fee), marketplace gets fee
5. Webhook to both marketplace and seller

## Integration Flow: Seller Onboarding

1. Redirect seller to MP OAuth URL with marketplace app_id
2. Seller authorizes
3. Receive authorization_code
4. Exchange for seller's access_token + refresh_token
5. Store tokens securely

## Gotchas

- application_fee cannot exceed a percentage of the total (varies by country).
- Seller must have an approved MP account.
- OAuth tokens have expiry -- implement refresh flow.
- Split percentages are defined per payment, not globally.
- VTEX integration has its own configuration panel.

## Prerequisites

- Marketplace application approved by MP
- OAuth configured with redirect_uri
- Sellers must authorize marketplace

## Country Availability

AR, BR, MX, CL, CO, PE, UY (VTEX varies)

## What to Fetch from MCP/Docs

- OAuth endpoints
- Split payment creation
- application_fee limits
- Seller management APIs
- `{DOMAIN}/developers/{LANG}/docs/checkout-pro/additional-content/security/oauth/creation`
