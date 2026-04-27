---
name: mp-sdks
description: Mercado Pago SDK selection, setup, migration, and compatibility. Covers server-side (Node, Python, Java, PHP, Ruby, .NET, Go), client-side web (MercadoPago.js, React SDK), and mobile (iOS, Android). Use when the question is about choosing, installing, configuring, or migrating SDKs — not about a product flow.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, sdk, mercadopago-js, react-sdk, ios, android, mobile, client-side, server-side, migration"
---

# mp-sdks

## Products Covered

- **Server-side SDKs**: Node.js, Python, Java, PHP, Ruby, .NET, Go
- **Client-side web**: MercadoPago.js (vanilla JS), React SDK (`@mercadopago/sdk-react`)
- **Mobile native**: iOS (Swift), Android (Kotlin/Java)
- **GitHub organization**: https://github.com/mercadopago

## When to Use This Skill

- SDK selection: "which SDK should I use?"
- SDK setup and initialization
- SDK migration (e.g., MercadoPago.js to React SDK)
- Platform compatibility questions
- Mobile SDK capabilities and limitations

**NOT for product flows.** If the developer is asking about Checkout Pro, Bricks, QR, etc., use the corresponding product skill. The product skill describes the integration flow; this skill describes the SDK layer.

## Decision Tree: Which SDK?

```
What platform is the integration running on?
│
├─ Server backend?
│  └─ Choose by language: Node.js, Python, Java, PHP, Ruby, .NET, Go
│     (See agent SDK Installation Reference for install commands)
│
├─ Web frontend — vanilla JS or server-rendered?
│  └─ MercadoPago.js (CDN script)
│
├─ Web frontend — React?
│  └─ @mercadopago/sdk-react (npm package)
│
├─ iOS native (Swift/SwiftUI)?
│  └─ sdk-ios via Swift Package Manager
│
├─ Android native (Kotlin/Java)?
│  └─ sdk-android via Gradle
│
├─ React Native?
│  └─ No official SDK. Use WebView for Bricks or server-side tokenization.
│
└─ Flutter?
   └─ No official SDK. Use server-side tokenization + custom UI.
```

## Platform: MercadoPago.js

- **Load from CDN only**: `<script src="https://sdk.mercadopago.com/js/v2"></script>`
- **NEVER self-host.** The CDN version handles PCI compliance and auto-updates.
- **Init**: `const mp = new MercadoPago('PUBLIC_KEY')` — uses the PUBLIC key, not access token.
- **Provides**: Bricks (`mp.bricks()`), Card Form (`mp.cardForm()`), Card Token (`mp.createCardToken()`)
- **Use cases**: Checkout Bricks, card tokenization, payment method selection

## Platform: React SDK

- **Install**: `npm install @mercadopago/sdk-react`
- **Wraps MercadoPago.js** — do NOT also load the CDN script. They conflict.
- **Init**: `<MercadoPagoProvider publicKey="PUBLIC_KEY">` wrapper component
- **Components**: `<Payment>`, `<Wallet>`, `<CardPayment>`, `<StatusScreen>`
- **Requires**: React 16.8+ (hooks support)
- **Use cases**: Same as MercadoPago.js but with React component API

## Platform: iOS SDK

- **Install**: Swift Package Manager — `https://github.com/mercadopago/sdk-ios`
- **Init**: Configure with `publicKey` and country/locale
- **Supports**: Card tokenization, payment method selection
- **Does NOT support**: Rendering Bricks (web-only), full checkout UI
- **Min iOS version**: Check the repo for current requirement

## Platform: Android SDK

- **Install**: Gradle dependency from `github.com/mercadopago`
- **Init**: Configure with `publicKey` and country
- **Supports**: Card tokenization, payment method selection
- **Does NOT support**: Rendering Bricks (web-only), full checkout UI
- **Min Android version**: Check the repo for current requirement

## Migration: MercadoPago.js to React SDK

### When to migrate

- Project is already React-based and wants component API instead of imperative JS
- New React project starting fresh

### Steps

1. **Remove CDN script** — delete `<script src="https://sdk.mercadopago.com/js/v2"></script>`
2. **Install package** — `npm install @mercadopago/sdk-react`
3. **Replace init** — `new MercadoPago(key)` becomes `<MercadoPagoProvider publicKey={key}>`
4. **Replace Bricks** — `mp.bricks().create('payment', ...)` becomes `<Payment initialization={...} />`
5. **Replace callbacks** — `callbacks: { onSubmit, onReady, onError }` become React props: `onSubmit`, `onReady`, `onError`
6. **Test thoroughly** — the underlying MercadoPago.js version may differ between CDN and npm wrapper

## Gotchas

1. **MercadoPago.js MUST be loaded from CDN** — it is NOT available as an npm package for direct import. The React SDK wraps it internally.
2. **React SDK and MercadoPago.js CDN cannot coexist** — loading both causes duplicate initialization errors.
3. **iOS and Android SDKs only support tokenization** — they do NOT render Bricks or checkout UI. For mobile checkout UI, use a WebView pointing to Checkout Pro or Bricks.
4. **React Native and Flutter have no official SDK** — use server-side flows or WebView-based approaches.
5. **Go SDK is newer** — it may not yet support all features available in Node/Python/Java SDKs. Check the repo for current capabilities.
6. **All client-side SDKs use the PUBLIC key** — never expose the access token in frontend or mobile code.
7. **Server-side SDKs use the ACCESS TOKEN** — loaded from environment variables, never hardcoded.

## What to Fetch from MCP

- Current SDK versions and changelogs
- SDK initialization code per language
- Available methods and capabilities per SDK

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/sdks-library/landing` — SDK overview and downloads
- `{DOMAIN}/developers/{LANG}/docs/sdks-library/client-side` — MercadoPago.js and React SDK details
