# Webhook Reference Patterns

## Webhook Event Types
| Event | Description |
|-------|-------------|
| payment.created | New payment created |
| payment.updated | Payment status changed |
| plan.created | Subscription plan created |
| plan.updated | Subscription plan updated |
| subscription.created | Subscription created |
| subscription.updated | Subscription updated |
| invoice.created | Subscription invoice created |
| invoice.updated | Subscription invoice updated |
| point_integration_wh | Point device event |
| chargeback.created | Chargeback initiated |
| chargeback.updated | Chargeback status changed |
| delivery.created | Delivery created |
| delivery.updated | Delivery updated |

## Webhook Request Headers
Standard headers sent by MP:
- `Content-Type: application/json`
- `x-signature: ts={timestamp},v1={hmac_hash}`
- `x-request-id: {uuid}`
- `User-Agent: MercadoPago WebHook v1.0`

## Signature Manifest Format
```
id:{data.id};request-id:{x-request-id};ts:{ts};
```
Trailing semicolon is REQUIRED.

## Payment Status Machine
```
pending -> in_process -> approved
pending -> rejected
in_process -> rejected
approved -> refunded
approved -> charged_back
pending -> cancelled
```

Status definitions:
- pending: Awaiting payment (offline methods)
- in_process: Under review
- approved: Payment credited
- rejected: Payment rejected
- cancelled: Cancelled or expired
- refunded: Refunded (full or partial)
- charged_back: Chargeback by cardholder

## Idempotency Strategy
For production, use SQL table with unique constraint:
```sql
CREATE TABLE mp_webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    processed_at DATETIME NOT NULL,
    UNIQUE KEY uk_event_id (event_id)
);
```
Flow: INSERT (catches duplicates via unique constraint) -> fetch resource -> process -> COMMIT or ROLLBACK.

## Webhook Testing
Use Dashboard webhook simulation:
1. Go to application settings in Developer Dashboard
2. Navigate to "Webhooks" section
3. Use "Simulate" to send test notifications
4. Check delivery status in webhook log

**For current payload examples and test data**: Consult MCP server.
