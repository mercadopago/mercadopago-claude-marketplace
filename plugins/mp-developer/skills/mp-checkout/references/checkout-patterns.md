# Checkout Integration Code References

## Preference Required Fields

Every preference must include at least one item with these required fields:

```json
{
  "items": [
    {
      "title": "string (required)",
      "unit_price": "number (required)",
      "quantity": "integer >= 1 (required)"
    }
  ]
}
```

Optional but recommended fields:
- `currency_id` — ISO 4217 currency code (`ARS`, `BRL`, `MXN`, `CLP`, `COP`, `PEN`, `UYU`)
- `description` — Item description
- `picture_url` — Item image URL (shown in checkout)
- `category_id` — Item category for fraud prevention

## Preference Optional Configuration

### Payment Methods

Restrict or exclude payment methods:

```json
{
  "payment_methods": {
    "excluded_payment_methods": [
      { "id": "amex" }
    ],
    "excluded_payment_types": [
      { "id": "atm" }
    ],
    "installments": 6
  }
}
```

### Expiration

Set preference expiration:

```json
{
  "expires": true,
  "expiration_date_from": "2024-01-01T00:00:00.000-03:00",
  "expiration_date_to": "2024-12-31T23:59:59.000-03:00"
}
```

### Shipments

Add shipping cost:

```json
{
  "shipments": {
    "cost": 10.50,
    "mode": "not_specified"
  }
}
```

## Init Point vs Sandbox Init Point

```javascript
const preference = await preferenceClient.create({ body: preferenceData });

// Production checkout URL
const checkoutUrl = preference.init_point;

// Sandbox/testing checkout URL
const sandboxUrl = preference.sandbox_init_point;
```

Always use `sandbox_init_point` during development and testing.

## Multi-Currency Support

The `currency_id` field depends on the country:

| Country | Currency ID | Symbol |
|---------|-------------|--------|
| Argentina | `ARS` | $ |
| Brazil | `BRL` | R$ |
| Mexico | `MXN` | $ |
| Chile | `CLP` | $ |
| Colombia | `COP` | $ |
| Peru | `PEN` | S/ |
| Uruguay | `UYU` | $ |

## Error Response Format

API errors follow this structure:

```json
{
  "message": "invalid items.unit_price",
  "error": "bad_request",
  "status": 400,
  "cause": [
    {
      "code": "invalid_unit_price",
      "description": "unit_price must be a positive number",
      "data": null
    }
  ]
}
```

Always check `cause[]` for specific error codes when debugging API failures.
