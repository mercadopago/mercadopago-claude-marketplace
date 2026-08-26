---
name: mp-review
description: Review a Mercado Pago integration with a local cross-cutting security checklist and official MCP quality tools on demand. Use after the integration is in place, or when /mp-review is invoked.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "4.3.2"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, review, quality, checklist, security"
---

# mp-review

This skill audits a Mercado Pago integration. The security floor is evaluated locally. Official quality criteria are pulled live only when an MCP-backed scope reaches that step.

---

## Step 0 — Connect only for the MCP-backed review step

Do not inspect MCP state when the review starts. Discover the integration and run all requested local checks first.

| Review operation | MCP required? | Tool |
|---|---:|---|
| Security floor (`scope=security`) | No | — |
| Code discovery and legacy detection | No | — |
| Official quality checklist | Yes | `quality_checklist` |
| Payment-level quality evaluation | Yes | `quality_evaluation` |
| Get or submit homologation form | Yes | `form_homologation` |

Immediately before an MCP-backed operation:

1. Attempt the intended tool directly if callable. Never call `application_list` merely to test the connection.
2. If it is unavailable or returns an authentication error, call `mcp__plugin_mercadopago_mcp__authenticate` and show the OAuth link in the developer's language.
3. Instruct the developer to Cmd+Click (Mac) or Ctrl+Click (Windows/Linux), without copying the URL into an external browser.
4. When the developer returns, retry the intended tool directly. Never request the callback URL.
5. After two authentication failures, continue with completed local checks and mark the MCP-backed section as not verified.

---

## Step 1 — Discover the integration

Use `Grep`/`Glob` to find:

- Files importing `mercadopago` (any SDK).
- References to `MP_ACCESS_TOKEN` or hardcoded `APP_USR-` / `TEST-` strings.
- Endpoint patterns: `/v1/payments`, `/checkout/preferences`, `/v1/orders`, `payment.create`, `preference.create`, `order.create`, `preapproval.create`, `disbursement`.
- Webhook handlers (paths matching `webhook`, `notification`, `ipn`).

Determine:

- **API in use**: Payments API (`/v1/payments`) vs Orders API (`/v1/orders`). Both can coexist.
  - **If the integration uses legacy Instore APIs**, it is on the legacy path. Always include a `Needs attention` item in the Implementation Report with the file:line, and suggest the migration command: *"Run `/mp-integrate migrate` to automate the migration to the Orders API."* Do **not** treat it as a Blocker (existing code still works), but flag it as forward-looking technical debt. Legacy Instore patterns to flag:
    - `/mpmobile/instore/qr` (QR Instore)
    - `/instore/qr/seller/collectors` (QR Instore V2)
    - `/instore/orders/qr/seller/collectors` (QR Dinámico)
    - `/point/integration-api/devices/{id}/payment-intents` (Point)
  - **If the integration uses `/v1/payments`** (Online): flag as technical debt if it is a server-side card payment (Checkout API / Marketplace). Do **not** suggest `/mp-integrate migrate` for Online — migration for those products is out of scope for this plugin.
  - **Exception 1**: Checkout Pro stays on preferences (the Orders API does not exist for Checkout Pro). Do not flag `/checkout/preferences` as legacy.
  - **Exception 2**: Bricks uses `/v1/payments` correctly (server-side after `CardPayment` tokenization). Do not flag `/v1/payments` calls in files that also contain `CardPayment` or `onSubmit` as legacy.
- **Products in use**: Checkout Pro/API, Bricks, Subscriptions, Marketplace, etc. — derive from endpoint patterns and request payloads.

---

## Step 2 — Run the official quality checklist

Skip this step for `scope=security`. For every other scope that includes official quality criteria, apply Step 0 immediately before the following call.

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

## Step 4 — Run `quality_evaluation` (when compatible)

`mcp__plugin_mercadopago_mcp__quality_evaluation` requires a real `payment_id`. Run it when the integration used the Payments API and produced a payment ID.

Only after the developer provides the ID, apply Step 0 immediately before this call.

