---
name: mp-review
description: Review a Mercado Pago integration against the official quality checklist and a fixed cross-cutting security checklist. Calls quality_checklist (and quality_evaluation when applicable) on the Mercado Pago MCP. Use after the integration is in place, or when /mp-review is invoked.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.0.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, review, quality, checklist, security"
---

# mp-review

This skill audits a Mercado Pago integration. It does not duplicate the official quality criteria — it pulls them live from the MCP and verifies each one against the codebase.

---

## Step 0 — Verify MCP is actually authenticated

`ListMcpResourcesTool` is unreliable for this MCP (always returns "No resources found"). The bootstrap tools `authenticate` / `complete_authentication` are always present and prove nothing.

Check whether `mcp__plugin_mercadopago_mcp__quality_checklist` is callable AND returns a real payload. If not, stop and tell the user:

> Call `mcp__plugin_mercadopago_mcp__authenticate`, show the URL as a clickable link, and say: "When you see **Authentication Successful** in the browser, come back and say anything." When the user responds, call `application_list` directly — do NOT call `complete_authentication` first (it hangs when the callback was already consumed). Never ask the user to paste the callback URL — it contains a sensitive OAuth code.

The official checklist lives behind the MCP — there is no offline fallback.

---

## Step 1 — Discover the integration

Use `Grep`/`Glob` to find:

- Files importing `mercadopago` (any SDK).
- References to `MP_ACCESS_TOKEN` or hardcoded `APP_USR-` / `TEST-` strings.
- Endpoint patterns: `/v1/payments`, `/v1/checkout/preferences`, `/v1/orders`, `payment.create`, `preference.create`, `order.create`, `preapproval.create`, `disbursement`.
- Webhook handlers (paths matching `webhook`, `notification`, `ipn`).

Determine:

- **API in use**: Payments API (`/v1/payments`) vs Orders API (`/v1/orders`). Both can coexist.
- **Products in use**: Checkout Pro/API, Bricks, Subscriptions, Marketplace, etc. — derive from endpoint patterns and request payloads.

---

## Step 2 — Run the official quality checklist

Call `mcp__plugin_mercadopago_mcp__quality_checklist`. The response defines:

- **Required fields** — must be implemented to meet Mercado Pago's quality bar.
- **Best practices** — recommended improvements.

For **every** item returned (do not summarize, do not skip):

1. Search the codebase with `Grep`/`Read` for evidence of the item (a field, a header, a behavior).
2. Mark each item **Implemented**, **Missing**, or **Partial** with a one-line justification (the file/line that proves the verdict).

---

## Step 3 — Cross-cutting security checklist

These items are not always part of `quality_checklist` but are mandatory for any production integration. Always evaluate them:

| # | Check | How to verify |
|---|-------|---------------|
| 1 | Access token in `process.env` / equivalent — never hardcoded | Grep for `APP_USR-` / `TEST-` outside `.env*` and test fixtures |
| 2 | `.env` is in `.gitignore`, `.env.example` is **not** | Read `.gitignore` |
| 3 | Webhook handler validates `x-signature` (HMAC-SHA256) | See `mp-webhooks` skill — Grep for `x-signature`, `x-request-id`, `createHmac` |
| 4 | HTTPS enforced for `back_url` and `notification_url` | Grep for `http://` in URL building |
| 5 | Payment status verified server-side after redirect | Look for a server-side fetch of `/v1/payments/{id}` or `/v1/orders/{id}` after `back_url` |
| 6 | Idempotency key sent on payment/order creation | Grep for `X-Idempotency-Key` or SDK equivalent |
| 7 | `external_reference` set on every preference/order | Grep for `external_reference` |
| 8 | Test user credentials not committed to production deploy | Confirm test credentials are loaded from a separate env file or vault |
| 9 | `sandbox_init_point` not used anywhere | Grep for `sandbox_init_point` — flag any match as a bug; Mercado Pago has no sandbox, the URL is invalid in all environments |

---

## Step 4 — Suggest `quality_evaluation` (only when compatible)

`quality_evaluation` requires a real `payment_id` (or in the future, `order_id`). Do **not** force it; suggest only when the integration produced one and the tool's required ID matches the API in use.

| Tool requires | Integration uses | Action |
|---------------|------------------|--------|
| `payment_id` | Payments API | Suggest: "Run `quality_evaluation` against a recent test payment ID for a deeper score." |
| `payment_id` | Orders API only | Do not suggest — incompatible. |
| `order_id` (future) | Orders API | Suggest with a recent test order ID. |
| `order_id` (future) | Payments API only | Suggest migrating to Orders API; do not force. |

---

## Output format

```markdown
## Mercado Pago Integration Review

**Scope**: {full | security | webhooks | checkout | qr | subscriptions | marketplace | quality}
**API detected**: {Payments API | Orders API | both}
**Products detected**: {list}
**Files analyzed**: {list}

### CRITICAL
- {issues that block production or expose credentials}

### WARNINGS
- {issues that may cause incidents but do not block release}

### PASS
- {items correctly implemented}

### Quality Standards (from MCP `quality_checklist`)

#### Required fields
| # | Field | Description | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | … | … | Implemented / Missing / Partial | path:line |

#### Best practices
| # | Practice | Description | Status | Evidence |
|---|----------|-------------|--------|----------|
| 1 | … | … | Implemented / Missing / Partial | path:line |

### Security checklist (cross-cutting)
| # | Check | Status | Evidence |
|---|-------|--------|----------|

### Recommendations
- {actionable, ordered by impact}

**Summary**: X/Y required fields implemented, Z/W best practices adopted, S/9 security checks pass.

> Want a deeper score? Provide a recent test payment ID (or order ID) and I'll run `quality_evaluation`.
```

---

## What this skill does NOT do

- It does **not** generate or scaffold code. Use `mp-integrate`.
- It does **not** call APIs that mutate state. `quality_evaluation` is read-only and only suggested.
- It does **not** rely on offline knowledge of "what should be in a review" — the official checklist is fetched live every time.
