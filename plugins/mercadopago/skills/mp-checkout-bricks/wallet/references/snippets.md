# Wallet Brick — Code Snippets

## Complete integration example

### 1. Server-side -- Create preference first

See `../../references/rules-preference.md` for full preference creation instructions (Python, Node.js, curl).

---

### 2. HTML structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <h2>Or pay with your MercadoPago account</h2>
  <div id="walletBrick_container"></div>
  <script src="wallet-checkout.js"></script>
</body>
</html>
```

> The `preferenceId` is created by the seller's backend and injected into the page before the Brick renders. The agent should adapt this to the seller's tech stack (template variable, API call, server-side rendering, etc.).

---

### 3. JS -- SDK init and Wallet Brick render

```js
// wallet-checkout.js

// 1. Get preferenceId (injected by backend — adapt to seller's tech stack)
const preferenceId = "PREFERENCE_ID_FROM_BACKEND"; // REQUIRED

// 2. Initialize MP SDK
const mp = new MercadoPago("YOUR_PUBLIC_KEY", {
  locale: "pt-BR",  // es-AR | pt-BR | es-MX | es-CO | es-CL | es-PE | es-UY
});

const bricksBuilder = mp.bricks();

// 3. Render Wallet Brick
const renderWalletBrick = async (bricksBuilder) => {
  const settings = {
    initialization: {
      preferenceId: preferenceId, // REQUIRED — Wallet Brick does not render without a real preferenceId
      // redirectMode: "self",    // optional — "self" (default) or "blank" — see ./customization.md
    },
    // -- customization -- see ./customization.md
    customization: {},
    // -- callbacks -- onReady and onError REQUIRED
    callbacks: {
      onReady: () => {},
      onSubmit: () => {},
      onError: (error) => {}, // -- callbacks.onError -- see ./troubleshooting.md "Error catalog"
    },
  };

  window.walletBrickController = await bricksBuilder.create(
    "wallet",
    "walletBrick_container",
    settings
  );
};

renderWalletBrick(bricksBuilder);
```

---

### 4. React component

```bash
# Always install the latest published version:
npm install @mercadopago/sdk-react@latest
# Check current latest: https://www.npmjs.com/package/@mercadopago/sdk-react
# Note: MP updates this package frequently with bug fixes and new features.
# Pinning to a specific version is not recommended unless you have strict lock-file requirements.
```

```jsx
import { Wallet, initMercadoPago } from "@mercadopago/sdk-react";

initMercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });

export function WalletCheckout({ preferenceId }) {
  return (
    <Wallet
      // REQUIRED — Wallet Brick does not render without a real preferenceId
      initialization={{ preferenceId }}
      // -- customization -- see ./customization.md
      // -- brand: do NOT override button CSS -- see ./troubleshooting.md
      customization={{}}
      // -- callbacks -- onReady and onError REQUIRED, onSubmit optional (no params)
      onReady={() => {}}
      onSubmit={() => {}}
      onError={(error) => {}} // see ./troubleshooting.md "Error catalog"
    />
  );
}
```

---

### 5. Handle success/failure/pending pages

After payment, MP redirects to `back_urls` configured in the preference. The redirect includes query params: `payment_id`, `status`, `external_reference`. The seller should verify payment status server-side — see `../../references/rules-create-payment.md` "Check payment status" section.

---

### 6. Unmount / destroy the Brick

```js
// When navigating away or re-rendering
await window.walletBrickController.unmount();
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Wallet Brick render preferenceId callbacks")`
