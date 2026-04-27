---
name: mp-security
description: Mercado Pago security features. Covers 3D Secure standalone, PCI compliance, Supertoken, Vault, and card tokenization. Use when implementing advanced security features.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, 3ds, pci, tokenization, supertoken, vault, security, card-token"
---

# mp-security

## Products Covered

- **3D Secure (3DS)**: Standalone authentication separate from checkout flow
- **PCI Compliance**: For direct card handling (SAQ-D level)
- **Supertoken**: Long-lived card tokens for recurring/saved cards
- **Vault**: Secure card storage with display capabilities
- **Card Tokenization**: Single-use tokens via MercadoPago.js

## When to Use

Use this skill when the query involves: 3DS standalone, PCI, tokenization, vault, supertoken, card_token, secure card storage.

For basic checkout security, use mp-checkout-online. For webhook signature verification, use mp-notifications.

## Decision Tree

```
Security feature needed
├── Need 3DS authentication (standalone)?
│   └── 3DS API (separate from checkout flow)
├── Need to store cards for future payments?
│   ├── Short-lived token → Card Tokenization (single use)
│   └── Long-lived token → Supertoken / Vault
├── Handle raw card data (PCI)?
│   └── PCI compliance requirements
└── Need secure card display?
    └── Vault display features
```

## Integration Flow: Card Tokenization

1. Client-side: Use MercadoPago.js to tokenize card
2. Token sent to server
3. Server uses token in payment creation
4. Token is single-use and expires in 7 days

## Integration Flow: Supertoken

1. Create initial payment with card token
2. Request supertoken for the customer-card pair
3. Store supertoken securely
4. Use supertoken for future charges without re-tokenizing

## Gotchas

- Card tokens are single-use.
- Supertokens require customer_id association.
- PCI compliance has strict audit requirements -- most developers should use tokenization instead.
- 3DS may add friction but reduces fraud chargebacks.
- Vault requires specific permissions.

## Prerequisites

- For basic tokenization: Public Key + MP.js
- For Supertoken/Vault: specific application permissions
- For PCI: SAQ-D compliance

## Country Availability

- Tokenization: all countries
- 3DS: AR, BR, MX, CL, CO
- Supertoken/Vault: varies

## What to Fetch from MCP/Docs

- Tokenization endpoints
- Supertoken API
- 3DS configuration
- Vault API
- `{DOMAIN}/developers/{LANG}/docs/checkout-api/tokenization`
