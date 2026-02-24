# Security Integration Reference

## Tokenization Flow

```
Browser (MercadoPago.js)
├── cardForm.createCardToken()
│   └── Returns: card_token (single-use)
└── Token sent to backend
    └── Used in payment.create({ token: card_token })
```

## Token Types

| Type | Lifespan | Use Case |
|------|----------|----------|
| Card Token | Single-use, 7-day expiry | One-time payment |
| Supertoken | Long-lived, reusable | Recurring / saved cards |
| Vault Token | Long-lived, managed | Card-on-file with display |

## 3D Secure Flow

1. Create payment with 3DS enabled
2. If 3DS challenge needed: receive iframe URL
3. Render iframe for cardholder authentication
4. After authentication: payment proceeds
5. 3DS result included in payment response

## PCI Compliance Levels

| Level | Requirement | Who |
|-------|-------------|-----|
| SAQ-A | Use MP.js, never touch card data | Most developers |
| SAQ-D | Handle raw card data | Enterprise, strict audit |

## MercadoPago.js Security Headers

- Always load from `https://sdk.mercadopago.com/js/v2`
- Never self-host the JS SDK
- Public Key is safe to expose client-side
- Access Token MUST stay server-side only

**For current tokenization endpoints and 3DS configuration**: Consult MCP server.
