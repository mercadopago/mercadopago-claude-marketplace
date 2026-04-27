# Payment Brick — Code Snippets

## Complete integration example

### 1. HTML structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>
  <!-- Load MP SDK via CDN -->
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <h1>Complete your payment</h1>
  <!-- Container for the Brick -->
  <div id="paymentBrick_container"></div> 

  <script src="checkout.js"></script>
</body>
</html>
```

---

### 2. JS — SDK init and Brick render (checkout.js)

```js
// Step 1: Initialize MP instance
const mp = new MercadoPago("YOUR_PUBLIC_KEY", {
  locale: "pt-BR",  // Change per country: es-AR, pt-BR, es-MX, es-CO, es-CL, es-PE, es-UY
});

// Step 2: Get the bricks builder
const bricksBuilder = mp.bricks();

// Step 3: Configure and render the Payment Brick
const renderPaymentBrick = async (bricksBuilder) => {
  const settings = {
    // ── initialization ── see ./rules-initialization.md
    // ── initialization.preferenceId ── only when mercadoPago enabled — see ../references/rules-preference.md
    initialization: {},
    // ── customization.paymentMethods ── see ./rules-payment-methods.md
    // ── customization.visual ── see ./customization.md
    customization: {},
    // ── callbacks ── see ./rules-callbacks.md
    callbacks: {
      onReady: () => {},
      onSubmit: async ({ selectedPaymentMethod, formData }) => {},
      onError: (error) => {}, // ── callbacks.onError ── see ./troubleshooting.md "Error catalog"
    },
  };

  window.paymentBrickController = await bricksBuilder.create(
    "payment",
    "paymentBrick_container",
    settings
  );
};

// Init
renderPaymentBrick(bricksBuilder);
```

---

### 3. React component example

```jsx
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

initMercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });

export function CheckoutPayment({ amount }) {
  return (
    <Payment
      // ── initialization ── see ./rules-initialization.md
      // ── initialization.preferenceId ── only when mercadoPago enabled — see ../references/rules-preference.md
      initialization={{}}
      // ── customization.paymentMethods ── see ./rules-payment-methods.md
      // ── customization.visual ── see ./customization.md
      customization={{}}
      // ── callbacks ── see ./rules-callbacks.md
      onReady={() => {}}
      onSubmit={async ({ selectedPaymentMethod, formData }) => {}}
      onError={(error) => {}} // see ./troubleshooting.md "Error catalog"
    />
  );
}
```

---

### 4. npm import (non-React)

```bash
# Always install the latest published version:
npm install @mercadopago/sdk-js@latest
# Check current latest: https://www.npmjs.com/package/@mercadopago/sdk-js
# Note: MP updates this package frequently with bug fixes and new features.
# Pinning to a specific version is not recommended unless you have strict lock-file requirements.
```

```js
import { loadMercadoPago } from "@mercadopago/sdk-js";

await loadMercadoPago();
const mp = new window.MercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });
const bricksBuilder = mp.bricks();
// ... same render logic as above
```

---

### 5. Server-side — create order

See `../../references/rules-payment.md` for Python, Node.js, and curl examples.

---

### 6. Unmount / destroy the Brick

```js
// When navigating away or re-rendering
await window.paymentBrickController.unmount();
// Or destroy completely:
window.paymentBrickController = null;
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Payment Brick render create order server side")`
