# 3DS 2.0 Flow Rules (Orders Automatic Only)

## Scope

This skill supports Checkout Bricks with Orders API in `automatic` mode only.

- Endpoint: `POST /v1/orders`
- Required mode: `processing_mode: "automatic"`
- Manual order flow is not supported for this skill.

---

## When 3DS can happen

3DS can be required by issuer/risk rules when creating an order in automatic mode.

If challenge is required, order/payment can return a pending state (for example `pending_challenge` in payment status detail), and Status Screen should be used to continue the buyer flow.

---

## How to get `payment_id` for Status Screen

After `POST /v1/orders`, always extract the payment transaction id from:

- `order.transactions.payments[0].id`

Recommended backend response to frontend:

```json
{
  "order_id": "01JC1KVZ0WJY8Y4WA7MZAD5S2T",
  "payment_id": "pay_01JC1KVZ0WJY8Y4WA7MZG3A8F2",
  "status": "processed",
  "status_detail": "accredited"
}
```

Use this `payment_id` as `initialization.paymentId` in Status Screen Brick.

---

## Automatic flow with Status Screen

```text
1. Buyer submits Payment/Card Payment Brick
2. Frontend sends formData to backend
3. Backend creates order: POST /v1/orders with processing_mode="automatic"
4. Backend extracts payment_id from order.transactions.payments[0].id
5. Frontend navigates to result page with payment_id
6. Status Screen Brick renders with initialization.paymentId = payment_id
7. Brick handles payment result and 3DS challenge UI automatically (when required)
```

---

## Order request baseline (automatic)

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "external_reference": "order_oneshot_123",
  "total_amount": "1000.00",
  "payer": {
    "email": "buyer@example.com"
  },
  "transactions": {
    "payments": [
      {
        "amount": "1000.00",
        "payment_method": {
          "id": "master",
          "type": "credit_card",
          "token": "CARD_TOKEN",
          "installments": 1
        }
      }
    ]
  }
}
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "Checkout API Orders integration model automatic mode 3DS")`
