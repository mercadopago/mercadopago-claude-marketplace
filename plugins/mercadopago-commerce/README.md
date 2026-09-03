# Mercado Pago for Commerce Agents

Adds a Mercado Pago hosted payment handoff to Anthropic's
[commerce-agents](https://github.com/anthropics/commerce-agents) blueprint.
This preview uses **Checkout Pro via Orders API**, the flow that creates an
online Order and returns a `checkout_url`.

The plugin is a scaffold, not a payment tool exposed to Claude. It installs a
server-side adapter into the retail demo; the shopper still reviews and
completes the payment on Mercado Pago.

## How it fits

```text
Claude builds a cart
  -> the retailer backend reloads products and prices from its catalog
  -> POST /v1/orders (type=online, processing_mode=manual)
  -> Mercado Pago returns id + checkout_url
  -> commerce-agents renders that URL after the model call
  -> webhook + GET /v1/orders/{id} confirm the final state
```

Claude never receives the Access Token, idempotency key, raw Mercado Pago
response or `checkout_url`. The commerce-agents executor attaches the handoff
URL to the checkout card after the model call.

## Demo

Run this command inside a commerce-agents checkout:

```text
/mp-commerce site=MLC
```

The first version intentionally targets the `retail` example only. After the
skill writes the scaffold:

```bash
cp mp.env.example .env
# Fill only test credentials and the test buyer in .env.
python scripts/run_demo.py retail
```

The backend logs the safe Order id. Use it to inspect the Order server-side:

```bash
python scripts/mp_confirm.py ORDTST01...
```

`created/created` means that the hosted checkout exists; it does **not** mean
that payment succeeded. Fulfillment is allowed only after an authenticated
Order webhook and a server-side lookup report `processed/accredited`, with the
expected Order id, external reference, amount and currency.

## Security boundaries

- Prices and quantities are validated and repriced from the trusted catalog.
- Currency and amount formatting come from server-owned configuration.
- A stable idempotency UUID is derived from the exact logical request. An
  identical retry in the same shopping session reuses it; changed input gets a
  different UUID. Production stores should replace this stateless demo rule
  with their durable purchase-attempt id.
- The `checkout_url` is treated as an opaque HTTPS value returned by Mercado
  Pago; the integration checks its Mercado Pago host but never constructs or
  rewrites it.
- The response is projected to the few fields the integration needs. In
  particular, `client_token` is discarded.
- Browser redirects are never proof of payment.

## Companion capabilities

This plugin has no MCP server and does not require one to write the local
scaffold. The separate `mercadopago` plugin is optional and can help create test
users, add signed webhooks and run a final integration review.

Official references:

- [Create a Checkout Pro Order](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/create-order)
- [Redirect with `checkout_url`](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/web-integration/redirect-buyer-to-checkout)
- [Order notifications](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-orders/payment-notifications)

## Status

`0.2.0` — preview scaffold for Checkout Pro via Orders API. It includes an
offline-tested create/redirect/state-lookup adapter. A real test-user payment,
durable attempt store, retry policy and webhook receiver remain explicit
integration steps; multi-seller split payments and the merchant agent are out
of scope.
