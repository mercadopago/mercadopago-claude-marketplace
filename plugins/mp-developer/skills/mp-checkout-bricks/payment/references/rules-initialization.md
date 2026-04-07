# Payment Brick — Initialization Rules

## Required configuration

```js
bricksBuilder.create("payment", "paymentBrick_container", {
  initialization: {
    amount: <number>,          // REQUIRED
    preferenceId: "<string>",  // REQUIRED when mercadoPago is enabled
  },
  customization: { ... },
  callbacks: {
    onSubmit: ...,             // REQUIRED
    onError: ...,              // strongly recommended
    onReady: ...,              // optional
    onBinChange: ...,          // optional
  }
})
```

---

## `initialization.amount`

**Type**: `number`
**Required**: Yes
**Description**: The total payment amount to display and charge.

Rules:
- Must be a positive number greater than 0
- Use the final amount (after discounts, taxes, shipping)
- Use the same decimal precision as the country's currency. All countries use 2 decimal places except Chile (CLP) which uses integers (no decimals)

```js
// CORRECT
initialization: { amount: 100.00 }
initialization: { amount: 1500 }   // Chile (CLP, no decimals)

// WRONG
initialization: { amount: 0 }       // zero → onSubmit never triggers
initialization: { amount: "100" }   // string not allowed
initialization: { amount: -50 }     // negative not allowed
```

---

## `initialization.preferenceId`

**Type**: `string`
**Required**: When `paymentMethods.mercadoPago` is enabled (for any country)
**Description**: The ID of a server-side preference, used for MercadoPago wallet payments and Mercado Crédito.

Rules:
- Must be created server-side via `POST /checkout/preferences` before rendering the Brick
- The preference ID is the `id` field in the API response
- Required whenever you include `mercadoPago: "all"` (or `mercadoPago: ['wallet_purchase']`) in `paymentMethods`
- See `../../references/rules-preference.md` for complete preference creation instructions

```js
// REQUIRED when mercadoPago is in paymentMethods:
initialization: {
  amount: 100.00,
  preferenceId: "1234567890-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
}
```

---

## Errors

See `./troubleshooting.md` — "Error catalog" section for all initialization and communication errors.

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Payment Brick initialization configuration")`
