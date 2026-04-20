# Payment Brick — Payment Methods per Country

> Always verify current method availability via `mcp__mercadopago__search_documentation(siteId, "Payment Brick payment methods")` before deployment.

## Method categories

| Category key | Possible values | Example with array |
|---|---|---|
| `creditCard` | `"all"` or array of specific IDs | `["visa", "mastercard"]` |
| `debitCard` | `"all"` or array of specific IDs | `["debvisa", "debmaster"]` |
| `prepaidCard` | `"all"` or array of specific IDs | `["prepaid_card"]` |
| `ticket` | `"all"` or array of specific IDs | `["bolbradesco", "oxxo"]` |
| `bankTransfer` | `"all"` or array of specific IDs | `["pix", "pse"]` |
| `atm` | `"all"` or array of specific IDs | `["banamex", "pagoefectivo_atm"]` |
| `mercadoPago` | `"all"` or array of sub-types | `["wallet_purchase", "onboarding_credits"]` |

> To get the exact IDs available per category and country, use the API: `GET /v1/payment_methods` with your ACCESS_TOKEN.

---

## Argentina (MLA)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    ticket: "all",          // pagofacil, rapipago
    mercadoPago: "all",     // onboarding_credits + wallet_purchase
  }
}
```

---

## Brazil (MLB)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    ticket: "all",          // bolbradesco
    bankTransfer: "all",    // pix
    mercadoPago: "all",     // onboarding_credits + wallet_purchase
  }
}
```

---

## Mexico (MLM)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    atm: "all",             // banamex, bancomer
    ticket: "all",          // paycash, oxxo
    mercadoPago: "all",     // onboarding_credits + wallet_purchase
  }
}
```

---

## Colombia (MCO)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    ticket: "all",          // efecty
    bankTransfer: "all",    // pse
    mercadoPago: "all",     // wallet_purchase only
  }
}
```

---

## Chile (MLC)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    mercadoPago: "all",     // wallet_purchase only
  }
}
```

---

## Peru (MPE)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    atm: "all",             // pagoefectivo_atm
    mercadoPago: "all",     // wallet_purchase only
  }
}
```

---

## Uruguay (MLU)

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    ticket: "all",          // redpagos, abitab
    mercadoPago: "all",     // wallet_purchase only
  }
}
```

---

## How to enable/disable specific methods

**Enable all methods for the country:**

```js
customization: {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    prepaidCard: "all",
    ticket: "all",
    bankTransfer: "all",
    atm: "all",
    mercadoPago: "all",
    maxInstallments: 12,
    minInstallments: 1,
  }
}
```

**Show only cards (no cash/bank methods):**

```js
paymentMethods: {
  creditCard: "all",
  debitCard: "all",
  prepaidCard: "all",
  // omit ticket, bankTransfer, atm, mercadoPago — they won't appear
}
```

---

### Key points

- **`mercadoPago` enabled requires `preferenceId`** in initialization — see `../../references/rules-preference.md`
- **Pix (MLB)** is `bankTransfer`, not `ticket`. Boleto is `ticket`.
- **MCO, MLC, MPE, MLU** only support `wallet_purchase` for mercadoPago (no `onboarding_credits`)
- **MLA, MLB, MLM** support both `wallet_purchase` and `onboarding_credits`

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Payment Brick payment methods available")`
