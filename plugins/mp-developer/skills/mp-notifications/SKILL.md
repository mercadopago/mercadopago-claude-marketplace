---
name: mp-notifications
description: Mercado Pago webhook and IPN notification handling. Use when implementing webhook receivers, validating x-signature headers, handling notification retries, or debugging missing notifications.
metadata:
  version: "1.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, webhooks, ipn, notifications, signature, hmac"
---

# Mercado Pago Webhook & Notification Patterns

## Webhook Registration

Webhooks are configured in the Mercado Pago Developer Dashboard:
https://www.mercadopago.com.ar/developers/panel/app

Or set per-preference via `notification_url`:

```javascript
const preference = await preferenceClient.create({
  body: {
    // ... items, back_urls, etc.
    notification_url: `${process.env.APP_URL}/webhooks/mp`,
  },
});
```

**Requirements for `notification_url`**:
- Must be HTTPS (HTTP is rejected)
- Must be publicly accessible
- Must respond with 200/201 status within 5 seconds
- Must NOT return redirects (3xx)

## Webhook Payload Structure

```json
{
  "id": 12345678901,
  "live_mode": true,
  "type": "payment",
  "date_created": "2024-01-15T10:30:00.000-03:00",
  "user_id": 123456789,
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "1234567890"
  }
}
```

Common `type` values:
- `payment` — Payment created, updated, or approved
- `plan` — Subscription plan events
- `subscription` — Subscription events
- `invoice` — Subscription invoice events
- `point_integration_wh` — Point device events

## HMAC-SHA256 Signature Validation

Mercado Pago sends an `x-signature` header for webhook security. Always validate it.

### Header format

```
x-signature: ts=1234567890,v1=abc123def456...
```

### Validation — Python (Flask)

```python
import hashlib
import hmac
from flask import Flask, request, jsonify
import os

app = Flask(__name__)

WEBHOOK_SECRET = os.environ["MP_WEBHOOK_SECRET"]

def validate_signature(request):
    x_signature = request.headers.get("x-signature", "")
    x_request_id = request.headers.get("x-request-id", "")

    # Parse ts and v1 from x-signature
    parts = {}
    for part in x_signature.split(","):
        key, _, value = part.partition("=")
        parts[key.strip()] = value.strip()

    ts = parts.get("ts", "")
    expected_hash = parts.get("v1", "")

    if not ts or not expected_hash:
        return False

    # Get data.id from query string or body
    data_id = request.args.get("data.id", "")
    if not data_id:
        body = request.get_json(silent=True) or {}
        data_id = str(body.get("data", {}).get("id", ""))

    # Build the manifest string
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"

    # Compute HMAC-SHA256
    computed = hmac.new(
        WEBHOOK_SECRET.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(computed, expected_hash)


@app.route("/webhooks/mp", methods=["POST"])
def webhook():
    if not validate_signature(request):
        return jsonify({"error": "invalid signature"}), 401

    body = request.get_json()
    # Process notification...
    return jsonify({"status": "ok"}), 200
```

### Validation — Node.js (Express)

```javascript
import crypto from "crypto";

function validateSignature(req) {
  const xSignature = req.headers["x-signature"] || "";
  const xRequestId = req.headers["x-request-id"] || "";

  // Parse ts and v1
  const parts = {};
  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    parts[key.trim()] = value.trim();
  });

  const ts = parts.ts || "";
  const expectedHash = parts.v1 || "";

  if (!ts || !expectedHash) return false;

  // Get data.id from query or body
  const dataId = req.query["data.id"] || String(req.body?.data?.id || "");

  // Build manifest
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Compute HMAC-SHA256
  const computed = crypto
    .createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(expectedHash)
  );
}

app.post("/webhooks/mp", (req, res) => {
  if (!validateSignature(req)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  // Respond quickly, process async
  res.sendStatus(200);

  const { type, data } = req.body;
  processNotification(type, data.id).catch(console.error);
});
```

## Idempotency Pattern

Webhook notifications may be sent multiple times. Always handle duplicates:

```javascript
// Use a database or cache in production — this is a simplified example
const processedEvents = new Set();

async function processNotification(type, paymentId) {
  const key = `${type}:${paymentId}`;
  if (processedEvents.has(key)) return;
  processedEvents.add(key);

  try {
    const payment = new Payment(client);
    const result = await payment.get({ id: paymentId });

    // Process based on result.status
    await updateOrderStatus(result.external_reference, result.status);
  } catch (error) {
    // Remove from set so it can be retried
    processedEvents.delete(key);
    throw error;
  }
}
```

## Retry Behavior

Mercado Pago retries failed webhooks with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 5 minutes |
| 2nd retry | 45 minutes |
| 3rd retry | 6 hours |
| 4th retry | 2 days |
| 5th retry | 4 days |

A notification is considered failed if:
- The endpoint returns a non-2xx status code
- The endpoint does not respond within 5 seconds
- The endpoint is unreachable

## IPN (Legacy Notifications)

IPN is the older notification system. New integrations should use webhooks, but IPN is still supported:

```
https://yoursite.com/ipn?topic=payment&id=123456789
```

### IPN vs Webhooks

| Feature | IPN | Webhooks |
|---------|-----|----------|
| Format | Query params (`topic` + `id`) | JSON body |
| Security | No signature | HMAC-SHA256 `x-signature` |
| Retry | Yes | Yes, with exponential backoff |
| Recommended | Legacy only | Yes (all new integrations) |

## Local Development with ngrok

For testing webhooks locally:

```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Set it as notification_url in your preference:
# notification_url: "https://abc123.ngrok.io/webhooks/mp"
```

Tips:
- Use ngrok's web inspector at `http://127.0.0.1:4040` to replay failed webhooks
- Remember that ngrok URLs change every restart (unless you have a paid plan)
- Always use the HTTPS URL, not HTTP

## Troubleshooting

### Not receiving webhooks
1. Check `notification_url` is HTTPS and publicly accessible
2. Verify the URL responds with 200 within 5 seconds
3. Check the Mercado Pago Dashboard webhook logs for delivery attempts
4. Ensure the URL does not redirect (3xx responses cause failures)

### Receiving duplicate notifications
1. Implement idempotency based on `data.id`
2. Store processed payment IDs in your database
3. Return 200 immediately, process asynchronously

### Signature validation failing
1. Verify `MP_WEBHOOK_SECRET` matches the secret in your Dashboard
2. Check the manifest string format: `id:{data.id};request-id:{x-request-id};ts:{ts};`
3. Ensure you're using HMAC-SHA256 (not SHA256 alone)
4. Use timing-safe comparison to prevent timing attacks
