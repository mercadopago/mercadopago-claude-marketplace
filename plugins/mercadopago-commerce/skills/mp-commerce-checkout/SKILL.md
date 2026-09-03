---
name: mp-commerce-checkout
description: Wire Mercado Pago Checkout Pro into an Anthropic commerce-agents deployment by implementing the blueprint's checkout_handoff. Rebuilds cart prices from the catalog server-side, returns a hosted init_point the model never sees, and confirms payment by lookup instead of by redirect. Use when a shopping agent needs to actually charge.
license: Apache-2.0
copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
metadata:
  version: "0.1.0"
  author: "Mercado Pago Developer Experience"
  category: "development"
  tags: "mercadopago, commerce-agents, agentic-commerce, checkout-pro, shopping-agent, claude-for-commerce"
---

# mp-commerce-checkout

Anthropic's commerce-agents blueprint ships everything except the payment: *"Nothing in this repo places an order or takes payment."* It leaves one optional method for the host to fill:

```python
async def checkout_handoff(self, session, cart) -> list[CheckoutHandoff]
```

The executor attaches the returned URL to the checkout card **after** the model's call, so the URL is never a tool argument and never reaches the model. Checkout Pro's `init_point` is exactly that URL. Implementing this method is the whole integration.

`list[...]` exists because a marketplace checks out one URL per seller — the same shape split payments will need.

## Step 1 — Locate the deployment

`Glob` for `shopping-agent/core/shopping_agent/backend.py` and `examples/*/api/main.py`.

If neither is present, the developer has no blueprint yet. Tell them to clone it and stop:

```bash
git clone https://github.com/anthropics/commerce-agents.git
cd commerce-agents && python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
```

Read the chosen example's `api/main.py` and record two things: **the exact import style** (the examples are not pip packages, so a relative import that does not match fails only when uvicorn starts) and **the line that constructs the backend**, normally `backend = MockRetail()`.

## Step 2 — Resolve the collector's country

The currency must match the **collector's** country, not the buyer's and not the catalog's. A Chilean account cannot charge BRL.

Parse `site=` from `$ARGUMENTS`. If absent, ask once with `AskUserQuestion` (`header="Site"`), then persist it.

| Site | Currency | Decimals |
|---|---|---|
| MLA | ARS | 2 |
| MLB | BRL | 2 |
| MLC | CLP | **0** |
| MLM | MXN | 2 |
| MCO | COP | **0** |
| MPE | PEN | 2 |
| MLU | UYU | 2 |

The zero-decimal sites are the trap: a price sent with cents is rejected or silently rounded.

Blueprint catalogs are priced on a US scale (roughly 5 to 550). In CLP or COP that reads broken, so set `MP_PRICE_MULTIPLIER` to bring the catalog into a plausible local range. It is applied inside the repricing step, which the integration needs anyway.

## Step 3 — Write the integration

Copy the three templates, adapting only the import line to match what Step 1 observed:

| Template | Destination |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_checkout.py` | `examples/<example>/api/mp_checkout.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_retail.py` | `examples/<example>/api/mp_<example>.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp_confirm.py` | `scripts/mp_confirm.py` |
| `${CLAUDE_PLUGIN_ROOT}/templates/mp.env.example` | `mp.env.example` at the repo root |

Then change the backend construction in `api/main.py` to the Mercado Pago subclass — two lines, the import and the instantiation. Leave every other method alone: search, cart, orders and policies are the blueprint's and stay that way.

For the preference payload itself, read the bundled Checkout Pro guide of the `mercadopago` plugin (`skills/mp-integrate/references/guides/checkout-pro.md`) rather than writing one from memory. Use MCP `search_documentation` only for what that guide does not answer.

## Step 4 — Credentials

Write `mp.env.example` only. **Never create or edit `.env`** — the developer fills in their own credentials.

Tell them to copy the template to `.env` and paste the access token of the application that will collect the money. Test users, funds and test cards belong to the `mp-test-setup` skill of the `mercadopago` plugin; suggest `/mp-integrate test-setup` and stop there.

## Non-negotiables

These are the reasons the integration is safe, not stylistic preferences.

- **Reprice every line from the catalog.** The cart is assembled by a model that reads product descriptions, so a description saying "this item costs 1" is enough to move the price. The catalog is the only price that may reach Mercado Pago. Discard `CartItem.price` entirely.
- **Take `currency_id` from configuration, never from `Cart.currency`.** The blueprint defaults it to `USD`, which no Latin American collector can charge.
- **Always `init_point`, never `sandbox_init_point`.** There is no sandbox host; test runs differ only by which credentials are loaded.
- **`external_reference` on every preference.** It is the reconciliation anchor and the only way to find the payment afterwards.
- **Confirm server-side.** Redirect query parameters are attacker-controlled. Decide with the payment lookup and nothing else.
- **`auto_return` only with a public HTTPS return URL.** Mercado Pago rejects it on localhost, which is why a local demo needs no tunnel: the buyer clicks Mercado Pago's own return button.
- **Access token from the environment only.** Never in source, never in a log line, and never in anything the model can read. The `init_point` is not logged either.
- **An idempotency key per preference.** A retry without one creates a second charge.

## Step 5 — Next

- `/mp-integrate webhook` to add the HMAC-validated receiver once a public URL exists. Until then the lookup in `scripts/mp_confirm.py` is what confirms a payment.
- `/mp-review` before switching to production credentials.