| Integration uses | Action |
|------------------|--------|
| Payments API (`/v1/payments`) | Ask the developer for a recent test `payment_id`, then call `mcp__plugin_mercadopago_mcp__quality_evaluation` with it. |
| Orders API only | Skip — incompatible. Mention in the report. |

```
mcp__plugin_mercadopago_mcp__quality_evaluation(
  payment_id="<recent_test_payment_id>"
)
```

If the developer doesn't have a payment ID, skip and note in the report: `"quality_evaluation: skipped — no payment_id provided."`

---

## Step 4.5 — Homologation form (final step before production)

After quality_evaluation (or if it was skipped), offer the homologation form to the developer:

> "Before switching to production credentials, complete the official homologation checklist. This certifies your integration and activates it for production."

1. If the developer accepts the offer, apply Step 0 immediately before calling `mcp__plugin_mercadopago_mcp__form_homologation` with `action="get_form"`, `product_id` (from detected product), `site_id` (from detected country), `lang`, `is_ca` (true for Checkout API / Bricks).
2. Present each step/question to the developer via `AskUserQuestion`. Collect answers.
3. When all questions are answered, call with `action="submit"` and the collected `form_values`.
4. On success: congratulate the developer and confirm the integration is certified.

If the developer skips: note it in the Implementation Report under "Needs attention": `"Homologation form not submitted — required before production deployment."`.

---

## Step 5 — Render the Implementation Report (MANDATORY final step)

After Steps 1–4 are complete, **always** render an Implementation Report as the last block of the output. This is the deliverable the developer keeps — it summarizes what's done, what's pending, and what to do next. Do not skip it, do not summarize it in prose; render the structured block below verbatim.

The report is the source of truth for the developer's next session: it tells them exactly what was verified, what was flagged, and the next concrete action. Without it, the review feels open-ended and the developer doesn't know if they can ship.

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

### Quality Standards

{If `quality_checklist` ran: render every official item below. If it was not requested, write `Not requested for this scope.` If authentication failed, write `Not verified — MCP connection was unavailable.` Do not fabricate rows or scores.}

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

**Summary**: {X/Y required fields implemented and Z/W best practices adopted, if verified; otherwise `Official quality: not requested/not verified`}. {S}/9 security checks pass.

{Offer `quality_evaluation` only for a compatible Payments API review where the developer requested MCP-backed quality analysis.}

---

## Implementation Report

### Verified
- [x] {item that passed — e.g., "Webhook handler validates x-signature with HMAC-SHA256"}
- [x] {next passing item}

### Needs attention
- [ ] {actionable item with file:line — e.g., "Add idempotency key to POST /v1/orders at api/orders.js:42"}
- [ ] {next pending item}
- [ ] {if legacy `/v1/payments` is detected — e.g., "Migrate POST /v1/payments to the Orders API (POST /v1/orders) at api/payments.js:42. The Payments API is being deprecated."}

### Blockers (must fix before production)
- [ ] {critical item — e.g., "Hardcoded APP_USR- token in config/mp.js:8 — move to env"}

### Next steps
1. {The single most impactful action the developer should take next}
2. {Follow-up actions in priority order}
3. Re-run `/mp-review` after fixes to confirm the report.

### Resources used
- Local: codebase inspection + cross-cutting security floor
- MCP: `quality_checklist` (include only if called, with date/time)
- MCP: `quality_evaluation` (include only if called, with the payment_id used)
- MCP: `form_homologation` (include only if called)
- Skill: `mp-review` v4.3.2

**Scores**: {X/Y required and Z/W best practices if verified; otherwise `official quality: N/A`}, {S}/9 security. **Verdict**: {Ready for production | Needs fixes | Blocked | Partial — MCP checks not verified}.
```

---

## What this skill does NOT do

- It does **not** generate or scaffold code. Use `mp-integrate`.
- It does **not** call APIs that mutate state. `quality_evaluation` is read-only and only suggested.
- It does **not** invent official quality criteria offline. The fixed security floor is local; official criteria are fetched only when that MCP-backed scope is requested.
