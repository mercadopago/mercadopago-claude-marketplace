# Card Payment Brick — Customization Reference

> **Always verify latest options** by calling:
> ```
> mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Card Payment Brick customization labels themes security")
> ```
> This file is a starting reference. MercadoPago may add new configuration params at any time.

---

## Themes

```js
customization: {
  visual: {
    style: {
      theme: "default",       // "default" | "dark" | "flat" | "bootstrap"
      customVariables: {
        textPrimaryColor: "#000000",
        textSecondaryColor: "#666666",
        inputBackgroundColor: "#ffffff",
        formBackgroundColor: "#f0f0f0",
        baseColor: "#009ee3",
        baseColorFirstVariant: "#007bb5",
        baseColorSecondVariant: "#006a9e",
        errorColor: "#cc0000",
        warningColor: "#ff8c00",
        successColor: "#00a650",
        successSecondaryColor: "#00a650",
        outlinePrimaryColor: "#009ee3",
        outlineSecondaryColor: "#cccccc",
        buttonTextColor: "#ffffff",
        fontSizeExtraExtraSmall: "10px",
        fontSizeExtraSmall: "12px",
        fontSizeSmall: "14px",
        fontSizeMedium: "16px",
        fontSizeLarge: "20px",
        fontSizeExtraLarge: "24px",
        fontWeightNormal: "400",
        fontWeightSemiBold: "600",
        borderRadiusSmall: "4px",
        borderRadiusMedium: "8px",
        borderRadiusLarge: "16px",
        borderRadiusFull: "9999px",
        formInputsTextTransform: "none",
        inputVerticalPadding: "12px",
        inputHorizontalPadding: "16px",
        inputFocusedBoxShadow: "0px 0px 0px 2px rgba(0,158,227,0.3)",
        inputErrorFocusedBoxShadow: "0px 0px 0px 2px rgba(204,0,0,0.3)",
        inputBorderWidth: "1px",
        inputFocusedBorderWidth: "2px",
        inputFocusedBorderColor: "#009ee3",
        formPadding: "16px",
      }
    },
    hideFormTitle: true,          // hides the title AND the accepted card brands strip
    hidePaymentButton: true,      // hides built-in submit button (use external submit instead)
  }
}
```

---

## Text customization

Custom texts **override the locale default**. Pass an empty string `""` to keep the default text for that field. Strings that exceed the available width are truncated with `"..."`.

```js
customization: {
  visual: {
    texts: {
      formTitle: "string",
      emailSectionTitle: "string",
      installmentsSectionTitle: "string",
      cardholderName: {
        label: "string",
        placeholder: "string",
      },
      email: {
        label: "string",
        placeholder: "string",
      },
      cardholderIdentification: {
        label: "string",
      },
      cardNumber: {
        label: "string",
        placeholder: "string",
      },
      expirationDate: {
        label: "string",
        placeholder: "string",
      },
      securityCode: {
        label: "string",
        placeholder: "string",
      },
      selectInstallments: "string",
      selectIssuerBank: "string",
      formSubmit: "string",
    },
  },
}
```

### Important notes on text customization:
- Empty string (`""`) = default text for that field.
- Custom texts **override** the Brick's locale-based translations. The Brick will NOT translate your custom strings.
- If a custom string is too long for the available space, it is truncated with `"..."`.
- The developer is responsible for translating custom labels on multi-language sites.

---

## Payment methods filtering

```js
customization: {
  paymentMethods: {
    types: {
      excluded: ["debit_card"],  // "credit_card" | "debit_card" | "prepaid_card"
    },
  }
}
```

### Examples:
- Accept **all card types** (default): don't set `excluded`
- Accept only **credit cards**: `types: { excluded: ["debit_card", "prepaid_card"] }`
- Accept only **debit cards**: `types: { excluded: ["credit_card", "prepaid_card"] }`
- Accept **credit + debit** (no prepaid): `types: { excluded: ["prepaid_card"] }`

---

## Installments limit

```js
customization: {
  paymentMethods: {
    maxInstallments: 12,     // Max installments shown in selector
    minInstallments: 1,      // Min installments (usually 1)
  }
}
```

---

## External submit button

To use your own button instead of the Brick's built-in submit:

1. Hide the built-in button:

```js
customization: {
  visual: {
    hidePaymentButton: true,
  }
}
```

2. Call `getFormData()` from your custom button handler:

```js
window.cardPaymentBrickController.getFormData()
  .then((cardFormData) => {
    // cardFormData contains the payment data
    // Send it to your backend to create the payment
  });
```

---

## Notes

- Custom CSS classes and IDs on Brick elements are **auto-generated and change between versions** — do not target them in your stylesheets.
- `hideFormTitle: true` hides **both** the title text and the accepted card brands strip beneath it.
- Some fields (like CPF in Brazil) are shown/hidden based on `locale`, not customization.
- `theme: "dark"` works well for dark-mode checkout flows.

---

## MCP fallback

If any customization option listed here seems outdated or you need a field not documented above, query the MCP for the latest info:

```
mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Card Payment Brick customization <specific option>")
```

The MCP response is the canonical source of truth; treat this file as a quick-start reference only.
