# Orders — Server-side Reference (create + check status)

> **⚠️ IMPORTANT — ACCESS_TOKEN security rule**
>

## Create order (curl)

```bash
curl -X POST \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'X-Idempotency-Key: SOME_UNIQUE_VALUE' \
  'https://api.mercadopago.com/v1/orders' \
  -d '{
    "type": "online",
    "processing_mode": "automatic",
    "external_reference": "order_123",
    "transactions": {
      "payments": [
        {
          "amount": 100,
          "payment_method": {
            "id": "visa",
            "type": "credit_card",
            "token": "CARD_TOKEN",
            "installments": 1
          }
        }
      ]
    },
    "payer": {
      "email": "buyer@example.com"
    }
  }'
```

## Extract payment_id for Status Screen

After creating the order, read the first payment transaction id from the response:

```json
{
  "id": "01JC1KVZ0WJY8Y4WA7MZAD5S2T",
  "status": "processed",
  "transactions": {
    "payments": [
      {
        "id": "pay_01JC1KVZ0WJY8Y4WA7MZG3A8F2",
        "status": "processed",
        "status_detail": "accredited"
      }
    ]
  }
}
```

Recommended backend response to frontend:

```json
{
  "order_id": "01JC1KVZ0WJY8Y4WA7MZAD5S2T",
  "payment_id": "pay_01JC1KVZ0WJY8Y4WA7MZG3A8F2",
  "status": "processed",
  "status_detail": "accredited"
}
```

## Check order status (curl)

```bash
curl -X GET \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  'https://api.mercadopago.com/v1/orders/<ORDER_ID>'
```

## Status Screen integration note

When using Status Screen Brick, use the `payment_id` from `order.transactions.payments[0].id`.

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Orders API v1/orders checkout bricks automatic mode")`
