# Orders API Reference

## Concept

The Orders API (`POST /v1/orders`) is Mercado Pago's unified order system. A single order can be paid with multiple payment methods or in multiple installments. The order entity tracks the overall state and aggregates all associated payments.

**Legacy note**: The older `merchant_orders` API is a different, legacy system. If you encounter `merchant_orders` in existing code, consider migrating to the Orders API.

## Order vs Payment

| Entity | Role | Cardinality |
|--------|------|-------------|
| `order` | The container. Holds total_amount, items, and references to multiple payments. | One per order |
| `payment` | An individual payment. Can be a partial amount of the total. | One or many per order |

- The order status depends on the aggregate of its payments.
- A single order can have payments from different methods (card, wallet, cash).

## Status Mapping

| Order status | Meaning |
|-------------|---------|
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

The order transitions to `closed` only when the sum of `approved` payments covers the `total_amount`.

## Key Fields

**order**:
- `id`: Mercado Pago internal ID.
- `external_reference`: Your internal order ID.
- `total_amount`: Full amount of the order.
- `items`: Array of line items.
- `payments`: Array of associated payment objects.
- `status`: Aggregate status (opened, closed, expired).

## Orders + QR Flow

When combining orders with QR:
1. Create the order via Orders API first.
2. Generate or associate a QR payment to the order.
3. The QR payment becomes one of the payments within the order.
4. Additional payments can be added if needed to cover the total.

**For API endpoints, payload schemas, and current field validations**: Consult MCP server.
