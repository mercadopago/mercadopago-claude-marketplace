---
name: mp-checkout
description: Mercado Pago checkout integration patterns. Use when implementing Checkout Pro, Checkout Bricks, or Payments API flows, creating preferences, handling back_urls, or debugging checkout errors.
metadata:
  version: "1.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, checkout, preference, bricks, payments, sdk"
---

# Mercado Pago Checkout Patterns

## Checkout Pro — Preference Creation

### Node.js (mercadopago v2+)

```javascript
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

async function createPreference(items, buyerEmail) {
  const preference = new Preference(client);

  return preference.create({
    body: {
      items: items.map((item) => ({
        title: item.title,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        currency_id: "ARS",
      })),
      payer: { email: buyerEmail },
      back_urls: {
        success: `${process.env.APP_URL}/payment/success`,
        failure: `${process.env.APP_URL}/payment/failure`,
        pending: `${process.env.APP_URL}/payment/pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.APP_URL}/webhooks/mp`,
      statement_descriptor: "MY_STORE",
      external_reference: `order-${Date.now()}`,
    },
  });
}
```

### Python (mercadopago SDK)

```python
import mercadopago
import os

sdk = mercadopago.SDK(os.environ["MP_ACCESS_TOKEN"])

def create_preference(items, buyer_email):
    preference_data = {
        "items": [
            {
                "title": item["title"],
                "unit_price": float(item["price"]),
                "quantity": int(item["quantity"]),
                "currency_id": "ARS",
            }
            for item in items
        ],
        "payer": {"email": buyer_email},
        "back_urls": {
            "success": f"{os.environ['APP_URL']}/payment/success",
            "failure": f"{os.environ['APP_URL']}/payment/failure",
            "pending": f"{os.environ['APP_URL']}/payment/pending",
        },
        "auto_return": "approved",
        "notification_url": f"{os.environ['APP_URL']}/webhooks/mp",
        "statement_descriptor": "MY_STORE",
        "external_reference": f"order-{int(time.time())}",
    }
    result = sdk.preference().create(preference_data)
    return result["response"]
```

## back_url Parameters

When a buyer completes (or abandons) the checkout, Mercado Pago redirects to the configured `back_url` with these query parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `collection_id` | Payment ID | `1234567890` |
| `collection_status` | Payment status | `approved`, `rejected`, `pending` |
| `payment_id` | Same as collection_id | `1234567890` |
| `status` | Same as collection_status | `approved` |
| `external_reference` | Your order reference | `order-1234` |
| `payment_type` | Payment method type | `credit_card`, `debit_card` |
| `merchant_order_id` | Merchant order ID | `9876543210` |
| `preference_id` | Preference that originated the payment | `123456789-abcdef` |

**Important**: Always verify payment status server-side using the Payments API. Never trust the redirect parameters alone.

## Checkout Bricks — Payment Brick

### Frontend (HTML + JS)

```html
<div id="paymentBrick_container"></div>

<script src="https://sdk.mercadopago.com/js/v2"></script>
<script>
  const mp = new MercadoPago("PUBLIC_KEY_FROM_ENV");

  const bricksBuilder = mp.bricks();

  bricksBuilder.create("payment", "paymentBrick_container", {
    initialization: {
      amount: 100.0,
      preferenceId: "<PREFERENCE_ID>",
    },
    customization: {
      paymentMethods: {
        creditCard: "all",
        debitCard: "all",
        mercadoPago: "all",
      },
    },
    callbacks: {
      onReady: () => {
        // Brick loaded
      },
      onSubmit: async ({ selectedPaymentMethod, formData }) => {
        const response = await fetch("/process-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        return response.json();
      },
      onError: (error) => {
        console.error("Brick error:", error);
      },
    },
  });
</script>
```

### Server-Side Brick Form Processing (Node.js)

```javascript
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

app.post("/process-payment", async (req, res) => {
  const payment = new Payment(client);

  try {
    const result = await payment.create({
      body: {
        transaction_amount: req.body.transaction_amount,
        token: req.body.token,
        description: req.body.description,
        installments: req.body.installments,
        payment_method_id: req.body.payment_method_id,
        issuer_id: req.body.issuer_id,
        payer: {
          email: req.body.payer.email,
          identification: req.body.payer.identification,
        },
      },
      requestOptions: {
        idempotencyKey: crypto.randomUUID(),
      },
    });

    res.json({ status: result.status, detail: result.status_detail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Payment Status Reference

| Status | Status Detail | Meaning |
|--------|--------------|---------|
| `approved` | `accredited` | Payment approved and credited |
| `in_process` | `pending_contingency` | Payment under review |
| `in_process` | `pending_review_manual` | Payment under manual review |
| `rejected` | `cc_rejected_bad_filled_card_number` | Wrong card number |
| `rejected` | `cc_rejected_bad_filled_date` | Wrong expiration date |
| `rejected` | `cc_rejected_bad_filled_other` | Wrong card details |
| `rejected` | `cc_rejected_bad_filled_security_code` | Wrong CVV |
| `rejected` | `cc_rejected_high_risk` | Rejected for fraud risk |
| `rejected` | `cc_rejected_insufficient_amount` | Insufficient funds |
| `rejected` | `cc_rejected_max_attempts` | Too many PIN attempts |
| `pending` | `pending_waiting_payment` | Awaiting offline payment (boleto, etc.) |

## Sandbox Test Cards

For testing in sandbox mode, use these card numbers:

| Card | Number | CVV | Expiration |
|------|--------|-----|------------|
| Mastercard (approved) | `5031 7557 3453 0604` | `123` | `11/25` |
| Visa (approved) | `4509 9535 6623 3704` | `123` | `11/25` |
| American Express (approved) | `3711 803032 57522` | `1234` | `11/25` |

**Test user emails for payment status**:
- `TESTUSER123@testuser.com` — approved
- `TESTUSER456@testuser.com` — rejected
- `TESTUSER789@testuser.com` — pending

See latest test cards: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards
