# Mercado Pago for Commerce Agents

Turns an [Anthropic commerce-agents](https://github.com/anthropics/commerce-agents) shopping agent into one that takes real money through Mercado Pago Checkout Pro.

## Why this exists

Anthropic's blueprint deliberately stops short of payment — *"leaves payment to you, whether that is your existing checkout or an agentic payments provider"* — and exposes one optional method for the host to fill:

```python
async def checkout_handoff(self, session, cart) -> list[CheckoutHandoff]
```

The executor attaches the returned URL to the checkout card **after** the model's call, so the URL never reaches the model. A Checkout Pro `init_point` is exactly that URL, which makes the whole integration a single method.

## Requires

The **`mercadopago`** plugin from this same marketplace. This plugin ships no MCP server of its own: it reuses that one, so there is a single authentication for both. It also reads that plugin's bundled Checkout Pro guide instead of carrying its own copy.

## Use

```
/mp-commerce site=MLC
```

Run it inside a commerce-agents clone. It writes the Mercado Pago backend, swaps the example's backend construction, and leaves credentials to you.

Then:

```bash
python scripts/run_demo.py retail        # API :8000 + storefront :3000
python scripts/mp_confirm.py             # confirm the payment server-side
```

## What it guarantees

- Prices are rebuilt from the catalog server-side. The cart is written by a language model that reads product descriptions, so its prices are attacker-reachable; they are discarded.
- The currency comes from configuration, never from the cart, which the blueprint defaults to `USD`.
- Payment is confirmed by looking it up with `external_reference`, never by trusting redirect parameters.
- The access token stays in the environment. It is never logged, never in source, and never visible to the model.

## Status

`0.1.0` — first working integration. Webhooks, split payments across sellers, and the merchant agent are not covered yet.
