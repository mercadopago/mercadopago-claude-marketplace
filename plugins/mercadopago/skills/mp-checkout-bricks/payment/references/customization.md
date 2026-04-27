# Payment Brick — Customization Reference

> **Always verify latest options** by calling:
> ```
> mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Payment Brick customization visual themes")
> ```
> This file is a starting reference. MercadoPago may add new configuration params at any time.

---

## Visual customization

### Themes

```js
customization: {
  visual: {
    style: {
      theme: "default",     // "default" | "dark" | "flat" | "bootstrap"
      customVariables: {
        // Override CSS variables for fine-grained control
        textPrimaryColor: "#000000",
        textSecondaryColor: "#666666",
        inputBackgroundColor: "#ffffff",
        formBackgroundColor: "#f0f0f0",
        baseColor: "#009ee3",           // MP blue — primary action color
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
        fontMaxLines: "2",
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
    hideFormTitle: false,         // hide the "Pay with" title line
    hidePaymentButton: false,     // hide the submit button (use getFormData() externally)
  }
}
```

---

### Default payment option

Pre-expand a specific payment method when the Brick renders. **Only one option can be enabled at a time.**

```js
customization: {
  visual: {
    defaultPaymentOption: {
      walletForm: true,
      // creditCardForm: true,
      // debitCardForm: true,
      // savedCardForm: "card id sent in the initialization",
      // ticketForm: true,
    },
  },
}
```

| Option | Description |
|--------|-------------|
| `walletForm: true` | Expands the MercadoPago wallet form by default |
| `creditCardForm: true` | Expands the new credit card form by default |
| `debitCardForm: true` | Expands the new debit card form by default |
| `savedCardForm: "<cardId>"` | Expands a specific saved card form (pass the card ID from initialization) |
| `ticketForm: true` | Expands the ticket/cash payment form by default |

---

## Payment methods customization

```js
customization: {
  paymentMethods: {
    creditCard: "all",          // enable all credit cards
    debitCard: "all",           // enable all debit cards
    prepaidCard: "all",         // enable all prepaid cards
    ticket: "all",              // enable all ticket/cash methods
    bankTransfer: "all",        // enable all bank transfers
    mercadoPago: "all",         // enable MP wallet + credits option
    atm: "all",                 // enable ATM methods
    maxInstallments: 12,        // max installments to show (1-24)
    minInstallments: 1,         // min installments to show
  }
}
```

To enable a specific subset of card brands:
```js
creditCard: ["visa", "mastercard", "amex"]
```

---

## Text customization

Payment Brick supports full label and placeholder customization for form fields and section titles.

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
      entityType: {
        placeholder: "string",
        label: "string",
      },
      financialInstitution: {
        placeholder: "string",
        label: "string",
      },
      selectInstallments: "string",
      selectIssuerBank: "string",
      formSubmit: "string",
      paymentMethods: {
        newCreditCardTitle: "string",
        creditCardTitle: "string",
        creditCardValueProp: "string",
        newDebitCardTitle: "string",
        debitCardTitle: "string",
        debitCardValueProp: "string",
        ticketTitle: "string",
        ticketValueProp: "string",
      },
    },
  },
}
```

**Notes on text customization:**

- Setting an **empty string** (`""`) for any text field keeps the default text.
- Custom texts **override the locale**-based defaults. If you set a custom string, it stays the same regardless of the user's language.
- If a custom text is **too long** for the available space, it will be **truncated with "..."**.
- Offline payment method texts use the pattern `{paymentMethodId}{ValueProp}` and `{paymentMethodId}{Title}` (e.g., `boletoTitle`, `boletoValueProp`).

---

## External submit button

To place a submit button outside the Brick, hide the built-in button and call `getFormData()` manually:

```js
customization: {
  visual: {
    hidePaymentButton: true,
  }
}
```

Then trigger submission from your external button:

```js
document.getElementById("myPayButton").addEventListener("click", async () => {
  const { formData } = await window.paymentBrickController.getFormData();
  if (formData) {
    await sendToBackend(formData);
  }
});
```

---

## Notes

- `theme: "dark"` sets a dark background with light text -- useful for dark-mode UIs.
- `theme: "flat"` removes borders and shadows for minimal designs.
- `theme: "bootstrap"` uses Bootstrap-compatible spacing and borders.
- `customVariables` override individual CSS custom properties -- useful for brand color matching.
- Some customization options may not be available in all countries -- always verify with `search_documentation`.

---

## MCP fallback

If this reference is out of date or you need to verify a specific option, always consult the live documentation:

```
mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Payment Brick customization")
```

The MCP response is the authoritative source. This file serves as a quick-start reference only.
