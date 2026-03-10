# Orders Reference

## Concept

An Order (Orden Unificada) allows a single order to be paid with multiple payment methods or in multiple installments. The `merchant_order` entity is the container that tracks the overall order state and aggregates all associated payments.

## merchant_order vs payment

| Entity | Role | Cardinality |
|--------|------|-------------|
| `merchant_order` | The container. Holds total_amount, items, and references to multiple payments. | One per order |
| `payment` | An individual payment. Can be a partial amount of the total. | One or many per merchant_order |

- The `merchant_order` status depends on the aggregate of its payments.
- A single `merchant_order` can have payments from different methods (card, wallet, cash).

## Status Mapping

| merchant_order status | Meaning |
|-----------------------|---------|
| opened | Order created, awaiting payments |
| closed | Fully paid (sum of approved payments >= total_amount) |
| expired | Order expired without receiving full payment |

## Payment Status Within an Order

Each payment follows its own lifecycle:

```
pending --> approved --> (refunded)
        --> rejected
        --> cancelled
```

The `merchant_order` transitions to `closed` only when the sum of `approved` payments covers the `total_amount`.

## Key Fields

**merchant_order**:
- `id`: Mercado Pago internal ID.
- `external_reference`: Your internal order ID.
- `total_amount`: Full amount of the order.
- `items`: Array of line items.
- `payments`: Array of associated payment objects.
- `status`: Aggregate status (opened, closed, expired).

## OU + QR Flow

When combining unified orders with QR:
1. Create the unified order first.
2. Generate or associate a QR payment to the order.
3. The QR payment becomes one of the payments within the `merchant_order`.
4. Additional payments can be added if needed to cover the total.

**For API endpoints, payload schemas, and current field validations**: Consult MCP server.
