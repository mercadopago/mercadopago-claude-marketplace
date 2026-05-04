---
name: mp-specialized
description: Specialized Mercado Pago integrations for specific industries and regional payment methods. Covers insurance payments, Yape (Peru), and Fintoc (Chile).
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, insurance, aseguradora, yape, fintoc, specialized"
---

# mp-specialized

## Products Covered

- **Insurance Payments (Aseguradoras)**: Specialized billing for insurance companies (Argentina)
- **Yape (Peru)**: Mobile wallet integration
- **Fintoc (Chile)**: Bank transfer via Fintoc
- **PSE (Colombia)**: Bank transfer via PSE
- **Other regional methods**: Pix (Brazil) is natively supported in Checkout Transparente/Bricks. For the full list of available payment methods per country, consult MCP (`search_documentation`).

## When to Use

Use this skill when the query involves: insurance, aseguradora, Yape, Fintoc, PSE, specialized payment method, regional payment method.

For general checkout, use mp-checkout-online instead.

## Decision Tree

```
Specialized integration
├── Insurance company billing?
│   └── Insurance payment flow (special approval required)
├── Accept Yape payments (Peru)?
│   └── Yape integration via MP
├── Accept bank transfers via Fintoc (Chile)?
│   └── Fintoc integration via MP
├── Accept PSE bank transfers (Colombia)?
│   └── PSE integration via MP
└── Other regional method?
    └── Consult MCP (search_documentation) for availability
```

## Gotchas

- Insurance flows require specific MP approval and contract.
- Yape is Peru-only.
- Fintoc is Chile-only.
- Each has specific UX requirements.

## Prerequisites

- Specialized approval from MP for each product

## Country Availability

- Insurance: AR
- Yape: PE
- Fintoc: CL
- PSE: CO

## What to Fetch from MCP/Docs

- Insurance API endpoints
- Yape configuration
- Fintoc setup
- Country-specific docs
