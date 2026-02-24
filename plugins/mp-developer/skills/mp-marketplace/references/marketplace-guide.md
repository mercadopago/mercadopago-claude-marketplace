# Marketplace Integration Reference

## Architecture

```
Buyer → Marketplace App → Mercado Pago
                        ├── Seller 1 (receives payment - fee)
                        ├── Seller 2
                        └── Marketplace (receives application_fee)
```

## OAuth Flow for Sellers

1. Authorization URL: `https://auth.mercadopago.com/authorization?client_id={APP_ID}&response_type=code&redirect_uri={REDIRECT_URI}`
2. Seller authorizes
3. Callback: `{REDIRECT_URI}?code={AUTH_CODE}`
4. Exchange code for tokens: POST `/oauth/token`
5. Refresh tokens before expiry: POST `/oauth/token` with refresh_token

## Payment with Split

Key fields when creating payment on behalf of seller:
- Use seller's access_token
- Include `application_fee` for marketplace commission
- Include marketplace `collector_id`

## Application Fee Limits

Varies by country and agreement. Typically:
- Maximum % of transaction varies
- Cannot be negative
- Set per-payment, not globally

## VTEX Integration

- Configure via VTEX admin panel
- MP acts as payment provider
- Specific module handles affiliation
- Supports Checkout Pro and custom checkout

**For current OAuth URLs, fee limits, and API endpoints**: Consult MCP server.
