# Mercado Pago for Commerce Agents

Integrates a Python commerce-agent backend with Mercado Pago Checkout Pro
without depending on a particular agent framework, repository layout, or sales
vertical.

The plugin first discovers the host's real commerce boundaries and shows an
integration plan. After explicit confirmation, it pins
[`mercadopago-commerce-agents-checkout` 0.1.0](https://github.com/mercadopago/commerce-agents-checkout/tree/v0.1.0),
generates a thin composition adapter, and wires it to the host's existing
post-model checkout handoff.

## Supported projects

Automatic integration targets server-side Python 3.11+ agent backends that
already provide:

- a confirmed cart with product ID, quantity, price, and currency;
- an authoritative server-side catalog lookup for title, current price,
  currency, and stock;
- durable checkout-attempt storage for `external_reference`, idempotency key,
  and unknown-outcome state; and
- a boundary that can render a hosted URL after model inference without placing
  it in the model context.

FastAPI, Flask, Django, a framework-neutral service, or a custom agent runtime
can all qualify. File names and class names do not determine compatibility.

The plugin does not generate integrations in other programming languages. For
those projects it provides the official server-side
[Checkout Pro Orders API contract](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/create-order/post)
and its safety checklist, then stops without editing the project.

## How it fits

```text
agent proposes a cart
  -> authenticated seller backend confirms ownership and quantities
  -> seller backend persists one checkout attempt atomically
  -> library rereads products and prices from the trusted catalog
  -> library creates and validates the Checkout Pro Order
  -> executor/UI renders the hosted checkout URL after the model call
  -> verified webhook + server-side Order lookup authorize fulfillment
```

The package owns the sensitive Orders API protocol: trusted-catalog repricing,
Order creation, response validation, cleanup, and safe hosted handoff. The
seller backend still owns identity, cart ownership, persistence, webhooks,
reconciliation, and fulfillment.

## Run the plugin

Install the public marketplace and plugin with Claude Code, then run the
namespaced command from the root of the Python project you want to integrate:

```bash
claude plugin marketplace add \
  https://github.com/mercadopago/mercadopago-claude-marketplace.git \
  --scope project

claude plugin install \
  mercadopago-commerce@mercadopago-claude-marketplace \
  --scope project
```

```text
/mercadopago-commerce:mp-commerce
```

The command always starts in read-only discovery. It reports:

1. Python version and dependency manager;
2. checkout entry point;
3. field-by-field cart mapping;
4. authoritative catalog lookup;
5. durable attempt repository;
6. post-model handoff boundary;
7. exact files it proposes changing; and
8. local or mocked checks it will run.

It applies nothing until you confirm that plan. An ambiguous checkout method,
catalog, store, or handoff causes a question or a safe stop instead of a guess.

## Dependency management

The apply phase declares the exact runtime dependency in the project's existing
workflow:

```text
mercadopago-commerce-agents-checkout==0.1.0
```

It supports uv, Poetry, Pipenv, PEP 621 `pyproject.toml`, and runtime
`requirements*.txt`. It does not edit several manifests at once, modify a
global Python environment, or replace the exact version with a range.

## Generated boundary

The neutral template in `templates/mp_checkout_adapter.py` uses composition,
not inheritance. Project-specific wiring supplies four small pieces:

```text
map_cart(host_cart) -> CheckoutCart
catalog.get_product_details(session, product_id) -> TrustedProduct
attempts.get_or_create(attempt_scope, cart_fingerprint) -> CheckoutAttempt
attempts.save_handoffs(...)
attempts.mark_outcome_unknown(...)
```

The template intentionally contains no in-memory attempt store. A production
integration must reuse the same persisted identifier pair across retries and
process restarts, and return a persisted successful handoff rather than rebuild
it against a potentially changed catalog. If the host has no durable
repository, the plugin reports it as a blocker rather than fabricating
persistence.

## Configuration

The only credential used by this scaffold is a server-side Access Token:

```dotenv
MERCADOPAGO_ACCESS_TOKEN=<TEST_COLLECTOR_ACCESS_TOKEN>
```

The plugin may copy `mp.env.example` when the variable is not already
documented, but it never creates or edits `.env`. It does not print credentials
or place them in browser or model code.

Price and currency come from the authoritative catalog. Do not add
model-provided prices, payer data, callback URLs, return URLs, or a checkout URL
to this configuration.

## Verification

The plugin uses the repository's existing formatter, type checker, and test
runner. Generated contract tests mock `MercadoPagoCheckout` and verify the cart
mapping, independent catalog lookup, persisted retry identifiers, unknown
outcome blocking, and post-model handoff. Tests do not contact Mercado Pago or
create an Order.

The template itself can be checked locally with:

```bash
python3 -m unittest discover \
  -s plugins/mercadopago-commerce/tests \
  -p 'test_*.py'
```

## Security boundaries

- The model selects products and quantities; the library rereads price,
  currency, stock, and title from the trusted seller catalog.
- The Access Token exists only in the server-side composition root.
- The host persists `external_reference`, idempotency key, and unknown-outcome
  state before or immediately after the corresponding atomic store operation
  and before any Orders API call.
- `attempt_scope` is an opaque authenticated host key, never raw shopper PII or
  an unauthenticated session ID.
- A timeout, transport interruption, or HTTP 423 can mean an Order exists. The
  adapter blocks fallback until that operation is reconciled.
- The `checkout_url` crosses only a post-model executor/UI boundary and is never
  inserted into prompts, messages, tool results, or agent memory.
- A browser return is not payment evidence. Fulfillment requires a verified
  webhook, a server-side Order lookup, correlation with the persisted attempt,
  and a valid local state transition.

## Companion capabilities

This plugin has no MCP server and does not need one for local discovery or
scaffolding. The separate `mercadopago` plugin can help create test users, add
signed webhooks, and perform a final integration review when requested.

Useful references:

- [Library integration contract](https://github.com/mercadopago/commerce-agents-checkout/blob/v0.1.0/docs/integration.md)
- [Create a Checkout Pro Order](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/create-order/post)
- [Webhooks and signature validation](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)

## Status

`0.4.0` — generic Python-agent discovery and scaffold backed by
`mercadopago-commerce-agents-checkout==0.1.0`. The host's durable attempt store,
webhook receiver, reconciliation worker, and fulfillment state machine remain
explicit seller responsibilities.
