# Payment — Server-side Reference (create + check status)

> **⚠️ IMPORTANT — ACCESS_TOKEN security rule**
>
> Creating a payment requires `ACCESS_TOKEN` (secret credential). The AI agent must NEVER execute this code directly — it must NEVER receive, store, or handle the seller's ACCESS_TOKEN. The AI agent should generate this code adapted to the seller's tech stack and guide them to execute it themselves.

## Python

```python
import mercadopago
sdk = mercadopago.SDK("YOUR_ACCESS_TOKEN")
# Use sdk.payment().create(payment_data) — see curl below for full payload structure
```

---

## Node.js

```js
const { MercadoPagoConfig, Payment } = require("mercadopago");
const client = new MercadoPagoConfig({ accessToken: "YOUR_ACCESS_TOKEN" });
const paymentClient = new Payment(client);
// Use paymentClient.create({ body: paymentData }) — see curl below for full payload structure
```

---

## curl (full payload)

```bash
curl -X POST \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'X-Idempotency-Key: SOME_UNIQUE_VALUE' \
  'https://api.mercadopago.com/v1/payments' \
  -d '{
    "transaction_amount": 100,
    "token": "ff8080814c11e237014c1ff593b57b4d",
    "description": "Product description",
    "installments": 1,
    "payment_method_id": "visa",
    "issuer_id": 310,
    "payer": {
      "email": "PAYER_EMAIL_HERE",
      "identification": {
        "number": "19119119100",
        "type": "CPF"
      }
    }
  }'
```

---

## Check payment status

```python
import mercadopago
sdk = mercadopago.SDK("YOUR_ACCESS_TOKEN")
# Use sdk.payment().get(payment_id)
```

```js
const { MercadoPagoConfig, Payment } = require("mercadopago");
const client = new MercadoPagoConfig({ accessToken: "YOUR_ACCESS_TOKEN" });
const paymentClient = new Payment(client);
// Use paymentClient.get({ id: paymentId })
```

```bash
curl -X GET \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  'https://api.mercadopago.com/v1/payments/<PAYMENT_ID>'
```

---

## MCP fallback

If this reference did not cover a specific detail, search official documentation:
`mcp__mercadopago__search_documentation(siteId, term: "create payment API v1 payments")`
