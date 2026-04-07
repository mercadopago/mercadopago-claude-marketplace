# 3DS 2.0 Flow Rules

## What is 3DS 2.0?

3DS 2.0 (3-D Secure Authentication 2.0) is a technology that enables authentication of credit and debit card transactions in e-commerce, validating that the person making the purchase is the cardholder or has access to their accounts to complete the payment.

Benefits: higher approval probability, chargeback liability shift to the card network, lower fraud risk for the buyer.

---

## When 3DS is triggered

3DS is triggered server-side when:
1. Your payment creation request includes `three_d_secure_mode: "optional"`
2. The card's issuing bank requires authentication for that transaction based on risk profile

> The decision to include or not the Challenge depends on the card issuer and the risk profile of the transaction.

### `three_d_secure_mode` values

| Value | Description |
|---|---|
| `not_supported` | 3DS will not be used (default) |
| `optional` | 3DS may or may not be required, depending on the risk profile of the transaction. **Recommended** — balances security and approval rate |

> MP recommends using `optional` to balance security and transaction approval.

---

## API response when 3DS is required

If 3DS is required, the MP Payments API returns:

```js
{
  "id": 52044997115,                    // payment ID — use this as paymentId for Status Screen Brick
  "status": "pending",                  // payment is waiting for 3DS authentication
  "status_detail": "pending_challenge"  // indicates 3DS challenge is required
}
```

The Status Screen Brick handles the challenge automatically from the `payment_id` — no need to read other fields from the response.

> The user has approximately 5 minutes to complete the challenge. If not completed, the bank will reject the transaction and MP will consider the payment cancelled.

---

## How the Status Screen Brick handles 3DS

When you render the Status Screen Brick with a `payment_id` that has `status: "pending"` and `status_detail: "pending_challenge"`, the Brick handles the 3DS challenge UI automatically.

**Developer action required**: None for the challenge itself. The developer only needs to:
- Render the Status Screen Brick with the `payment_id`
- Configure `backUrls` for navigation after the challenge completes

---

## How to enable 3DS in payment creation

> **⚠️ ACCESS_TOKEN required** — this is server-side code. The AI agent generates it, the seller executes it.

Add `three_d_secure_mode` to your payment request. The capture must be automatic (`capture=true`) and binary mode must be disabled (`binary_mode=false`), since the transaction may remain pending while the buyer completes the challenge.

```js
{
  "transaction_amount": 100,           
  "token": "CARD_TOKEN",               
  "payment_method_id": "visa",         
  "installments": 1,                   
  "payer": { "email": "buyer@example.com" },
  "three_d_secure_mode": "optional",   // REQUIRED for 3DS — "optional" recommended
  "capture": true,                     // REQUIRED for 3DS — must be automatic capture
  "binary_mode": false                 // REQUIRED for 3DS — must be false (payment can stay pending during challenge)
}
// Send via POST to https://api.mercadopago.com/v1/payments with Authorization: Bearer ACCESS_TOKEN
```

---

## 3DS flow

```
1. User submits card form (Card Payment Brick or Payment Brick)
         ↓
2. Frontend sends formData to your backend
         ↓
3. Backend calls MP Payments API with three_d_secure_mode: "optional"
         ↓
4. API returns status: "pending", status_detail: "pending_challenge"
         ↓
5. Backend sends { payment_id, status, status_detail } to frontend
         ↓
6. Frontend detects pending_challenge → renders Status Screen Brick
         ↓
7. Status Screen Brick handles 3DS challenge UI
         ↓
8. User completes challenge
         ↓
9. Status updates to "approved" or "rejected"
```

If 3DS is NOT required (low risk transaction), the API returns `status: "approved"` directly — no challenge needed.

---

## Possible statuses after 3DS

| Status | status_detail | Description |
|---|---|---|
| `approved` | `accredited` | Authentication successful, payment approved |
| `rejected` | `cc_rejected_3ds_challenge` | Authentication failed |
| `canceled` | `expired` | Challenge not completed within timeout (24h to cancel) |
| `pending` | `pending_challenge` | Challenge initiated, waiting for user |

---

## Test cards for 3DS

| Card | Flow | Number | CVV | Expiry |
|---|---|---|---|---|
| Mastercard | Challenge success | 5483 9281 6457 4623 | 123 | 11/30 |
| Mastercard | Challenge rejected | 5361 9568 0611 7557 | 123 | 11/30 |

> 3DS testing must be done in sandbox environment with test credentials. The 3DS flow cannot be tested in production.

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "3DS 2.0 integrate Checkout Bricks three_d_secure_mode")`
