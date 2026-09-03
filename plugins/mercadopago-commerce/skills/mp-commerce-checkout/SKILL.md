---
name: mp-commerce-checkout
description: Scaffold Mercado Pago Checkout Pro via Orders API into the retail example of Anthropic's commerce-agents blueprint. Use when a commerce agent needs a hosted Mercado Pago payment handoff, a POST /v1/orders adapter, or a checkout_url that is rendered outside the model.
license: Apache-2.0
metadata:
  version: "0.2.0"
  author: "Mercado Pago Developer Experience"
  copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
  category: "development"
  tags: "mercadopago, commerce-agents, agentic-commerce, checkout-pro, orders-api, claude-for-commerce"
---

# mp-commerce-checkout

Install a small server-side adapter in Anthropic's commerce-agents `retail`
example. The adapter creates **Checkout Pro via Orders API** and returns its
hosted `checkout_url` through the blueprint's existing `CheckoutHandoff`.

This is scaffolding. It must not make a live API request, create a payment or
edit `.env` unless the developer separately asks for that side effect.

## Contract to preserve

```text
model builds cart
  -> trusted retailer reprices cart
  -> POST /v1/orders
  -> project safe response fields
  -> return CheckoutHandoff(checkout_url)
  -> executor renders URL after the model call
```

The model must never receive the Access Token, idempotency key, raw Order
response or checkout URL. The hosted checkout remains a buyer-controlled step;
creating an Order does not itself prove or complete a payment.

## 1. Locate the blueprint

Find both:

- `shopping-agent/core/shopping_agent/backend.py`
- `examples/retail/api/main.py`

If they are absent, explain that the command must run inside an Anthropic
commerce-agents clone and stop. Read `examples/retail/api/main.py` and
`examples/retail/api/mock_retail.py` before editing. Preserve their actual
import style.

This preview supports `retail` only. Do not claim that travel, telecom or
entertainment are covered by copying a retail-specific subclass.

## 2. Resolve the collector site

Read `site=` from `$ARGUMENTS`. If missing, ask once. Currency belongs to the
Mercado Pago collector account, not to the model or buyer.

| Site | Currency | Decimals |
|---|---|---:|
| MLA | ARS | 2 |
| MLB | BRL | 2 |
| MLC | CLP | 0 |
| MLM | MXN | 2 |
| MCO | COP | 0 |
| MPE | PEN | 2 |
| MLU | UYU | 2 |

The example catalog uses small USD-like values. Set a clearly documented
`MP_PRICE_MULTIPLIER` for the demo rather than accepting the cart currency or
prices. The adopter must choose real pricing before production.

## 3. Copy the adapter

Copy these plugin templates:

| Plugin template | Project destination |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_checkout.py` | `examples/retail/api/mp_checkout.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_retail.py` | `examples/retail/api/mp_retail.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_confirm.py` | `scripts/mp_confirm.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp.env.example` | `mp.env.example` |

After copying `mp.env.example`, replace its currency and decimals with the
selected site's values. Ask the developer for the demo price multiplier if the
MLC default is not appropriate; do not invent production prices.

Adjust only imports that differ in the detected checkout. In
`examples/retail/api/main.py`, replace `MockRetail` with `MPRetail` at the
existing backend construction. Leave search, cart, policies, orders, memory
and every other blueprint capability unchanged.

Never overwrite an existing integration silently. Show the conflict and ask
before replacing files that are not recognizably generated from these
templates.

## 4. Use the Orders contract

Create the handoff with:

```http
POST https://api.mercadopago.com/v1/orders
Authorization: Bearer <server-side access token>
Content-Type: application/json
X-Idempotency-Key: <UUID for this logical request>
```

The body uses:

```json
{
  "type": "online",
  "processing_mode": "manual",
  "total_amount": "1000",
  "external_reference": "merchant-owned-reference",
  "payer": { "email": "test-buyer@example.com" },
  "items": []
}
```

The template adds `config.online` and canonical items. It calculates
`total_amount` from trusted catalog prices and quantities. Do not accept model
prices, `Cart.currency`, payer identity, callbacks or an idempotency key as
authoritative tool input.

This is Checkout Pro via Orders API. Do not replace it with Preferences and do
not call `POST /v1/orders/{id}/process`; that processing endpoint belongs to a
different Checkout API flow.

Treat `checkout_url` as opaque: validate HTTPS and an official Mercado Pago
host, then use exactly the value Mercado Pago returned. Do not construct it or
infer a country domain.
Project the response to `id`, `external_reference`, `status`, `status_detail`
and `checkout_url`; discard `client_token` and all unneeded buyer/account data.

The demo derives stable identity from the exact request within one shopping
session so an identical retry reuses its key. Before production, replace that
with a durable merchant purchase-attempt id stored before the POST. Never use
one idempotency key with two different bodies.

## 5. Configure without exposing credentials

Write `mp.env.example`; never create or edit `.env`. The developer supplies a
test-user Access Token and test buyer email at runtime. Do not print either.

The separate `mercadopago` plugin is optional. Suggest its test-user, webhook
or review capabilities only when the developer asks for those next steps; this
local scaffold does not require MCP authentication.

When equivalent MCP checkout tools become available, keep the retailer and
`CheckoutHandoff` contracts and replace only the direct HTTP transport in
`mp_checkout.py`. Do not make the skill depend on an unfinished MCP tool.

## 6. Verify locally

Run formatting already used by the target repository, then at minimum:

```bash
python3 -m py_compile \
  examples/retail/api/mp_checkout.py \
  examples/retail/api/mp_retail.py \
  scripts/mp_confirm.py
```

Run relevant existing retail tests. Do not POST to Mercado Pago as a test
without explicit authorization. Report exactly which files changed and which
checks passed.

## Payment confirmation

`checkout_url` and a browser return are not payment confirmation. Production
must validate the Order webhook, acknowledge it promptly, and then query
`GET /v1/orders/{id}` server-side. Fulfill only when the lookup reports:

```text
status=processed
status_detail=accredited
```

Also match Order id, merchant-owned external reference, expected amount and
currency to the purchase record before fulfillment. Add a bounded retry policy
for `423`, `429`, transport errors and retryable `5xx` responses; every retry of
one logical attempt must preserve the original body and idempotency key.

The included `mp_confirm.py` is a local diagnostic that performs that lookup by
Order id. It is not a substitute for webhooks.

Official references:

- https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/web-integration/redirect-buyer-to-checkout
- https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/payment-notifications
