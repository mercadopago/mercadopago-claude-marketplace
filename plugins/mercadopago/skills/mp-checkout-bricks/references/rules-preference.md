# Preference Creation Rules

## What is a preference?

A preference is a server-side object that tells MercadoPago what is being sold: item names, prices, currency, and redirect URLs after payment. The Brick reads the `preferenceId` to know what to charge and where to redirect the user after payment completes.

**Mental model**: a preference is like a POST body you send to the MP API describing an order — the API returns an `id` you pass to the Brick.

---

## Minimum required fields for a preference

According to MercadoPago's Preferences API, the following fields are REQUIRED for a valid preference:

| Field | Type | Example | Rules |
|---|---|---|---|
| `items` | array | `[{ "title": "Product", "quantity": 1, "unit_price": 29.99 }]` | At least 1 item, max 50 items per preference |
| `items[].title` | string | `"T-Shirt Blue"` | Max 250 characters, alphanumeric, no HTML |
| `items[].quantity` | integer | `1` | Positive integer, ≥ 1 |
| `items[].unit_price` | number | `29.99` | Positive number with up to 2 decimal places |
| `items[].currency_id` | string | `"BRL"` | Must match your country's currency (see table below) |
| `back_urls` | object | `{ "success": "...", "failure": "...", "pending": "..." }` | Optional. If provided, include all three keys |
| `back_urls.success` | URL | `https://yoursite.com/success` | Absolute URL |
| `back_urls.failure` | URL | `https://yoursite.com/failure` | Absolute URL |
| `back_urls.pending` | URL | `https://yoursite.com/pending` | Absolute URL |
| `auto_return` | string | `"approved"` | Optional. Default is `"approved"` — auto-redirects buyer to `back_urls.success` after approval (up to 40 seconds). A "Back to site" button is also shown. |
| `shipments.cost` | number | `15.00` | Optional. Shows shipping cost separately from item total in checkout. |
| `shipments.mode` | string | `"not_specified"` | Required when using `shipments.cost`. The only documented value is `"not_specified"` — shows the cost separately without specifying a shipping method. |
| `purpose` | string | `"wallet_purchase"` | Optional. `"wallet_purchase"` = user must log in to MP. `"onboarding_credits"` = pre-selects MP credit line (MLB/MLA/MLM only). |

---

## Complete example of a preference

This is the full structure you can use as reference:

```json
{
    "items": [
        {
            "id": "item-ID-1234",
            "title": "My product",
            "currency_id": "BRL",
            "picture_url": "https://www.mercadopago.com/org-img/MP3/home/logomp3.gif",
            "description": "Item description",
            "category_id": "art",
            "quantity": 1,
            "unit_price": 75.76
        }
    ],
    "payer": {
        "name": "John",
        "surname": "Doe",
        "email": "john@example.com"
    },
    "back_urls": {
        "success": "https://www.yoursite.com/success",
        "failure": "https://www.yoursite.com/failure",
        "pending": "https://www.yoursite.com/pending"
    },
    "auto_return": "approved",
    "payment_methods": {
        "installments": 12
    },
    "notification_url": "https://www.yoursite.com/webhooks",
    "statement_descriptor": "YOURCOMPANY",
    "external_reference": "order_12345",
    "expires": true,
    "expiration_date_from": "2026-03-28T12:00:00.000Z",
    "expiration_date_to": "2026-04-28T12:00:00.000Z"
}
```

---

## currency_id by siteId

| Country | siteId | currency_id |
|---|---|---|
| Argentina | MLA | ARS |
| Brazil | MLB | BRL |
| Mexico | MLM | MXN |
| Colombia | MCO | COP |
| Chile | MLC | CLP |
| Peru | MPE | PEN |
| Uruguay | MLU | UYU |

---

## Preference expiration

- Default expiration: 5 months from creation
- Use `expires: true` + `expiration_date_to` for shorter windows (e.g., 1 hour for flash sales)
- An expired preference causes the Brick to show an error
- Date format: ISO 8601 (e.g., `2026-04-28T12:00:00.000Z`)

---

## Back URLs rules

After payment, MP redirects the buyer to the configured `back_urls` with query parameters containing the payment result:

| Parameter | Description |
|---|---|
| `payment_id` | Payment ID from MercadoPago |
| `status` | Payment status (`approved`, `rejected`, `pending`) |
| `external_reference` | Your external reference from the preference |
| `payment_type` | Payment method used |
| `merchant_order_id` | Merchant order ID |

> The seller should always **verify payment status server-side** using the `payment_id` — do not trust query params alone. See `./rules-payment.md` "Check payment status".

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `invalid_back_url` | back_url is not absolute or not HTTPS | Use full HTTPS URLs |
| `items_required` | `items` array is empty | Add at least one item |
| `unit_price_invalid` | Price is 0 or negative | Use positive price |
| `currency_id_mismatch` | currency_id doesn't match siteId | Match currency to country |

---

> **⚠️ IMPORTANT — ACCESS_TOKEN security rule**
>
> Creating a preference requires `ACCESS_TOKEN` (secret credential). The AI agent must NEVER execute this code directly — it must NEVER receive, store, or handle the seller's ACCESS_TOKEN. The AI agent should generate this code adapted to the seller's tech stack and guide them to execute it themselves.

## Create via curl

Use this curl command to create a preference on your local machine. Replace the placeholders with your actual data.

```bash
curl -X POST https://api.mercadopago.com/checkout/preferences \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "title": "Product Name",
        "quantity": 1,
        "unit_price": 100.00,
        "currency_id": "BRL"
      }
    ],
    "back_urls": {
      "success": "https://yoursite.com/success",
      "failure": "https://yoursite.com/failure",
      "pending": "https://yoursite.com/pending"
    }
  }'
```

**Steps to run:**
1. Copy the curl command above
2. Replace `<ACCESS_TOKEN>` with your **TEST access token** from the MercadoPago panel
3. Replace the `items`, `currency_id`, and `back_urls` with your actual values
4. Open your terminal and paste the command
5. Press Enter and wait for the response

**The response will look like:**
```json
{
  "id": "1234567890-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "init_point": "https://www.mercadopago.com.br/checkout/...",
  ...
}
```

6. **Copy the `id` field** — that is your **preferenceId**

---

## Production note & lifecycle

The curl command above uses a **TEST access token** (`TEST-...`). Preferences created with test credentials only work in sandbox — this is by design, as TEST and production environments are isolated.

### Lifecycle in production

1. **Seller's frontend** sends a request to the seller's backend (e.g., `POST /api/create-preference`) with cart items, amounts, and buyer info
2. **Seller's backend** creates the preference via `POST https://api.mercadopago.com/checkout/preferences` using their production ACCESS_TOKEN (`APP_USR-...`)
3. **Backend returns** the `preferenceId` to the frontend
4. **Frontend passes** `preferenceId` to the Brick's `initialization.preferenceId`
5. **Brick renders** the MercadoPago wallet/credit payment option using that preference

The AI agent generates the backend endpoint code and the frontend integration code, but the seller deploys and runs it in their own environment with their own credentials.

### Recommendations

- **Create a new preference per transaction** — reusing a preference with outdated items/prices would charge the wrong amount. Preferences have configurable expiration (`expires`, `expiration_date_to`), but creating fresh ones per checkout is the safest approach.
- **Don't hardcode a preferenceId** — a hardcoded ID means every buyer pays for the same items at the same price. The backend should generate a preference dynamically based on the current cart.
- **Use production credentials in production** — preferences created with `TEST-` access token don't work with `APP_USR-` public keys. Switch both credentials when going live.

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "preference creation checkout preferences API")`
