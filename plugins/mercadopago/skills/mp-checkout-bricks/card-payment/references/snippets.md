# Card Payment Brick — Code Snippets

## Complete integration example

### 1. HTML structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Card Checkout</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <h1>Pay with card</h1>
  <div id="cardPaymentBrick_container"></div>
  <script src="card-checkout.js"></script>
</body>
</html>
```

---

### 2. JS — SDK init and Brick render

```js
// Initialize MP
const mp = new MercadoPago("YOUR_PUBLIC_KEY", {
  locale: "pt-BR",  // es-AR | pt-BR | es-MX | es-CO | es-CL | es-PE | es-UY
});

const bricksBuilder = mp.bricks();

const renderCardPaymentBrick = async (bricksBuilder) => {
  const settings = {
    // ── initialization ── no preferenceId (card-only brick)
    initialization: {},
    // ── customization.visual ── see ./customization.md
    // ── customization.paymentMethods ── see ./customization.md
    customization: {},
    // ── callbacks ── see ./rules-callbacks.md
    // ── callbacks.onSubmit ── token is single-use, expires 7 days
    // ── 3DS challenge ── see ../status-screen/references/rules-3ds.md
    callbacks: {
      onReady: () => {},
      onSubmit: async (cardFormData) => {},
      onError: (error) => {}, // ── callbacks.onError ── see ./troubleshooting.md "Error catalog"
    },
  };

  window.cardPaymentBrickController = await bricksBuilder.create(
    "cardPayment",
    "cardPaymentBrick_container",
    settings
  );
};

renderCardPaymentBrick(bricksBuilder);
```

---

### 3. React — using @mercadopago/sdk-react

```bash
# Always install the latest published version:
npm install @mercadopago/sdk-react@latest
# Check current latest: https://www.npmjs.com/package/@mercadopago/sdk-react
# Note: MP updates this package frequently with bug fixes and new features.
# Pinning to a specific version is not recommended unless you have strict lock-file requirements.
```

```jsx
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

initMercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });

export function CardCheckout({ amount }) {
  return (
    <CardPayment
      // ── initialization ── no preferenceId (card-only brick)
      initialization={{}}
      // ── customization.visual ── see ./customization.md
      // ── customization.paymentMethods ── see ./customization.md
      customization={{}}
      // ── callbacks ── see ./rules-callbacks.md
      // ── callbacks.onSubmit ── token is single-use, expires 7 days
      // ── 3DS challenge ── see ../status-screen/references/rules-3ds.md
      onReady={() => {}}
      onSubmit={async (cardFormData) => {}}
      onError={(error) => {}} // see ./troubleshooting.md "Error catalog"
    />
  );
}
```

---

### 4. Server-side — create order

See `../../references/rules-payment.md` for Python, Node.js, and curl examples.

---

### 5. Update amount dynamically

```js
// After initial render, update amount (e.g., after promo code applied)
await window.cardPaymentBrickController.update({ amount: 85.00 });
```

---

### 6. Destroy the Brick

```js
await window.cardPaymentBrickController.unmount();
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Card Payment Brick render create order card token server side")`
