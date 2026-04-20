# Subscriptions Integration Reference

## Plan Fields

**Required**:
- `reason`: Description of the subscription plan (shown to the subscriber).
- `auto_recurring.frequency`: Number of intervals between charges (e.g., 1).
- `auto_recurring.frequency_type`: Interval unit (`days` or `months`).
- `auto_recurring.transaction_amount`: Amount to charge per cycle.
- `auto_recurring.currency_id`: Currency code (e.g., ARS, BRL, MXN).

**Optional**:
- `back_url`: URL to redirect the user after subscribing.
- `auto_recurring.billing_day`: Day of the month for monthly charges (1-28).
- `auto_recurring.free_trial`: Object defining free trial period (frequency, frequency_type).

## Frequency Types

| Type | Description | Example |
|------|-------------|---------|
| days | Charge every N days | frequency=7, frequency_type=days (weekly) |
| months | Charge every N months | frequency=1, frequency_type=months (monthly) |

## Subscription Lifecycle

```
authorized --> paused --> cancelled
           --> active --> cancelled
```

- **authorized**: User has approved but first charge has not occurred.
- **active**: Subscription is running, charges are being made.
- **paused**: Temporarily stopped, can be resumed.
- **cancelled**: Permanently ended, cannot be reactivated.

## Invoice States

| State | Meaning |
|-------|---------|
| scheduled | Upcoming charge, not yet processed |
| processed | Successfully charged |
| recycling | Retrying a failed charge (automatic retries) |
| cancelled | Charge cancelled, will not be retried |

## Webhook Events

| Event | Trigger |
|-------|---------|
| plan.created | A new plan is created |
| plan.updated | A plan is modified |
| subscription.created | A user subscribes to a plan |
| subscription.updated | Subscription status changes (active, paused, cancelled) |
| invoice.created | A new invoice is generated for a billing cycle |
| invoice.updated | Invoice status changes (processed, recycling, cancelled) |

## Common Integration Patterns

### Plan with Free Trial
Create the plan with `auto_recurring.free_trial` set. The first charge occurs after the trial period ends.

### Pause and Resume
Use the subscription update endpoint to change status to `paused` or `active`. Pausing stops future invoices; resuming restarts the billing cycle.

### Migration Between Plans
Since plans cannot be modified with active subscribers, create a new plan and cancel-then-resubscribe users to the new plan.

**For current API endpoints and payload schemas**: Consult MCP server.
