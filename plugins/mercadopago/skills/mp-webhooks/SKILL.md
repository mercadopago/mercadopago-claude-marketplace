---
name: mp-webhooks
description: Configure, simulate, and validate Mercado Pago webhooks. Wraps the MCP webhook tools (save_webhook, simulate_webhook, notifications_history_diagnostics) and provides the HMAC-SHA256 signature validation pattern that every receiver must implement. Use when adding, debugging, or hardening notification handling.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, webhooks, notifications, ipn, hmac, signature"
---

# mp-webhooks

This skill is for everything notifications. It is the only place where the HMAC validation pattern lives — every other skill defers here.

---

## Step 0 — Verify MCP is actually authenticated

`ListMcpResourcesTool` is unreliable for this MCP (always returns "No resources found"). The bootstrap tools `authenticate` / `complete_authentication` are always present and prove nothing.

Check whether `mcp__plugin_mercadopago_mercadopago__application_list` is callable AND returns a real payload. If not, stop and tell the user:

> The Mercado Pago MCP isn't authenticated yet. Run **`/mcp`**, find **`plugin:mercadopago:mercadopago`**, and complete OAuth in the browser. Then ask again.

---

## Step 1 — Decide the action

Ask the developer (or infer from `$ARGUMENTS`) which of these they want:

| Action | Tool to call | When |
|--------|--------------|------|
| Configure the webhook URL on the MP application | `save_webhook` | First time setup or rotating the endpoint |
| Send a fake notification to your endpoint | `simulate_webhook` | Smoke test the receiver before going live |
| Diagnose delivery failures | `notifications_history_diagnostics` | Investigating missed/failed notifications |
| Scaffold the receiver code | (no MCP call — render the pattern below) | Adding the receiver to the codebase |

You may chain them: scaffold the receiver → `save_webhook` → `simulate_webhook` to verify end to end.

---

## Step 2 — Receiver pattern (HMAC-SHA256)

Mercado Pago signs every notification with the secret returned in the dashboard at *Webhooks → Signature secret*. The `x-signature` header is composed of `ts=...,v1=...` where `v1` is the HMAC-SHA256 of the canonical string `"id:{data.id};request-id:{x-request-id};ts:{ts};"`.

Every receiver MUST:

1. Read `x-signature` and `x-request-id` from the request headers.
2. Parse `ts` and `v1` out of `x-signature`.
3. Build the canonical string with `data.id` (from the JSON body) and `x-request-id` and `ts`.
4. Compute `HMAC-SHA256(canonical, secret)` and compare in constant time with `v1`.
5. **Respond `200` immediately** if the signature is valid — process the event asynchronously afterwards. Mercado Pago retries on non-200 responses with exponential backoff for up to ~24 hours.
6. Be **idempotent**: the same notification id may arrive more than once. Use `data.id` + topic as the dedup key.

### Canonical string

```
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

### Reference snippet (Node.js, Express)

```js
import crypto from "node:crypto";

const SECRET = process.env.MP_WEBHOOK_SECRET;

export function mpWebhook(req, res) {
  const signature = req.header("x-signature") ?? "";
  const requestId = req.header("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  const dataId = req.body?.data?.id;
  if (!ts || !v1 || !dataId || !requestId) return res.status(400).end();

  const canonical = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", SECRET).update(canonical).digest("hex");

  const ok = expected.length === v1.length &&
             crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!ok) return res.status(401).end();

  res.status(200).end();
  // process asynchronously after responding 200
  queueMicrotask(() => handleEvent(req.body));
}
```

For other languages, query MCP `search_documentation` with:
- `"webhook signature validation {language}"` (e.g., python, java, php, ruby, go, dotnet).

---

## Step 3 — Topics

The notification body contains `type` (the topic) and `data.id`. Common topics:

| Topic | When | Resource to fetch |
|-------|------|-------------------|
| `payment` | Payment status change (Payments API) | `GET /v1/payments/{id}` |
| `merchant_order` | Merchant order updated (Checkout Pro / QR attended) | `GET /merchant_orders/{id}` |
| `topic_claims_integration_wh` | Chargebacks | `GET /v1/chargebacks/{id}` |
| `point_integration_wh` | Point device events | Point API — query MCP for the country |
| `subscription_preapproval` | Subscription status change | `GET /preapproval/{id}` |
| `subscription_authorized_payment` | Recurring charge attempt | `GET /authorized_payments/{id}` |

If a topic is not in this table, query MCP for the latest list rather than guessing.

---

## Step 4 — Configure on Mercado Pago (`save_webhook`)

```
mcp__plugin_mercadopago_mercadopago__save_webhook(
  callback="https://<production-url>/mp/webhook",
  callback_sandbox="https://<staging-url>/mp/webhook",
  topics=["payment", "merchant_order", ...]
)
```

Confirm the response shows the URL and topics correctly registered.

---

## Step 5 — Smoke test (`simulate_webhook`)

Once the receiver is deployed (or running locally with a tunnel like `ngrok`):

```
mcp__plugin_mercadopago_mercadopago__simulate_webhook(
  topic="payment",
  url_callback="https://<your-url>/mp/webhook",
  resource_id="<a real test payment id>",
  callback_env_production=false
)
```

Verify the receiver returned `200` and that the event was processed (idempotent: re-run the same call and check no duplicate side effects).

---

## Step 6 — Diagnose missed deliveries

```
mcp__plugin_mercadopago_mercadopago__notifications_history_diagnostics()
```

Returns delivery metrics and a breakdown of failures (timeouts, non-200 responses, signature mismatches). Use this when notifications are missing in production.

---

## Gotchas

- Respond `200` **before** processing. A long synchronous handler causes retries that flood the receiver and can mask the real failure.
- Mercado Pago retries on non-200 with exponential backoff up to ~24h — a transient bug becomes a flood of duplicates.
- Make handlers idempotent. Use `data.id` + `type` as the dedup key.
- Never trust the JSON body alone — always validate the signature first.
- IPN (the legacy `?id=&topic=` GET-style notification) is deprecated. New integrations use only the modern signed webhook described here.

---

## What this skill does NOT do

- It does **not** scaffold the surrounding integration. Use `mp-integrate`.
- It does **not** evaluate quality. Use `mp-review`.
- It does **not** invent topic names from memory — query MCP if unsure.
