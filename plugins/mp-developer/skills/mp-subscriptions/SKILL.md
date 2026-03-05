---
name: mp-subscriptions
description: Mercado Pago Subscriptions and recurring payments. Covers subscription plans, preapprovals, invoices, and Click & Collect. Use when implementing recurring billing.
license: Apache-2.0
metadata:
  version: "2.0.1"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, subscriptions, recurring, plan, preapproval, invoice, click-collect"
---

# mp-subscriptions

Mercado Pago Subscriptions and recurring payments. Covers subscription plans, preapprovals, invoices, and Click & Collect.

## Products Covered

- **Subscription Plans**: Fixed recurring billing with a defined amount and interval. Mercado Pago charges automatically.
- **Preapproval**: Authorized future charges. The user grants permission, and you charge on demand.
- **Invoices**: Individual charges within a subscription. Each billing cycle generates an invoice.
- **Click & Collect (C&C)**: Recurring collection variant for specific use cases.

## When to Use This Skill

Trigger on keywords: subscription, suscripcion, plan, recurrence, recurring, preapproval, invoice, cobro recurrente, pago recurrente.

**NOT** for one-time payments -- redirect to `mp-checkout-online` instead.

## Decision Tree

```
Need recurring payments
|-- Fixed amount, regular interval?
|   +-- Subscription Plan (create plan --> subscriber subscribes)
|-- Variable amounts on demand?
|   +-- Preapproval (authorize --> charge when needed)
+-- Recurring with flexible schedule?
    +-- Preapproval with manual invoicing
```

## Integration Flow: Subscription Plan

1. Create a plan defining the amount, frequency, and billing day.
2. Share the subscription URL with the user, or create a preapproval directly.
3. User authorizes the subscription (via redirect or API).
4. Mercado Pago charges automatically at each interval.
5. Monitor subscription status and invoices via webhooks.

## Integration Flow: Preapproval

1. Create a preapproval request specifying the authorized maximum amount.
2. User authorizes the preapproval (grants permission for future charges).
3. Create invoices on demand when you need to charge.
4. Mercado Pago processes each invoice against the authorized preapproval.

## Gotchas

- Plans **cannot be modified** once subscribers exist. You must create a new plan and migrate subscribers.
- Preapproval amounts cannot exceed the authorized maximum set during creation.
- Invoice retries follow Mercado Pago's standard retry schedule. Failed invoices enter a `recycling` state before being cancelled.
- Subscription webhook events use specific topics: `plan.*`, `subscription.*`, `invoice.*`.
- Free trial periods are optional but must be set at plan creation time.
- Billing day (`billing_day`) determines when in the month the charge occurs for monthly plans.

## Prerequisites

- Active Mercado Pago account with credentials (public key + access token).
- Configured notification URL for subscription events (plan, subscription, invoice webhooks).

## Country Availability

- AR, BR, MX, CL, CO, PE, UY (specific features and payment methods vary by country).

## What to Fetch from MCP

Use the MCP server to retrieve current data for:
- Plan creation endpoint and payload schema
- Preapproval creation and management endpoints
- Invoice management endpoints (create, query, cancel)
- Subscription webhook event schemas

## What to Fetch from Docs

- `{DOMAIN}/developers/{LANG}/docs/subscriptions/landing`
