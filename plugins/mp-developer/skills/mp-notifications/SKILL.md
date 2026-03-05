---
name: mp-notifications
description: Mercado Pago webhook and IPN notification handling. Use when implementing webhook receivers, validating x-signature headers, handling notification retries, debugging missing notifications, or configuring notification types per product.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, webhooks, ipn, notifications, signature, hmac, retry"
---

# Mercado Pago Notifications

## Products Covered
- **Webhooks (v2)**: JSON-based, HMAC-signed. Recommended for all new integrations.
- **IPN (Legacy)**: Query-param based, no signature. Still supported but deprecated for new projects.

## When to Use This Skill
Use when: notification_url, x-signature, webhook, IPN, HMAC, retry, notification types.
Do NOT use for: payment creation (-> mp-checkout-online), QR notifications (-> mp-instore).

## Notification Types by Product
| Product | Event Types |
|---------|-------------|
| Checkout Pro / Bricks / API | payment.created, payment.updated |
| Subscriptions | plan.created, plan.updated, subscription.created, subscription.updated, invoice.created, invoice.updated |
| Point / In-Store | point_integration_wh |
| Marketplace | payment.created, payment.updated (with marketplace context) |
| Chargebacks | chargeback.created, chargeback.updated |
| Delivery | delivery.created, delivery.updated |

## Decision Tree: Webhook vs IPN
```
New integration?
├── YES -> Use Webhooks (v2)
│   ├── Need signature validation? -> YES (always recommended)
│   └── Configure in Dashboard or via notification_url in preference
└── NO (legacy system already using IPN)
    └── Consider migrating to Webhooks
        ├── Benefits: HMAC security, JSON format, better retry
        └── Migration: Update URL, change handler to accept JSON body
```

## Webhook Registration
Two methods:
1. **Dashboard**: Configure globally at mercadopago.com/developers/panel/app
2. **Per-preference**: Set `notification_url` field when creating a preference

Requirements for notification_url:
- MUST be HTTPS (HTTP rejected)
- MUST be publicly accessible
- MUST respond 200/201 within 5 seconds
- MUST NOT return redirects (3xx)

## Webhook Processing Flow
1. Receive POST request from MP
2. Respond 200 immediately (before processing) -- avoids retries
3. Validate x-signature header (HMAC-SHA256)
4. Check idempotency (skip if already processed)
5. Fetch full resource details via API (payment, subscription, etc.)
6. Process business logic based on resource status
7. Store processing result for idempotency

## HMAC-SHA256 Signature Validation (STABLE)

This pattern is stable and rarely changes. Keep it in the skill.

### Header format
```
x-signature: ts=1234567890,v1=abc123def456...
```

### Manifest construction
```
id:{data.id};request-id:{x-request-id};ts:{ts};
```
- `{data.id}` -- From query param `?data.id=xxx` or body `data.id`
- `{x-request-id}` -- From request header
- `{ts}` -- From x-signature header
- **Trailing semicolon is REQUIRED**

### Validation steps
1. Parse `ts` and `v1` from x-signature header
2. Get `data.id` from query string or body
3. Get `x-request-id` from headers
4. Build manifest string: `id:{data.id};request-id:{x-request-id};ts:{ts};`
5. Compute HMAC-SHA256 using webhook secret
6. Compare using timing-safe comparison (prevent timing attacks)

**For working code implementations**: Consult MCP server for current SDK patterns per language.

## Idempotency Pattern
- Webhook notifications may arrive multiple times
- Use database with unique constraint on event_id
- Flow: check exists -> insert -> process -> commit (or rollback on error)
- For simplified dev: in-memory Set (but NOT for production)

## Retry Behavior
| Attempt | Delay |
|---------|-------|
| 1st retry | 5 minutes |
| 2nd retry | 45 minutes |
| 3rd retry | 6 hours |
| 4th retry | 2 days |
| 5th retry | 4 days |

Failure conditions: non-2xx status, timeout >5s, unreachable endpoint.

## IPN (Legacy)
Format: `GET https://yoursite.com/ipn?topic=payment&id=123456789`
- No signature validation
- Query params: topic + id
- Still supported but not recommended for new integrations

## Local Development
- Use `ngrok http <port>` to expose local server
- Copy HTTPS URL as notification_url
- Use ngrok inspector at `http://127.0.0.1:4040` to replay
- ngrok URLs change on restart (unless paid plan)

## Gotchas
- Respond 200 BEFORE processing (async). Slow responses trigger retries.
- The x-signature secret is different from Access Token -- get it from Dashboard webhook config.
- data.id in webhook body is a STRING, not a number in some cases.
- If using notification_url in preference, it overrides Dashboard config for that preference.
- Some event types only fire if you subscribe to them in Dashboard.

## Prerequisites
- Mercado Pago application with webhook URL configured
- Webhook secret (from Dashboard) for HMAC validation
- Public HTTPS endpoint
- Database or cache for idempotency

## What to Fetch from MCP
- Current webhook payload structure per event type
- Available event types for subscription
- Webhook configuration API endpoints
- Code examples per language for signature validation
- Error codes for webhook-related issues

## What to Fetch from Docs (WebFetch fallback)
- `{DOMAIN}/developers/{LANG}/docs/your-integrations/notifications/webhooks`
- `{DOMAIN}/developers/{LANG}/docs/your-integrations/notifications/ipn`
