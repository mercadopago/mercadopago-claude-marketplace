# Checkout Bricks — Error Catalog (official MercadoPago documentation)

## Initialization errors (integrator configuration)

These errors are caused by incorrect configuration. The skill must prevent all of these by ensuring correct setup.

| Code (`error.cause`) | Error | Prevention rule |
|---|---|---|
| `settings_empty` | Settings object is empty | Always pass a complete settings object with `initialization`, `callbacks`, and `customization` |
| `missing_amount_property` | `initialization.amount` is required | Always configure `initialization.amount` as a `Number` (not string). Example: `amount: 100.00` not `amount: "100"` |
| `missing_required_callbacks` | `onReady` and `onError` callbacks are required | Always implement both `onReady` and `onError` in the callbacks object |
| `missing_container_id` | HTML container element ID not provided | Always create the container div before calling `create()` |
| `missing_locale_property` | Locale is required | Always set locale in `new MercadoPago(KEY, { locale })` during SDK initialization |
| `incorrect_initialization` | Generic initialization error | Validate all initialization values before passing to the Brick |

> Note: `missing_amount_property` does not apply to Wallet Brick (amount comes from preference) or Status Screen Brick (uses paymentId).

---

## Communication errors (MP API calls)

These errors happen at runtime when the Brick communicates with MercadoPago APIs. They are NOT preventable by configuration — implement `onError` to handle them gracefully.

| Code (`error.cause`) | Error | Critical? | User-facing message |
|---|---|---|---|
| `fields_setup_failed` | Secure Fields iframe failed to load | **Yes** | "Ocorreu um erro." |
| `get_payment_methods_failed` | Failed to fetch payment methods from public_key | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |
| `card_token_creation_failed` | Failed to create card token | No | "Ocorreu um erro e não foi possível processar o pagamento. Por favor, tente novamente mais tarde." |
| `get_identification_types_failed` | Failed to get ID types for the locale | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |
| `get_card_bin_payment_methods_failed` | Failed to resolve card BIN | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |
| `get_card_issuers_failed` | Failed to get card issuers | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |
| `get_payment_installments_failed` | Failed to get installment options | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |
| `missing_payment_information` | Incomplete payment fields (installments, issuer, or payment_method_id) | No | "Ocorreu um erro. Por favor, tente novamente mais tarde." |

> Note: Card-specific errors (`card_token_creation_failed`, `get_card_bin_payment_methods_failed`, `get_card_issuers_failed`, `get_payment_installments_failed`, `missing_payment_information`) only apply to Payment Brick and Card Payment Brick.

---

## Lifecycle: avoid re-initialization loops

In React/Next.js/Vue, component re-renders can call `create()` multiple times. Always:
- **Destroy before re-creating**: call `window.<brickName>BrickController.unmount()` before creating a new instance
- **Use `useEffect` cleanup** in React to unmount on component unmount
- **Never call `create()` inside a render loop** — only in mount lifecycle

```js
useEffect(() => {
  let controller;
  async function initBrick() {
    const bricksBuilder = mp.bricks();
    controller = await bricksBuilder.create("<brickType>", "<containerId>", settings);
  }
  initBrick();
  return () => {
    if (controller) controller.unmount();
  };
}, []);
```

---

## MCP fallback

If this reference did not cover a specific error, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Checkout Bricks possible errors initialization communication")`
