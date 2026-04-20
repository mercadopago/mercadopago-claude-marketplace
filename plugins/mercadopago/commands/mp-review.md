---
description: Review a Mercado Pago payment integration for correctness, security, and best practices — supports all MP products
argument-hint: "[security|webhooks|checkout|qr|point|subscriptions|marketplace|errors|quality|full]"
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
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
- **checkout** — Preference creation, back_urls, payment flow
- **bricks** — Bricks setup, SDK JS initialization and customization, callbacks handling, troubleshooting common errors
- **qr** — QR code setup, store/POS configuration, order creation
- **point** — Device registration, payment intents, firmware, Point webhook (`point_integration_wh`)
- **subscriptions** — Plan setup, preapproval flow, invoice handling
- **marketplace** — OAuth flow, split payments, application_fee, seller management
- **errors** — Error handling, API error responses, retry logic, edge cases
- **quality** — Integration quality checklist against Mercado Pago standards (requires MCP connection)
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
   - Test user credentials separated from production (both use `APP_USR-` prefix)
5. **Check product-specific correctness**:
   - **Checkout Pro**: Required preference fields, back_urls, auto_return, notification_url
   - **Bricks**: SDK initialization, container div before `create()`, onSubmit sends formData to backend, server-side payment with token, amount consistency between Brick and server
   - **Payments API**: Token handling, payer data, installments, issuer_id
   - **QR**: Store/POS setup, order fields, QR lifecycle
   - **Point**: Device registration, payment intent creation, firmware compliance, `point_integration_wh` notification handling
   - **Subscriptions**: Plan configuration, preapproval flow, invoice handling
   - **Marketplace**: OAuth flow, split configuration, application_fee limits
   - **Webhooks**: 200 response before processing, idempotency, async processing
6. **Check best practices**:
   - SDK version is current (check `package.json` or `requirements.txt`)
   - Error responses handled with user-friendly messages
   - external_reference used for reconciliation
   - Country-specific requirements met (currency_id, payment methods)
7. **Consult MCP** — Use the Mercado Pago MCP server for current API requirements and validate against latest specs
8. **Quality checklist** — If the Mercado Pago MCP server is connected (`mcp__mercadopago__*` tools available), call `quality_checklist` to retrieve the official quality evaluation fields. Then:
   - Iterate through **every item** returned by the tool — do not summarize or skip any.
   - For each item, check the codebase (`Grep`/`Read`) to determine if it is **Implemented**, **Missing**, or **Partial**.
   - Render the full results as two tables in the output (see Output Format):
     - **Required fields**: fields the integration MUST implement to meet Mercado Pago quality standards.
     - **Best practices**: optional improvements and recommendations.
   - Add a **Summary** line: "X/Y required fields implemented, Z/W best practices adopted."

   This step runs automatically for `quality` and `full` scopes. For other scopes, skip it.

   Additionally, suggest `quality_evaluation` when it is compatible with the developer's integration. To determine compatibility, follow this logic:

   **Step 1 — Detect what ID the MCP tool requires**: Inspect the `quality_evaluation` tool parameters. Currently it requires `payment_id`. In the future, it may require `order_id` instead.

   **Step 2 — Detect which API the integration uses**: Use `Grep` to determine if the codebase calls the Payments API (`/v1/payments`, `payment.create`, `mercadopago.payment`) or the Orders API (`/v1/orders`, `order.create`, `mercadopago.order`).

   **Step 3 — Match tool requirement to integration type**:
   - If tool requires `payment_id` AND integration uses Payments API → **suggest** `quality_evaluation`. The developer must complete a test payment first to obtain the ID.
   - If tool requires `payment_id` AND integration uses Orders API → **do NOT suggest** `quality_evaluation` (incompatible). No action needed.
   - If tool requires `order_id` AND integration uses Orders API → **suggest** `quality_evaluation`. The developer must complete a test order first.
   - If tool requires `order_id` AND integration uses Payments API → **do NOT suggest** `quality_evaluation`. Instead, **suggest (do not force)** migrating to the Orders API, which is Mercado Pago's unified API going forward.

   Never make `quality_evaluation` mandatory — it is always a suggestion.

### Output Format

```
## MP Integration Review

**Scope**: [full | security | webhooks | checkout | qr | point | subscriptions | marketplace | errors | quality]
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

### Quality Standards (when MCP is connected)


#### Required Fields
| # | Field | Description | Status |
|---|-------|-------------|--------|
| 1 | [field name] | [what the checklist says] | [Implemented / Missing / Partial] |
| 2 | ... | ... | ... |

#### Best Practices
| # | Practice | Description | Status |
|---|----------|-------------|--------|
| 1 | [practice name] | [what the checklist says] | [Implemented / Missing / Partial] |
| 2 | ... | ... | ... |

**Summary**: X/Y required fields implemented, Z/W best practices adopted.

> **Tip**: To evaluate a specific payment, provide a payment ID and we can run `quality_evaluation` for detailed results.
```
