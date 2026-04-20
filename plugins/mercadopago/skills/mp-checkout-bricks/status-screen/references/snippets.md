# Status Screen Brick — Code Snippets

## Complete integration: post-payment result page

### 1. HTML structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Payment Result</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <h1>Your payment</h1>
  <div id="statusScreenBrick_container"></div>
  <script src="payment-result.js"></script>
</body>
</html>
```

> The `paymentId` must be available before the Brick renders. In Orders automatic flow, it comes from `order.transactions.payments[0].id`. How it gets to frontend depends on the seller's stack (URL param, template variable, state management, API call, etc.). If unclear, default to URL params.

---

### 2. JS — render Status Screen Brick

```js
// payment-result.js

// 1. Get paymentId (adapt to seller's tech stack — URL param, template variable, state, etc.)
// In Orders automatic flow, backend should return payment_id = order.transactions.payments[0].id
const paymentId = new URLSearchParams(window.location.search).get("payment_id"); // default: URL param

// 2. Initialize MP SDK
const mp = new MercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });
const bricksBuilder = mp.bricks();

// 3. Render Status Screen Brick
const renderStatusScreenBrick = async (bricksBuilder) => {
  const settings = {
    // ── initialization
    initialization: {
      paymentId: paymentId, // REQUIRED: payment transaction id from Orders API execution result
    },
    // ── customization ── see ./customization.md
    // ── customization.backUrls ── see ./rules-backurl.md
    customization: {},
    // ── callbacks ── onReady and onError REQUIRED, no onSubmit
    callbacks: {
      onReady: () => {},
      onError: (error) => {}, // see ./troubleshooting.md "Error catalog"
    },
  };

  window.statusScreenBrickController = await bricksBuilder.create(
    "statusScreen",
    "statusScreenBrick_container",
    settings
  );
};

renderStatusScreenBrick(bricksBuilder);
```

---

### 3. React component

```bash
# Always install the latest published version:
npm install @mercadopago/sdk-react@latest
# Check current latest: https://www.npmjs.com/package/@mercadopago/sdk-react
# Note: MP updates this package frequently with bug fixes and new features.
# Pinning to a specific version is not recommended unless you have strict lock-file requirements.
```

```jsx
import { StatusScreen, initMercadoPago } from "@mercadopago/sdk-react";

initMercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });

export function PaymentResultPage({ paymentId }) {
  return (
    <StatusScreen
      // ── initialization
      initialization={{ paymentId }}
      // ── customization ── see ./customization.md
      // ── customization.backUrls ── see ./rules-backurl.md (object with return/error, NOT string)
      customization={{}}
      // ── callbacks ── onReady and onError REQUIRED, no onSubmit
      onReady={() => {}}
      onError={(error) => {}} // see ./troubleshooting.md "Error catalog"
    />
  );
}
```

---

### 4. Server-side — create order / check status

See `../../references/rules-payment.md` for Python, Node.js, and curl examples (create + check status).

---

### 5. 3DS flow

See `./rules-3ds.md` for the complete Card Payment → Status Screen flow.

---

### 6. Webhook handler

Use `mcp__mercadopago__search_documentation(siteId, term: "webhook notifications payment")` for webhook setup. Use `mcp__mercadopago__notifications_history()` to check delivery history during testing.

---

### 7. Unmount / destroy the Brick

```js
// When navigating away or re-rendering
await window.statusScreenBrickController.unmount();
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Status Screen Brick render paymentId callbacks")`
