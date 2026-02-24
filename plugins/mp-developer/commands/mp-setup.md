---
description: Scaffold a new Mercado Pago integration — installs SDK, configures .env.example, and creates working checkout + webhook skeleton
argument-hint: [node|python|java] [checkout-pro|bricks|payments-api]
allowed-tools: [Read, Write, Edit, Bash]
---

# /mp-setup

Scaffold a new Mercado Pago payment integration in the current project.

## Instructions

You are setting up a Mercado Pago integration from scratch. Follow these steps:

### 1. Determine Language and Integration Type

If `$ARGUMENTS` is provided, parse it for language and integration type:
- Languages: `node`, `python`, `java`
- Types: `checkout-pro`, `bricks`, `payments-api`

Example: `/mp-setup node checkout-pro`

If not provided, check the project for existing indicators:
- `package.json` → Node.js
- `requirements.txt` / `pyproject.toml` → Python
- `pom.xml` / `build.gradle` → Java

If still unclear, ask the user.

### 2. Create `.env.example`

```
# Mercado Pago Credentials
# Get yours at: https://www.mercadopago.com.ar/developers/panel/app
MP_ACCESS_TOKEN=TEST-0000000000000000-000000-00000000000000000000000000000000-000000000
MP_PUBLIC_KEY=TEST-00000000-0000-0000-0000-000000000000

# App Config
APP_URL=http://localhost:3000
```

### 3. Ensure `.env` is in `.gitignore`

Read `.gitignore` and add `.env` and `.env.*` if not already present (but NOT `.env.example`).

### 4. Install SDK

Run the appropriate install command:
- **Node.js**: `npm install mercadopago`
- **Python**: `pip install mercadopago`
- **Java**: Add Maven/Gradle dependency (show the user the snippet to add)

### 5. Scaffold Integration Files

Based on the integration type, create working skeleton files:

**Checkout Pro** — Create:
- Server route to create preferences
- Redirect handler for back_urls (success/failure/pending)
- Webhook receiver endpoint

**Bricks** — Create:
- Server route to create preferences
- Frontend HTML with Payment Brick initialization
- Server route to process brick form submission
- Webhook receiver endpoint

**Payments API** — Create:
- Server route to create payments directly
- Card tokenization frontend snippet
- Webhook receiver endpoint

### 6. Summary

After scaffolding, print a summary:

```
## MP Integration Ready

**Language**: [node|python|java]
**Type**: [checkout-pro|bricks|payments-api]

### Created files:
- `.env.example` — credential template
- [list of scaffolded files]

### Next steps:
1. Copy `.env.example` to `.env` and add your credentials
2. Get credentials at: https://www.mercadopago.com.ar/developers/panel/app
3. Run your server and test with sandbox credentials
4. For webhooks in local dev: `ngrok http <port>`
```
