# Wallet Integration Reference

## Wallet Connect Flow

1. Redirect user to MP authorization URL with your `client_id` and requested scopes.
2. User logs in and authorizes your application.
3. MP redirects back to your `redirect_uri` with an authorization code.
4. Exchange the code for an access token (user-scoped) via the token endpoint.
5. Use the access token to interact with the user's wallet.

## Wallet Connect Scopes

| Scope | Permission |
|-------|-----------|
| read | Read wallet info (balance, transaction history) |
| write | Create charges against the user's wallet |
| offline_access | Refresh token support (long-lived access) |

## Token Lifecycle

```
authorization_code --> access_token (short-lived)
                   --> refresh_token (long-lived, if offline_access scope)

access_token expired --> use refresh_token --> new access_token
refresh_token revoked --> re-authorize user
```

- Access tokens have a limited lifespan (check `expires_in` in the response).
- Refresh tokens persist until the user revokes authorization.
- Always handle `401 Unauthorized` by attempting a token refresh before prompting re-authorization.

## Debt Payment Flow

1. Create a debt record with: amount, payer identification (DNI/CPF/CURP), description.
2. Generate a payment link or push notification to the payer.
3. Payer accesses the link and pays via Mercado Pago (card, wallet balance, or other method).
4. Receive webhook notification with payment result.
5. Update your internal records with the payment status.

## Debt Payment Fields

- `amount`: Total debt amount.
- `payer.identification`: Document type and number.
- `description`: Reason for the debt.
- `external_reference`: Your internal debt ID for reconciliation.

## Massive Links

- **Bulk generation API**: Submit an array of payment link requests in a single call.
- **CSV upload**: Upload a CSV file with columns for amount, description, payer email, external_reference.
- Each link has a unique ID and independent payment status.
- Track payment status per link via webhooks or the status query endpoint.

## Massive Links Fields

| Field | Description |
|-------|-------------|
| amount | Payment amount |
| description | What the payment is for |
| external_reference | Your internal ID |
| payer_email | Optional: pre-fill payer email |
| expiration_date | Optional: link expiration |

**For API endpoints and current field schemas**: Consult MCP server.
