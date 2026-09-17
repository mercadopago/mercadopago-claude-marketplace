# Mercado Pago for Commerce Agents

Adds a Mercado Pago hosted payment handoff to Anthropic's
[commerce-agents](https://github.com/anthropics/commerce-agents) blueprint.
The plugin wires the retail backend to
[`mercadopago-commerce-agents-checkout` 0.1.0](https://github.com/mercadopago/commerce-agents-checkout/tree/v0.1.0),
the versioned Checkout Pro adapter for the Orders API.

This is a scaffold, not a payment tool exposed to Claude. The seller backend
still owns identity, cart ownership, durable checkout attempts, webhooks, and
fulfillment. The package owns the sensitive Orders API protocol: trusted
catalog repricing, Order creation, response validation, and safe handoff.

## How it fits

```text
Claude builds a cart
  -> seller backend durably stores external_reference + idempotency_key
  -> Checkout Pro library rereads products and prices from the trusted catalog
  -> library creates and validates the online Order
  -> commerce-agents renders the hosted checkout URL after the model call
  -> verified Order webhook closes the seller checkout attempt
```

Claude never receives the Access Token, recovery identifiers, raw Mercado Pago
response, or `checkout_url`. Creating an Order returns a hosted payment path;
it does not prove the buyer paid.

## Test locally with Anthropic commerce-agents

### Prerequisites

- Claude Code installed and authenticated.
- Python 3.11 or newer and Node.js 22.
- Local checkouts of this repository and
  [Anthropic commerce-agents](https://github.com/anthropics/commerce-agents).
- For a live test only: a Mercado Pago test collector Access Token. Never use
  production credentials.

The preview intentionally supports only the `retail` example. During plugin
development, load the plugin directory directly so Claude Code uses the exact
files in the current branch instead of a cached marketplace release:

```bash
cd /absolute/path/to/commerce-agents

claude --plugin-dir \
  /absolute/path/to/mercadopago-claude-marketplace/plugins/mercadopago-commerce
```

Inside Claude Code, run the namespaced command:

```text
/mercadopago-commerce:mp-commerce
```

The skill installs the pinned library, copies a thin `MPRetail` integration,
and changes the retail backend from `MockRetail` to `MPRetail`. It does not edit
`.env`, create an Order, or call Mercado Pago. If it finds an earlier
integration, review the conflict and explicitly authorize replacement; it never
overwrites one silently.

### Configure the demo

Create the blueprint environment file, then merge the Mercado Pago setting from
`mp.env.example` into it. Do not replace `.env.example` or commit `.env`:

```bash
cp .env.example .env
```

Set the server-side test credential in `.env`:

```dotenv
ANTHROPIC_API_KEY=
MERCADOPAGO_ACCESS_TOKEN=<TEST_COLLECTOR_ACCESS_TOKEN>
```

The library derives prices and currency from the retailer's trusted catalog. Do
not add model-provided prices, payer data, callback URLs, or a checkout URL to
this configuration.

### Run and exercise the checkout

Create the Python environment, install the pinned adapter, and start the
retail demo:

```bash
python3 -m venv .venv
source .venv/bin/activate

python -m pip install mercadopago-commerce-agents-checkout==0.1.0
python3 -m py_compile examples/retail/api/mp_retail.py
python scripts/run_demo.py retail --no-reuse
```

Open the storefront URL printed by the runner, add a product to the cart and
select checkout. That action invokes the library. It rechecks the catalog and,
only when the cart remains valid, creates an online Checkout Pro Order and
returns one hosted `checkout_url` for the executor to render.

The supplied attempt store is intentionally in memory so the demo can be read
and run locally. It is not a production checkout store: process restarts lose
its attempt identifiers. A real backend must write both `external_reference`
and the idempotency key atomically before the first call, preserve an unknown
outcome, and close the row only after a verified terminal Order webhook.

## Security boundaries

- The package rereads every line from the trusted catalog. Model-authored cart
  prices never become an amount charged to the seller.
- Currency comes from catalog records and must agree with the cart; it is not
  a model or environment setting.
- A seller-owned `external_reference` and high-entropy idempotency key are
  persisted before any call and reused for the same checkout attempt.
- If the Orders outcome is unknown, the integration blocks fallback and asks
  for reconciliation rather than creating a second payable path.
- The `checkout_url` is returned outside the model tool result and is never
  constructed or rewritten by the seller backend.
- Browser redirects are never proof of payment. Fulfillment requires a verified
  webhook and a server-side Order check against the stored attempt.

## Companion capabilities

This plugin has no MCP server and does not require one to write the local
scaffold. The separate `mercadopago` plugin is optional and can help create test
users, add signed webhooks, and run a final integration review.

Useful references:

- [Checkout Pro library integration contract](https://github.com/mercadopago/commerce-agents-checkout/blob/v0.1.0/docs/integration.md)
- [Create a Checkout Pro Order](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/create-order)
- [Order webhooks and signature validation](https://www.mercadopago.com.co/developers/en/docs/your-integrations/notifications/webhooks)

## Status

`0.3.0` — preview scaffold that delegates the Orders API implementation to
`mercadopago-commerce-agents-checkout==0.1.0`. A durable attempt store, webhook
receiver, reconciliation worker, and fulfillment state machine remain explicit
seller integration responsibilities. Multi-seller split payments and merchant
agents are out of scope.
