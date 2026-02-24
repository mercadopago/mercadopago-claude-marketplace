---
description: Review a Mercado Pago payment integration for correctness, security, and best practices — supports all MP products
argument-hint: "[security|webhooks|checkout|qr|subscriptions|marketplace|errors|full]"
allowed-tools: [Read, Grep, Glob, WebFetch, Bash]
---

# /mp-review

Review the current project's Mercado Pago integration for correctness, security, and best practices.

## Instructions

You are performing a Mercado Pago integration review. Use the product-specific skills and the MCP server for current API knowledge.

### Focus Area

If `$ARGUMENTS` is provided, narrow the review to that scope:
- **security** — Credential handling, token storage, HTTPS enforcement, HMAC validation
- **webhooks** — Notification handling, signature validation, idempotency, retry handling
- **checkout** — Preference creation, back_urls, payment flow, Bricks setup
- **qr** — QR code setup, store/POS configuration, order creation
- **subscriptions** — Plan setup, preapproval flow, invoice handling
- **marketplace** — OAuth flow, split payments, application_fee, seller management
- **errors** — Error handling, API error responses, retry logic, edge cases
- **full** — Complete review of all areas (default)

If no argument is given, perform a full review.

### Review Process

1. **Discover MP files** — Use `Grep` to find files importing `mercadopago`, referencing `MP_ACCESS_TOKEN`, or containing payment-related routes
2. **Identify products in use** — Determine which MP products are integrated (checkout, QR, subscriptions, marketplace, etc.)
3. **Activate relevant skills** — Load the corresponding skill(s) for detected products to know what to check
4. **Check security** (all products):
   - No hardcoded access tokens or client secrets
   - `.env` file with MP credentials is in `.gitignore`
   - Webhook signature validation (HMAC-SHA256) implemented
   - HTTPS enforced for callback URLs
   - Server-side payment verification (never trust client-only status)
   - Idempotency keys used for payment creation
   - Test/sandbox credentials separated from production
5. **Check product-specific correctness**:
   - **Checkout Pro**: Required preference fields, back_urls, auto_return, notification_url
   - **Bricks**: Public Key initialization, onSubmit handling, server-side processing
   - **Payments API**: Token handling, payer data, installments, issuer_id
   - **QR**: Store/POS setup, order fields, QR lifecycle
   - **Subscriptions**: Plan configuration, preapproval flow, invoice handling
   - **Marketplace**: OAuth flow, split configuration, application_fee limits
   - **Webhooks**: 200 response before processing, idempotency, async processing
6. **Check best practices**:
   - SDK version is current (check `package.json` or `requirements.txt`)
   - Error responses handled with user-friendly messages
   - external_reference used for reconciliation
   - Country-specific requirements met (currency_id, payment methods)
7. **Consult MCP** — Use the Mercado Pago MCP server for current API requirements and validate against latest specs

### Output Format

```
## MP Integration Review

**Scope**: [full | security | webhooks | checkout | qr | subscriptions | marketplace | errors]
**Products detected**: [list of MP products found in the codebase]
**Files analyzed**: [list of files]

### CRITICAL
- [Issues that will cause failures or security vulnerabilities]

### WARNINGS
- [Issues that may cause problems or don't follow best practices]

### PASS
- [Things that are correctly implemented]

### Recommendations
- [Actionable improvements with references to specific skills/docs]
```
