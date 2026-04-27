# Status Screen Brick — Back URLs Rules

## What are back URLs?

The `backUrls` object configures the destination URLs for the redirect buttons displayed by the Status Screen Brick. It supports two keys: `return` (shown in all states) and `error` (shown when payment has errors).

```js
customization: {
  backUrls: {
    return: "https://yoursite.com/shop",
    error: "https://yoursite.com/error",
  }
}
```

---

## Same domain requirement

URLs must be from the **same domain** as the page where the Status Screen Brick is loaded. URLs from other domains or subdomains are silently ignored.

---

## `return` vs `error`

| Key | When shown |
|---|---|
| `return` | Always — shown whenever the Status Screen Brick is displayed |
| `error` | Only when payment has errors |

Button texts for these URLs can be customized via `customization.visual.texts`:
- `ctaReturnLabel` — customizes the `return` button text
- `ctaGeneralErrorLabel` — customizes the `error` button text for general errors
- `ctaCardErrorLabel` — customizes the `error` button text for card data errors

See `./customization.md` for the full `texts` configuration.

---

## Hiding the back buttons

To hide back buttons entirely, simply don't provide `backUrls` — the object is optional.

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Status Screen Brick backUrls configuration redirect URLs")`
