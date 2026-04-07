---
description: Scaffold a new Mercado Pago integration — supports all MP products including online checkout, in-store, subscriptions, marketplace, and more
argument-hint: "[node|python|java] [checkout-pro|bricks|checkout-api|orders|qr|subscriptions|marketplace|point]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
allowed-tools: [Read, Write, Edit, Bash]
---

# /mp-setup

Scaffold a new Mercado Pago payment integration in the current project.

## Instructions

You are setting up a Mercado Pago integration from scratch. Follow these steps:

### 1. Determine Language and Product

If `$ARGUMENTS` is provided, parse it for language and product type:
- Languages: `node`, `python`, `java`
- Products:
  - **Online**: `checkout-pro`, `bricks`, `checkout-api`
  - **In-Store**: `qr`, `point`
  - **Orders**: `orders`
  - **Recurring**: `subscriptions`
  - **Platform**: `marketplace`

Example: `/mp-setup node checkout-pro` or `/mp-setup python subscriptions`

If not provided, detect language from project files:
- `package.json` → Node.js
- `requirements.txt` / `pyproject.toml` → Python
- `pom.xml` / `build.gradle` → Java

If product is unclear, ask the user which MP product they want to integrate.

### 2. Create `.env.example`

```
# Mercado Pago Credentials
# Get yours at the Mercado Pago Developer Panel (Tus integraciones > Credenciales)
MP_ACCESS_TOKEN=APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000
MP_PUBLIC_KEY=APP_USR-00000000-0000-0000-0000-000000000000

# Webhook Secret (from Dashboard → Webhooks)
MP_WEBHOOK_SECRET=your_webhook_secret_here

# App Config
APP_URL=http://localhost:3000
```

### 2.5 Development Environment Guide

After creating `.env.example`, guide the developer on how to obtain test credentials:

- **Test credentials location**: In the Mercado Pago Developer Dashboard, navigate to: *Tus integraciones > Datos de integracion > Credenciales* (right panel) > click **"Prueba"**. Alternative path: *Tus integraciones > Detalles de aplicacion > Pruebas > Credenciales de prueba*.
- **Environment setup docs**: Direct the developer to the country-specific guide at `https://{DOMAIN}/developers/{LANG}/docs/checkout-pro/configure-development-enviroment` (replace `{DOMAIN}` and `{LANG}` based on the detected country).
- **Test users**: Create test users from the Dashboard or using the MCP tool `create_test_user`. Test user credentials use the same `APP_USR-` prefix as production credentials.

### 3. Ensure `.env` is in `.gitignore`

Read `.gitignore` and add `.env` and `.env.*` if not already present (but NOT `.env.example`).

### 4. Install SDK

Run the appropriate install command:
- **Node.js**: `npm install mercadopago`
- **Python**: `pip install mercadopago`
- **Java**: Add Maven/Gradle dependency (show the user the snippet to add)

### 5. Scaffold Integration Files

Since `/mp-setup` scaffolds new integrations, **always default to the Orders API** (`POST /v1/orders`) when querying the MCP server for code templates. The Orders API is Mercado Pago's recommended path for all new integrations.

1. Query MCP (`search_documentation`) for Orders API implementation of the selected product (e.g., "orders API checkout-pro", "orders API QR").
2. If MCP returns Orders API templates → use them.
3. If Orders API is not yet available for the product, or MCP is unavailable → fall back to the legacy skill patterns in the table below.
4. If the user explicitly requests the legacy approach, respect their choice but mention Orders API is recommended.

Legacy fallback — use the corresponding skill for integration patterns when Orders API templates are not available:

| Product | Skill | Key files to scaffold |
|---------|-------|-----------------------|
| checkout-pro | mp-checkout-online | Preference route, back_url handler, webhook receiver |
| bricks | mp-checkout-bricks | Brick component page, payment processing route, webhook receiver |
| checkout-api | mp-checkout-online | Payment route, tokenization frontend, webhook |
| qr | mp-instore | Store/POS setup, order creation route, webhook |
| point | mp-instore | Device registration, order, webhook |
| subscriptions | mp-subscriptions | Plan creation, subscription URL/route, invoice webhook |
| orders | mp-orders | Order creation route, multi-payment handler, webhook receiver |
| marketplace | mp-marketplace | OAuth route, split payment route, seller management, webhook |

For every product, always scaffold:
- A webhook receiver endpoint with HMAC signature validation
- Proper error handling with user-friendly messages

### 6. Summary

After scaffolding, print a summary:

```
## MP Integration Ready

**Language**: [detected language]
**Product**: [selected product]

### Created files:
- `.env.example` — credential template
- [list of scaffolded files]

### Next steps:
1. Copy `.env.example` to `.env` and add your credentials
2. Get credentials from the Mercado Pago Developer Panel (*Tus integraciones > Credenciales*)
3. Run your server and test using the credentials of a **test user** (create one from the Dashboard or via the MCP tool `create_test_user`)
4. For webhooks in local dev: `ngrok http <port>`
```
