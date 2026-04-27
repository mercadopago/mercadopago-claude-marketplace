# Status Screen Brick — Customization Reference

> **Always verify latest options** by calling:
> ```
> mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Status Screen Brick customization display options")
> ```
> This file is a starting reference. MercadoPago may add new configuration params at any time.

---

## Visual customization

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
    hideStatusDetails: false,           // Hide payment details section
    hideTransactionDate: false,         // Hide transaction date/time
    showExternalReference: false,       // Show external_reference from Orders API
    texts: {
      ctaGeneralErrorLabel: "string",   // Button text for general payment errors
      ctaCardErrorLabel: "string",      // Button text for card data errors
      ctaReturnLabel: "string",         // Return button text (shown in all states)
    },
  },
  backUrls: {
    error: "https://yoursite.com/error",    // Shown when payment has errors
    return: "https://yoursite.com/homepage", // Shown in ALL states
  },
}
```

---

## Themes

| Theme | Best for |
|---|---|
| `"default"` | Standard white/light background sites |
| `"dark"` | Dark-mode checkout flows |
| `"flat"` | Minimal, border-less designs |
| `"bootstrap"` | Bootstrap-based sites |

---

## Display options

### Hide status details
```js
customization: {
  visual: {
    hideStatusDetails: true,   // Hides amount, payment method, installments
  }
}
```
Use when you want a minimal result screen without transaction details.

### Hide transaction date
```js
customization: {
  visual: {
    hideTransactionDate: true,  // Hides timestamp of transaction
  }
}
```

### Show external reference
```js
customization: {
  visual: {
    showExternalReference: true,  // Displays the external_reference from the Orders API
  }
}
```
Use when you want to show the merchant-defined reference ID (the `external_reference` field sent when creating the payment) on the status screen.

---

## Text customization

Override the default button labels shown on the status screen:

```js
customization: {
  visual: {
    texts: {
      ctaGeneralErrorLabel: "Try again",        // Button text for general payment errors
      ctaCardErrorLabel: "Re-enter card data",  // Button text for card data errors
      ctaReturnLabel: "Back to shop",           // Return button text (shown in all states)
    },
  },
}
```

| Property | When shown | Default behavior |
|---|---|---|
| `ctaGeneralErrorLabel` | Payment failed due to a general error | Localized default text |
| `ctaCardErrorLabel` | Payment failed due to card data issues | Localized default text |
| `ctaReturnLabel` | All payment states (approved, pending, rejected) | Localized default text |

These labels customize the text of the buttons that navigate to the `backUrls` destinations.

---

## Back URLs

The `backUrls` object configures the destination URLs for the action buttons displayed by the Status Screen Brick. URLs must be from the **same domain** as the page hosting the Brick.

```js
customization: {
  backUrls: {
    error: "https://yoursite.com/error",     // Shown when payment has errors
    return: "https://yoursite.com/homepage",  // Shown in ALL states
  }
}
```

| Property | When shown | Purpose |
|---|---|---|
| `return` | All states (approved, pending, rejected) | General navigation back to your site |
| `error` | Only when payment has errors | Navigate to an error-specific page |

**Button text** for these URLs is customizable via `ctaGeneralErrorLabel`, `ctaCardErrorLabel`, and `ctaReturnLabel` (see Text customization above).

To hide the back buttons, simply omit the `backUrls` object entirely.

> **Important**: `backUrls` is an object with `error` and `return` keys. It is NOT a single string.

---

## Complete customization example

```js
const statusScreenBrickController = await bricksBuilder.create(
  "statusScreen",
  "statusScreenBrick_container",
  {
    initialization: {
      paymentId: "pay_01JC1KVZ0WJY8Y4WA7MZG3A8F2", // From Orders response: transactions.payments[0].id
    },
    customization: {
      visual: {
        style: {
          theme: "default",
          customVariables: {
            baseColor: "#ff6900",       // Your brand color
          }
        },
        hideStatusDetails: false,
        hideTransactionDate: false,
        showExternalReference: true,
        texts: {
          ctaReturnLabel: "Back to shop",
          ctaGeneralErrorLabel: "Try again",
          ctaCardErrorLabel: "Review card details",
        },
      },
      backUrls: {
        error: "https://yoursite.com/checkout/error",
        return: "https://yoursite.com/catalog",
      },
    },
    callbacks: {
      onReady: () => {
        // Brick rendered
      },
      onError: (error) => {
        console.error(error.cause, error.message);
      },
    }
  }
);
```

---

## React example

```jsx
import { StatusScreen, initMercadoPago } from "@mercadopago/sdk-react";

initMercadoPago("YOUR_PUBLIC_KEY", { locale: "pt-BR" });

export function PaymentResult({ paymentId }) {
  return (
    <StatusScreen
      initialization={{ paymentId }}
      customization={{
        visual: {
          style: { theme: "default" },
          showExternalReference: true,
          texts: {
            ctaReturnLabel: "Back to shop",
          },
        },
        backUrls: {
          error: "https://yoursite.com/error",
          return: "https://yoursite.com/shop",
        },
      }}
      onReady={() => {}}
      onError={(e) => console.error(e)}
    />
  );
}
```

---

## Notes

- `showExternalReference` displays the `external_reference` value you set when creating the payment via the Orders API. If no `external_reference` was set on the payment, nothing is shown even when `true`.
- The 3DS challenge UI is fully controlled by MP -- no customization options for the challenge itself.
- `hideStatusDetails: true` is useful for compact post-payment confirmations.
- Button texts (`cta*Label`) override the default localized strings. If omitted, MP provides localized defaults automatically.

---

## MCP fallback

If this reference did not cover a specific customization detail, search official documentation:
```
mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Status Screen Brick customization visual texts backUrls")
```
