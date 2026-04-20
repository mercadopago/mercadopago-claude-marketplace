# Wallet Brick -- Customization Reference

> **Always verify latest options** by calling:
> ```
> mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Wallet Brick customization button visual options")
> ```
> This file is a starting reference. MercadoPago may add new configuration params at any time.

---

## What you CAN customize

- `theme` — switch between default (blue) and dark (black) button
- `customStyle` — adjust `valueProp`, `valuePropColor`, `buttonHeight`, `borderRadius`, `verticalPadding`, `horizontalPadding`, and `hideValueProp`

Do NOT override button appearance with custom CSS — see `./troubleshooting.md` "Button broken by custom CSS".

---

## Theme

The `theme` property controls the overall button appearance.

| Value | Appearance |
|---|---|
| `"default"` | MercadoPago blue button (standard) |
| `"dark"` | Black button |

```js
customization: {
  theme: 'default',  // "default" | "dark"
}
```

---

## Button style (`customStyle`)

All button visual properties live under `customStyle` (not `visual`).

```js
customization: {
  customStyle: {
    valueProp: 'security_safety',
    valuePropColor: 'blue',
    buttonHeight: '48px',
    borderRadius: '6px',
    verticalPadding: '8px',
    horizontalPadding: '0px',
    hideValueProp: false,
  }
}
```

### Property reference

| Key | Options | Default |
|---|---|---|
| `customStyle.valueProp` | See "Button text variants" section below | `"security_safety"` |
| `customStyle.valuePropColor` | For `"default"` theme: `"blue"` or `"white"`. For `"dark"` theme: `"black"` | default theme: `"blue"`, dark theme: `"black"` |
| `customStyle.buttonHeight` | Min: `48px`, no max limit | `48px` |
| `customStyle.borderRadius` | Any valid CSS value | `6px` |
| `customStyle.verticalPadding` | Min: `8px`, no max limit | `8px` |
| `customStyle.horizontalPadding` | Min: `0px`, no max limit | `0px` |

---

## Button text variants (`valueProp`)

The Wallet Brick renders a button ("Pagar com/con Mercado Pago") with a descriptive text below it. The `valueProp` property controls that descriptive text. Default is `"security_safety"`.

```js
customization: {
  customStyle: {
    valueProp: 'security_safety',
  }
}
```

### Available options

**MLB, MLA, MLM:**

| `valueProp` value | Text shown to user | When to use |
|---|---|---|
| `"security_safety"` **(DEFAULT)** | "Pague com segurança" / "Paga de forma segura" | Best general-purpose option. Builds trust with buyers who are cautious about paying online. Works well for any type of product or service. |
| `"practicality"` | "Use cartões salvos ou seu saldo em conta" / "Usa tarjetas guardadas o dinero en cuenta" | Best for stores where most buyers already have a MercadoPago account. Highlights that checkout is fast because their cards and balance are already saved — reduces friction for returning customers. |
| `"convenience_all"` | "Parcelamento com cartão ou com Linha de Crédito" / "Cuotas con tarjeta o Cuotas sin Tarjeta" | Best for sellers offering installments on medium/high-value products. Shows buyers they can split the payment either with their own card or using MP's credit line — increases conversion on expensive items. |
| `"security_details"` | "Proteção para seus dados" / "Todos tus datos protegidos" | Best for high-value purchases (electronics, travel, etc.) where buyers worry about data safety. Emphasizes that MP protects their personal and payment data. |
| `"convenience_credits"` | "Até 12x com Linha de Crédito Mercado Pago" / "Hasta 12 Cuotas sin Tarjeta" | Best when the seller specifically wants to promote MP's credit line as a differentiator. Useful when the target audience may not have a credit card but has a MP account with available credit. Requires preference with `purpose: "onboarding_credits"`. |
| `"payment_methods_logos"` | Shows logos of accepted payment methods (Visa, Mastercard, Pix, etc.) instead of text | Best when the seller accepts many payment methods and wants to visually communicate that to the buyer. Logos are determined by the methods configured in the preference. If only one method is valid, MP shows text instead of logos. |

**MCO, MLC, MPE, MLU:**

| `valueProp` value | Text shown to user | When to use |
|---|---|---|
| `"security_safety"` **(DEFAULT)** | "Paga de forma segura" | Best general-purpose option for all contexts. |
| `"practicality"` | "Usa tarjetas guardadas o dinero en cuenta" | Best for stores with returning MP users who have saved payment methods. |
| `"security_details"` | "Todos tus datos protegidos" | Best for high-value purchases where data protection messaging matters. |
| `"payment_methods_logos"` | Shows logos of accepted payment methods instead of text | Best when the seller wants to visually show which methods are accepted. Logos come from the preference. |

---

## Redirect mode (`redirectMode`)

Controls how the MP checkout opens when the user clicks the button. Set in `initialization`, not `customization`.

| Value | Behavior |
|---|---|
| `"self"` **(default)** | Redirects in the same page |
| `"blank"` | Opens in a new tab |

```js
initialization: {
  preferenceId: "<preference_id>",
  redirectMode: "self",  // or "blank"
}
```

Configure `back_urls` in the preference to receive the user back after payment — see `../../references/rules-preference.md`.

---

## Hide value prop text

Set `hideValueProp: true` inside `customStyle` to hide the descriptive text below the button label entirely.

```js
customization: {
  customStyle: {
    hideValueProp: true,   // boolean, default: false
  }
}
```

---

## Complete customization example

```js
const settings = {
  customization: {
    theme: 'dark',
    customStyle: {
      valueProp: 'practicality',
      valuePropColor: 'black',
      buttonHeight: '48px',
      borderRadius: '10px',
      verticalPadding: '10px',
      horizontalPadding: '10px',
    },
  }
};

const walletBrickController = await bricksBuilder.create(
  'wallet',
  'walletBrick_container',
  {
    initialization: {
      preferenceId: '<preference_id>',
      redirectMode: 'self',  // "self" (same page) or "blank" (new tab)
    },
    customization: settings.customization,
    callbacks: {
      onReady: () => {},
      onSubmit: () => {},
      onError: (e) => console.error(e),
    }
  }
);
```

---

## Notes

- The button text is automatically translated to the correct language based on `locale`.
- Button color is determined by `theme` (`"default"` = blue, `"dark"` = black). There is no separate `buttonBackground` property.
- `valuePropColor` valid values depend on the selected `theme`.
- Do NOT override button appearance with custom CSS — see `./troubleshooting.md` "Button broken by custom CSS".

---

## MCP fallback

If any property listed here seems outdated or a new option is not covered, query the latest documentation:

```
mcp__mercadopago__search_documentation(siteId: "<siteId>", term: "Wallet Brick customization customStyle valueProp")
```
