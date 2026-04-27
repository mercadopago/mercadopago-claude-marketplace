# Specialized Integrations Reference

## Insurance Payments (Argentina)

- Requires specific contractual agreement with MP
- Supports recurring billing for insurance premiums
- Special fields: policy_id, insurance_type, premium_amount
- Webhook events specific to insurance billing cycle

## Yape (Peru)

- Mobile wallet popular in Peru
- Integration through MP as payment method
- Buyer pays via Yape app (QR or phone number)
- Settlement through MP account
- Requires Yape-specific payment_method_id

## Fintoc (Chile)

- Bank transfer provider for Chile
- Integration through MP checkout
- Buyer authenticates with bank credentials
- Instant confirmation (vs traditional bank transfer delay)
- Requires Fintoc-specific configuration in MP Dashboard

## PSE (Colombia)

- Bank transfer method for Colombia
- Integration through MP Checkout API or Bricks
- Buyer selects bank and authenticates via PSE
- Requires payer identification (CC) and entity_type
- Callback URL required for bank redirect flow

**For API endpoints, configuration steps, and current availability**: Consult MCP server.
