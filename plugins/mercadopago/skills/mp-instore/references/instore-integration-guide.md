# In-Store Integration Reference

## QR Code Types

| Type | Use Case | QR Lifecycle |
|------|----------|-------------|
| QR Attended | Fixed POS, cashier creates order | QR is permanent, orders rotate |
| QR Dynamic | Unique per transaction | QR generated per order, single use |

## Store and POS Hierarchy

```
Business Account
+-- Store (physical location)
    +-- POS (point of sale within store)
        +-- QR Code (associated to POS)
```

- Each store has: `name`, `external_id`, `location` (address, lat/lng).
- Each POS has: `name`, `external_id`, `fixed_amount` (bool), store association.
- QR is generated per POS. One POS = one QR code.

## Point Device Models

| Model | Features |
|-------|----------|
| Point Smart | Touchscreen, prints receipts, Wi-Fi and 4G connectivity |
| Point Plus | Portable, Bluetooth connection to phone/tablet |
| Point Mini | Basic card reader, Bluetooth connection |

## Order Fields (QR)

**Required fields**:
- `external_reference`: Your internal order ID for reconciliation.
- `title`: Description of the order.
- `total_amount`: Total amount to charge.
- `items`: Array of line items.
- `notification_url`: URL to receive payment webhooks.

**Item fields**:
- `title`: Item description.
- `unit_price`: Price per unit.
- `quantity`: Number of units.
- `unit_measure`: Unit of measure (e.g., "unit").
- `total_amount`: Total for this line item.

## Notification Flow

- **QR**: Standard webhook events `payment.created` and `payment.updated`.
- **Point**: Uses `point_integration_wh` event type.
- **Both**: Always verify the payment server-side after receiving the notification. Never trust client-side data alone.

## Common Integration Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| QR not found | POS not properly configured | Verify store and POS exist in dashboard |
| Order already exists | Duplicate external_reference for same POS | Use unique external_reference per order |
| Device not found | Device not registered or offline | Check device registration and connectivity |

**For current API endpoints and payloads**: Consult MCP server.
