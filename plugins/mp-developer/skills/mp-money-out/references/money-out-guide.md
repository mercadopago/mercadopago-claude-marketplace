# Money-Out Integration Reference

## Disbursement Flow

1. Create a disbursement with: amount, recipient details, bank account info.
2. Mercado Pago validates the recipient and bank details (async).
3. Funds are transferred on the next banking cycle.
4. Status updates are sent via webhook.

## Transfer Types

| Type | Recipient | Speed |
|------|-----------|-------|
| Bank Transfer | External bank account | 1-3 business days |
| MP Account Transfer | Another Mercado Pago account | Instant |

## Status Flow

```
created --> in_process --> completed
                      --> failed
                      --> cancelled
```

- **created**: Request received, pending processing.
- **in_process**: Transfer is being processed by the banking network.
- **completed**: Funds have been delivered to the recipient.
- **failed**: Transfer could not be completed (see error code for details).
- **cancelled**: Transfer was cancelled before processing.

## Common Error Codes

| Error Code | Meaning |
|------------|---------|
| insufficient_funds | Not enough available balance in the account |
| invalid_bank_account | Bank account details are invalid or do not match |
| recipient_not_found | Recipient Mercado Pago account not found |
| daily_limit_exceeded | Daily transfer limit has been reached |

## Disbursement Fields

**Required**:
- `amount`: Amount to transfer.
- `currency_id`: Currency code (e.g., ARS, BRL, MXN).
- `external_reference`: Your internal transaction ID for reconciliation.

**Recipient (bank transfer)**:
- `bank_account.bank_id`: Bank identifier.
- `bank_account.account_number`: Account number (CBU/CVU for AR, CLABE for MX, Pix for BR).
- `bank_account.holder_name`: Account holder name.
- `bank_account.holder_id`: Account holder document (type + number).

**Recipient (MP account)**:
- `collector_id`: Mercado Pago user ID of the recipient.

## Bank Account Formats by Country

| Country | Format | Example |
|---------|--------|---------|
| AR | CBU (22 digits) or CVU | 0000000000000000000000 |
| BR | Pix key (CPF, email, phone, random) | 12345678901 |
| MX | CLABE (18 digits) | 000000000000000000 |

## Webhook Events

- `disbursement.created`: Transfer request created.
- `disbursement.updated`: Transfer status changed (in_process, completed, failed).

## Best Practices

- Always check available balance before creating a disbursement.
- Store the disbursement ID and external_reference for reconciliation.
- Implement idempotency by using unique external_reference values.
- Handle async validation: a 201 response means the request was accepted, not that the transfer succeeded.
- Set up webhook listeners to track status changes instead of polling.

**For current API endpoints, payload schemas, and limits**: Consult MCP server.
