---
description: Review a Mercado Pago payment integration for correctness, security, and best practices
argument-hint: [security|webhooks|checkout|errors]
allowed-tools: [Read, Grep, Glob, WebFetch, Bash]
---

# /mp-review

Review the current project's Mercado Pago integration for correctness, security, and best practices.

## Instructions

You are performing a Mercado Pago integration review. Use the `mp-integration-expert` agent's knowledge to conduct a thorough audit.

### Focus Area

If `$ARGUMENTS` is provided, narrow the review to that area:
- **security** — Focus on credential handling, token storage, HTTPS enforcement
- **webhooks** — Focus on notification handling, signature validation, idempotency
- **checkout** — Focus on preference creation, back_urls, payment flow correctness
- **errors** — Focus on error handling, API error responses, retry logic

If no argument is given, perform a full review covering all areas.

### Review Process

1. **Discover MP files** — Use `Grep` to find files importing `mercadopago`, referencing `MP_ACCESS_TOKEN`, or containing payment-related routes
2. **Read each file** — Understand the integration approach (Checkout Pro, Bricks, Payments API, webhooks)
3. **Check security**:
   - No hardcoded access tokens or client secrets
   - `.env` file exists with MP credentials and is in `.gitignore`
   - Webhook signature validation is implemented
   - HTTPS enforced for callback URLs
4. **Check correctness**:
   - Required preference fields present (`items[].title`, `unit_price`, `quantity`)
   - Payment status verified server-side after redirect
   - Webhook returns 200 immediately, processes asynchronously
   - Idempotency keys used for payment creation
5. **Check best practices**:
   - SDK version is current (check `package.json` or `requirements.txt`)
   - Error responses handled with user-friendly messages
   - Test/sandbox credentials separated from production

### Output Format

```
## MP Integration Review

**Scope**: [full | security | webhooks | checkout | errors]
**Files analyzed**: [list of files]

### CRITICAL
- [Issues that will cause failures or security vulnerabilities]

### WARNINGS
- [Issues that may cause problems or don't follow best practices]

### PASS
- [Things that are correctly implemented]

### Recommendations
- [Actionable improvements with code examples]
```
