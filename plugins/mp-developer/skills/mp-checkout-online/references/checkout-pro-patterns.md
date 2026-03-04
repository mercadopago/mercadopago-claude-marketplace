# Checkout Pro Integration Patterns

## Preference Required Fields

Every preference must include at least one item with: title (string, required), unit_price (number, required), quantity (integer >= 1, required).

Optional but recommended: currency_id, description, picture_url, category_id.

## Preference Optional Configuration

### Payment Methods

Restrict or exclude payment methods via `payment_methods.excluded_payment_methods`, `excluded_payment_types`, `installments`.

### Expiration

Set preference expiration with `expires`, `expiration_date_from`, `expiration_date_to`.

### Shipments

Add shipping cost via `shipments.cost` and `shipments.mode`.

## Init Point

- `preference.init_point` -- Valid checkout URL
- Always use init_point

## back_url Query Parameters

When buyer completes checkout, MP redirects with: collection_id, collection_status, payment_id, status, external_reference, payment_type, merchant_order_id, preference_id.

**Always verify payment status server-side.**

## Multi-Currency

| Country | Currency ID |
|---------|-------------|
| Argentina | ARS |
| Brazil | BRL |
| Mexico | MXN |
| Chile | CLP |
| Colombia | COP |
| Peru | PEN |
| Uruguay | UYU |

## Error Response Format

API errors include: message, error, status, cause[] array. Always check cause[] for specific error codes.

**For exact payload schemas and current field validations**: Consult MCP server.
