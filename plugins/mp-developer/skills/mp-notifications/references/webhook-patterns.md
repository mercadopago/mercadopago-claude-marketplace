# Webhook Integration Code References

## Webhook Event Types

Full list of notification event types:

| Event | Description |
|-------|-------------|
| `payment.created` | New payment created |
| `payment.updated` | Payment status changed |
| `plan.created` | Subscription plan created |
| `plan.updated` | Subscription plan updated |
| `subscription.created` | Subscription created |
| `subscription.updated` | Subscription updated |
| `invoice.created` | Subscription invoice created |
| `invoice.updated` | Subscription invoice updated |

## Full Webhook Request Headers

```
POST /webhooks/mp HTTP/1.1
Host: yoursite.com
Content-Type: application/json
x-signature: ts=1705312200,v1=a1b2c3d4e5f6...
x-request-id: abc123-def456-ghi789
User-Agent: MercadoPago WebHook v1.0
```

## Signature Manifest Construction

The manifest string used for HMAC-SHA256 must follow this exact format:

```
id:{data.id};request-id:{x-request-id};ts:{ts};
```

Where:
- `{data.id}` — The `data.id` from the query parameter `?data.id=xxx` or from the JSON body `body.data.id`
- `{x-request-id}` — The `x-request-id` header value
- `{ts}` — The `ts` value extracted from the `x-signature` header

**The trailing semicolon is required.**

Example:
```
id:1234567890;request-id:abc123-def456;ts:1705312200;
```

## Production Idempotency with Database

```javascript
// Using a SQL database for production idempotency
async function processWebhook(type, dataId) {
  const connection = await pool.getConnection();

  try {
    // Check if already processed (use a unique constraint on event_id)
    const [existing] = await connection.execute(
      "SELECT id FROM mp_webhook_events WHERE event_id = ?",
      [dataId]
    );

    if (existing.length > 0) {
      return; // Already processed
    }

    // Insert the event (will fail on duplicate due to unique constraint)
    await connection.execute(
      "INSERT INTO mp_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, NOW())",
      [dataId, type]
    );

    // Fetch full payment details
    const payment = new Payment(client);
    const result = await payment.get({ id: dataId });

    // Update order based on payment status
    await updateOrder(connection, result);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

## Webhook Event Schema

```sql
CREATE TABLE mp_webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    processed_at DATETIME NOT NULL,
    UNIQUE KEY uk_event_id (event_id)
);
```

## Complete Payment Status Machine

```
┌──────────┐    ┌────────────┐    ┌──────────┐
│ pending   │───>│ in_process │───>│ approved │
│          │    │            │    │          │
└────┬─────┘    └─────┬──────┘    └──────────┘
     │                │
     │                v
     │          ┌──────────┐
     └─────────>│ rejected │
                │          │
                └──────────┘
```

- `pending` — Waiting for payment (offline methods like boleto/rapipago)
- `in_process` — Under review (manual or automated fraud review)
- `approved` — Payment approved and credited
- `rejected` — Payment rejected (insufficient funds, fraud, etc.)
- `cancelled` — Payment cancelled by user or expired
- `refunded` — Payment refunded (full or partial)
- `charged_back` — Chargeback initiated by cardholder

## Webhook Testing Endpoints

Mercado Pago provides webhook simulation in the Developer Dashboard:
https://www.mercadopago.com.ar/developers/panel/app

Steps:
1. Go to your application settings
2. Navigate to "Webhooks" section
3. Use "Simulate" to send test notifications
4. Check delivery status in the webhook log
