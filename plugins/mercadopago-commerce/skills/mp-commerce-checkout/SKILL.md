---
name: mp-commerce-checkout
description: Wire the pinned Mercado Pago Checkout Pro adapter into the retail example of Anthropic's commerce-agents blueprint. Use when a commerce agent needs a hosted Mercado Pago payment handoff built from a trusted catalog and rendered outside the model.
license: Apache-2.0
metadata:
  version: "0.3.0"
  author: "Mercado Pago Developer Experience"
  copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
  category: "development"
  tags: "mercadopago, commerce-agents, agentic-commerce, checkout-pro, orders-api, claude-for-commerce"
---

# mp-commerce-checkout

Install the versioned Mercado Pago Checkout Pro adapter into Anthropic's
commerce-agents `retail` example. The seller backend retains the checkout
attempt and calls `MercadoPagoCheckout`; the package owns the Orders API
request, trusted-catalog repricing, response validation, and hosted URL.

This is scaffolding. It must not make a live API request, create a payment, or
edit `.env` unless the developer separately asks for that side effect.

## Contract to preserve

```text
model builds cart
  -> seller backend persists checkout attempt identifiers
  -> MercadoPagoCheckout rereads the trusted catalog
  -> library creates and validates the Checkout Pro Order
  -> return CheckoutHandoff(checkout_url)
  -> executor renders URL after the model call
```

The model must never receive the Access Token, idempotency key, seller
reference, raw Order response, or checkout URL. The hosted checkout remains a
buyer-controlled step; creating an Order does not itself prove payment.

## 1. Locate the blueprint

Find both:

- `shopping-agent/core/shopping_agent/backend.py`
- `examples/retail/api/main.py`

If they are absent, explain that the command must run inside an Anthropic
commerce-agents clone and stop. Read `examples/retail/api/main.py` and
`examples/retail/api/mock_retail.py` before editing. Preserve their actual
import style.

This preview supports `retail` only. Do not claim that travel, telecom, or
entertainment are covered by copying a retail-specific subclass.

## 2. Install the adapter and copy the thin integration

Use the active project's Python environment. Pin the published version exactly:

```bash
python -m pip install mercadopago-commerce-agents-checkout==0.1.0
```

Copy these plugin templates:

| Plugin template | Project destination |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_retail.py` | `examples/retail/api/mp_retail.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp.env.example` | `mp.env.example` |

In `examples/retail/api/main.py`, replace `MockRetail` with `MPRetail` at the
existing backend construction. Leave search, cart, policies, orders, memory,
and every other blueprint capability unchanged.

Never recreate an Orders HTTP client, manually build an Orders payload, or copy
an `mp_checkout.py` transport adapter: version `0.1.0` owns that boundary.
Never overwrite an existing integration silently. Show the conflict and ask
before replacing files that are not recognizably generated from these templates.

## 3. Preserve checkout-attempt ownership

`commerce-agents` calls `checkout_handoff(session, cart)` with exactly two
arguments. Before its first call to the library, the seller backend must
durably create and persist:

- an opaque seller `external_reference`;
- a high-entropy idempotency key; and
- whether a prior call ended in `CheckoutOutcomeUnknown`.

The supplied `InMemoryCheckoutAttemptStore` demonstrates the wiring only. It is
not safe for production because a restart loses its data. Replace it with a
durable seller table keyed by the authenticated customer and confirmed-cart
fingerprint. Keep the same identifier pair for every retry. Never derive either
identifier from session data or shopper PII.

If the library raises `CheckoutOutcomeUnknown`, do not release another checkout
or a fallback. Persist the unknown state and reconcile the original Order first.
Close the attempt only in the same durable transaction that records a verified
terminal Order webhook.

## 4. Configure without exposing credentials

Write `mp.env.example`; never create or edit `.env`. The developer supplies a
test-collector `MERCADOPAGO_ACCESS_TOKEN` at runtime. Do not print it.

The library derives title, price, stock, and currency from the trusted catalog.
Do not configure payer data, model prices, callbacks, return URLs, or a checkout
URL in the template.

The separate `mercadopago` plugin is optional. Suggest its test-user, webhook,
or review capabilities only when the developer asks for those next steps; this
local scaffold does not require MCP authentication.

## 5. Verify locally

Run formatting already used by the target repository, then at minimum:

```bash
python3 -m py_compile examples/retail/api/mp_retail.py
python3 /absolute/path/to/mercadopago-claude-marketplace/plugins/mercadopago-commerce/tests/test_mp_retail.py
```

Run relevant existing retail tests. Do not create an Order or contact Mercado
Pago as a test without explicit authorization. Report exactly which files
changed and which checks passed.

## Payment confirmation

The hosted URL and a browser return are not payment confirmation. Production
must validate the Order webhook signature, deduplicate it, fetch the Order
server-side, match its seller reference, amount, and currency to the persisted
attempt, then apply a valid local state transition. The browser never grants
fulfillment authority.

Official references:

- https://github.com/mercadopago/commerce-agents-checkout/blob/v0.1.0/docs/integration.md
- https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.co/developers/en/docs/your-integrations/notifications/webhooks
