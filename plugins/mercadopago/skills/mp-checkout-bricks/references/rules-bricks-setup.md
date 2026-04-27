# Checkout Bricks — Shared Setup

This reference contains the shared prerequisites for ALL Checkout Bricks (Payment, Card Payment, Wallet, Status Screen). The `mp-checkout-bricks` skill must read this file in Step 1 before proceeding with brick-specific logic.

---

## 1. Detect tech stack

> **Critical**: Brick rendering (the payment UI) is **JavaScript/TypeScript ONLY**. Bricks run in the browser via the MP JS SDK. Always clarify this to the developer upfront if they mention a non-JS frontend.

### Frontend detection

| Frontend framework | Brick rendering approach |
|---|---|
| React, Next.js, Vue, Nuxt, Angular, Svelte | MP JS SDK via CDN or npm `@mercadopago/sdk-js` |
| Plain HTML + JavaScript | MP JS SDK via CDN script tag |
| React Native, Flutter, native iOS/Android | **NOT supported** — Bricks are browser-only. Suggest Checkout Pro redirect or Payment Links instead. |

### Backend detection (server-side API calls)

MercadoPago provides official server-side SDKs for 7 languages:

| Backend | SDK oficial | Installation | Min version |
|---|---|---|---|
| Node.js | `mercadopago` (NPM) | `npm install mercadopago` | Node 12+ |
| Python | `mercadopago` (PyPI) | `pip install mercadopago` | Python 3+ |
| Java | `com.mercadopago:sdk-java` (Maven) | Maven / Gradle | Java 1.8+ |
| PHP | `mercadopago/dx-php` (Packagist) | `composer require mercadopago/dx-php` | PHP 8.2+ |
| .NET | `mercadopago-sdk` (NuGet) | `nuget install mercadopago-sdk` | .NET Standard 2.1+ |
| Ruby | `mercadopago-sdk` (Gem) | `gem install mercadopago-sdk` | Ruby 2.3+ |
| Go | `github.com/mercadopago/sdk-go` | `go get github.com/mercadopago/sdk-go` | Go 1.18+ |

**If tech stack is unknown**, ask:
> "What tech stack are you using?
> - Frontend: React, Vue, Next.js, plain HTML+JS?
> - Backend: Node.js, Python, Java, Go, PHP, .NET, Ruby, other?"
> - If mercadopago does not support use backend mercadopago REST API and frontend must have a Javascript Engine

---

## 2. SDK setup (before any Brick is rendered)

All Bricks share this initialization sequence.

### 2a. Load the MP JS SDK

**Via CDN (simplest, works in plain HTML):**
```html
<script src="https://sdk.mercadopago.com/js/v2"></script>
```

**Via npm (for React/Vue/Next.js/etc.):**
```bash
npm install @mercadopago/sdk-js
```
```js
import { loadMercadoPago } from "@mercadopago/sdk-js";
await loadMercadoPago();
```

### 2b. Initialize MercadoPago instance

**This must be called BEFORE creating any Brick.** Creating a Brick without initializing the SDK first causes `INVALID_SDK_INSTANCE` error.

```js
// 1. Initialize SDK (MUST be first)
const mp = new MercadoPago("YOUR_PUBLIC_KEY", {
  locale: "es-AR"  // Use country-appropriate locale — see table below
});

// 2. Get bricks builder (MUST be after SDK init)
const bricksBuilder = mp.bricks();

// 3. Create brick (MUST be after bricks builder)
const controller = await bricksBuilder.create("brickType", "containerId", settings);
```

| Country | Recommended locale |
|---|---|
| Argentina (MLA) | `es-AR` |
| Brazil (MLB) | `pt-BR` |
| Mexico (MLM) | `es-MX` |
| Colombia (MCO) | `es-CO` |
| Chile (MLC) | `es-CL` |
| Peru (MPE) | `es-PE` |
| Uruguay (MLU) | `es-UY` |

### 2c. Set environment

- **Sandbox (testing)**: Use your **test public key** (starts with `TEST-`)
- **Production**: Use your **production public key** (starts with `APP_USR-`)
- Never hardcode keys in frontend code — use environment variables

### 2d. Create the container div

```html
<div id="paymentBrick_container"></div>
<!-- Or: cardPaymentBrick_container, walletBrick_container, statusScreenBrick_container -->
```

---

## PCI compliance

Checkout Bricks are PCI DSS certified. The developer's servers never receive raw card data — only a single-use token (expires in 7 days). Checkout Bricks qualifies for SAQ A.

---

## MCP Tools cheatsheet

| Scenario | Tool to call |
|---|---|
| Get official docs for a brick + country | `mcp__mercadopago__search_documentation` |
| Create test users for sandbox testing | `mcp__mercadopago__create_test_user` |
| Add money to test user for Wallet testing | `mcp__mercadopago__add_money_test_user` |
| View webhook/IPN notifications | `mcp__mercadopago__notifications_history` |
| List MP applications | `mcp__mercadopago__application_list` |
| Save/configure webhook | `mcp__mercadopago__save_webhook` |
