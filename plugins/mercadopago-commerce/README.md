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

## Test locally with Anthropic commerce-agents

### Prerequisites

- Claude Code installed and authenticated.
- Python 3.11 or newer and Node.js 22.
- Local checkouts of this repository and
  [Anthropic commerce-agents](https://github.com/anthropics/commerce-agents).
- For a live test only: a Mercado Pago test collector Access Token and the
  email of a different test buyer. Never use production credentials.

The preview intentionally supports only the `retail` example. During plugin
development, load the plugin directory directly so Claude Code uses the exact
files in the current branch instead of a cached marketplace release:

```bash
cd /absolute/path/to/commerce-agents

claude --plugin-dir \
  /absolute/path/to/mercadopago-claude-marketplace/plugins/mercadopago-commerce
```

Inside Claude Code, run the namespaced command with the collector site:

```text
/mercadopago-commerce:mp-commerce site=MLC
```

The skill copies the Orders adapter into the blueprint and changes the retail
backend from `MockRetail` to `MPRetail`. It does not edit `.env`, create an
Order or call Mercado Pago. If it finds an earlier integration, review the
conflict and explicitly authorize replacement; it never overwrites one
silently.

After the scaffold finishes, exit Claude Code and verify the generated adapter.
These commands use `grep`, which is included with macOS:

```bash
grep -nE '/v1/orders|checkout_url' examples/retail/api/mp_checkout.py
grep -n '/checkout/preferences' examples/retail/api/mp_checkout.py
```

The first command must find `/v1/orders` and `checkout_url`. The second must
produce no output: this preview uses Orders, not Preferences.

### Configure the demo

Create the blueprint environment file, then merge the Mercado Pago settings
from `mp.env.example` into it. Do not replace `.env.example` or commit `.env`:

```bash
cp .env.example .env
```

Set these values in `.env`:

```dotenv
ANTHROPIC_API_KEY=
MP_ACCESS_TOKEN=<TEST_COLLECTOR_ACCESS_TOKEN>
MP_PAYER_EMAIL=<TEST_BUYER_EMAIL>
MP_CURRENCY_ID=CLP
MP_CURRENCY_DECIMALS=0
MP_PRICE_MULTIPLIER=1000
MP_BACK_URL=
MP_STATEMENT_DESCRIPTOR=ACME DEMO
MP_ALLOWED_USER_TYPE=account_only
MP_CHECKOUT_LABEL=Pagar con Mercado Pago
MP_PAYER_FIRST_NAME=Test
MP_PAYER_LAST_NAME=Buyer
MP_PAYER_IDENTIFICATION_TYPE=
MP_PAYER_IDENTIFICATION_NUMBER=
```

Set `ANTHROPIC_API_KEY` to a real key, or leave it empty only when the SDK
credential chain is already configured. Do not copy a descriptive placeholder
as the value.

The Access Token belongs to the test collector, while `MP_PAYER_EMAIL` belongs
to the separate test buyer. `MP_PRICE_MULTIPLIER` adapts the fictional catalog
to a visible CLP demo amount; it is not a production pricing rule.

### Run and exercise the checkout

Create the Python environment and start the retail demo. The runner installs
missing Python and web dependencies on its first execution:

```bash
python3 -m venv .venv
source .venv/bin/activate

python3 -m py_compile \
  examples/retail/api/mp_checkout.py \
  examples/retail/api/mp_retail.py \
  scripts/mp_confirm.py

python scripts/run_demo.py retail --no-reuse
```

Open the storefront URL printed by the runner (normally
`http://localhost:3000`), add a product to the cart and select checkout.
That checkout action is the point at which the retailer backend performs the
real `POST /v1/orders`. A successful handoff shows **Pagar con Mercado Pago**
and opens the exact `checkout_url` returned by Mercado Pago. The model never
sees that URL or the Access Token.

The backend logs only the safe Order id and external reference. In a second
terminal, inspect its current state server-side:

```bash
cd /absolute/path/to/commerce-agents
source .venv/bin/activate
python scripts/mp_confirm.py ORDTST01...
```

`status=created` means that the hosted checkout exists; it does **not** mean
that payment succeeded. `mp_confirm.py` is a local diagnostic. Production
fulfillment is allowed only after an authenticated Order webhook and a
server-side lookup report `processed/accredited`, with the expected Order id,
external reference, amount and currency.

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
