---
name: mp-commerce-checkout
description: Discover and wire the pinned Mercado Pago Checkout Pro adapter into Python 3.11+ server-side commerce-agent backends. Use when an agent needs a hosted Mercado Pago payment handoff built from a trusted catalog and rendered outside the model.
license: Apache-2.0
metadata:
  version: "0.4.0"
  author: "Mercado Pago Developer Experience"
  copyright: "Copyright (c) 2026 Mercado Pago (MercadoLibre S.R.L.)"
  category: "development"
  tags: "mercadopago, commerce-agents, agentic-commerce, checkout-pro, orders-api, python"
---

# mp-commerce-checkout

Discover and integrate Mercado Pago Checkout Pro into an existing Python
commerce-agent backend. Do not depend on a particular repository layout,
framework, vertical, class name, or agent SDK.

The integration delegates the payment protocol to the exact published package
`mercadopago-commerce-agents-checkout==0.1.0`. The host remains responsible for
authentication, cart ownership, the authoritative catalog, durable checkout
attempts, webhook verification, reconciliation, and fulfillment.

This is scaffolding. It must not make a live API request, create an Order, edit
`.env`, or expose a credential. It has two mandatory phases: read-only
discovery, then an explicitly confirmed apply phase.

## Contract to preserve

```text
agent proposes products and quantities
  -> authenticated seller backend confirms the cart
  -> backend durably persists external_reference + idempotency_key
  -> MercadoPagoCheckout rereads every product from the trusted catalog
  -> library creates and validates the Checkout Pro Order
  -> executor/UI receives CheckoutHandoff(checkout_url) after the model call
  -> verified Order webhook and server-side GET authorize fulfillment
```

The model must never receive the Access Token, idempotency key, seller
reference, raw Order response, Order ID, or `checkout_url`. Creating an Order
returns a buyer-controlled hosted payment step; it is not proof of payment.

## Phase 1: read-only discovery

Run this phase first even when the developer asks to apply immediately. Do not
write files, install packages, update lockfiles, or execute project code.

### 1. Establish project compatibility

Inspect manifests and source without importing the application:

- confirm the backend is Python and can run Python 3.11 or newer from
  `project.requires-python`, Poetry constraints, `.python-version`, runtime
  configuration, or an explicit developer confirmation;
- identify the dependency declaration and manager from `uv.lock`,
  `poetry.lock`, `Pipfile`, `pyproject.toml`, or `requirements*.txt`;
- distinguish runtime dependency files from development/test-only files;
- identify the server or worker entry point and the framework, if any.

When multiple active dependency managers or runtime manifests remain plausible,
show the candidates and ask which one owns production dependencies. Never choose
one merely because its file appears first.

### 2. Discover capabilities semantically

Use file search and Python AST/source inspection. Paths and names are clues, not
proof. Do not require `examples/retail`, `shopping_agent`, `MockRetail`,
`StorefrontBackend`, FastAPI, or any other specific framework.

Find and cite the relevant symbols for all five capabilities:

1. **Checkout entry point** — the route, tool, command, service method, or
   executor action that starts payment after the cart is confirmed.
2. **Cart contract** — how confirmed lines expose product identifier, quantity,
   displayed/confirmed price, and currency.
3. **Authoritative catalog** — a server-owned lookup that independently returns
   title, price, currency, and stock for a product or variant. A model tool
   result, request payload, cart price, prompt, or browser state is not an
   authoritative catalog.
4. **Durable attempt store** — persistent storage able to atomically create and
   reload an opaque `external_reference`, an idempotency key, and the
   `outcome_unknown` state across retries and process restarts, and to retain a
   successful handoff so a retry does not build another payable path.
5. **Handoff boundary** — a response/enrichment/UI channel that can deliver the
   library's hosted URL after model inference without inserting it into model
   messages, prompts, tool results, or memory.

Also locate the verified webhook/order-status path used to close an attempt.
Its absence does not justify inventing one inside the adapter; record it as a
production blocker.

For each capability, report the file, symbol, evidence, and confidence. When
there are multiple plausible checkout, catalog, persistence, or handoff symbols,
ask the developer to select one. When a required capability is absent, stop the
apply phase and explain what the host must provide. Never invent prices,
persistence, authentication, or a safe output boundary.

### 3. Present the integration plan

Before changing anything, show a concise plan containing:

- detected Python version and dependency manager;
- exact dependency declaration to add;
- selected checkout entry point and call site;
- field-by-field cart mapping;
- selected trusted catalog lookup and record mapping;
- selected durable attempt store and lifecycle operations;
- the opaque host value that will be used as `attempt_scope` (never raw PII or
  an unauthenticated session ID);
- the safe handoff destination outside the model;
- files to create or edit; and
- local/mocked checks to run.

Call out every assumption. Ask for explicit confirmation of this displayed
plan. Do not treat a command argument, earlier generic approval, or permission
to inspect the repository as permission to apply edits.

## Non-Python fallback

Do not generate JavaScript, Java, Go, Ruby, PHP, or other language adapters.
Explain that automatic integration currently supports Python 3.11+ server-side
agent backends. Point the developer to the official Checkout Pro Orders API:

https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/create-order/post

Provide this minimal conceptual server-side contract, without fabricating a
project-specific implementation:

```text
POST https://api.mercadopago.com/v1/orders
Authorization: Bearer <server-side access token>
X-Idempotency-Key: <durably persisted operation key>

body:
  type: online
  processing_mode: manual
  external_reference: <durably persisted seller order reference>
  total_amount: <sum of authoritative catalog prices>
  items: <titles, quantities, and unit prices from the authoritative catalog>

response used by the backend:
  id
  status
  checkout_url
```

Include the safety checklist: keep credentials server-side; independently
reprice from the seller catalog; persist the reference and idempotency key
before POST; never expose `checkout_url` to the model; treat timeout/HTTP 423 as
an unknown outcome requiring reconciliation; and authorize fulfillment only
after a verified webhook plus server-side Order lookup. Then stop. Do not edit
the non-Python project.

## Phase 2: confirmed apply

Proceed only after the developer confirms the discovery plan.

### 1. Declare the exact dependency

Pin exactly:

```text
mercadopago-commerce-agents-checkout==0.1.0
```

Use the project's existing production dependency workflow:

| Detected owner | Apply with |
|---|---|
| `uv.lock` / uv-managed `pyproject.toml` | `uv add "mercadopago-commerce-agents-checkout==0.1.0"` |
| `poetry.lock` / `[tool.poetry]` | `poetry add "mercadopago-commerce-agents-checkout==0.1.0"` |
| `Pipfile` | `pipenv install "mercadopago-commerce-agents-checkout==0.1.0"` |
| PEP 621 `pyproject.toml` without a manager | add the exact entry to `project.dependencies` using the repository's established formatting, then update its lock only if one exists |
| runtime `requirements*.txt` | add the exact requirement to the runtime file and use the repository's normal lock/compile workflow if present |

Do not modify a global Python environment. Do not add the same dependency to
multiple manifests. Do not replace the exact pin with a range.

### 2. Generate a thin composition adapter

Use `${CLAUDE_PLUGIN_ROOT}/templates/mp_checkout_adapter.py` as the neutral
reference. Copy or adapt only the pieces the host needs. The generated module
must use composition; do not subclass the agent backend merely to change its
checkout method.

Wire explicit host functions or small adapters for:

- `map_cart(host_cart) -> CheckoutCart`;
- `catalog.get_product_details(session, product_id) -> TrustedProduct`;
- `attempts.get_or_create(attempt_scope, cart_fingerprint)`;
- `attempts.save_handoffs(...)`;
- `attempts.mark_outcome_unknown(...)`; and
- the existing post-model handoff boundary.

The adapter intentionally has no in-memory persistence implementation. Do not
add one as a production fallback. If the target repository lacks durable
storage, stop and ask the developer which durable repository to use.

Do not recreate an Orders HTTP client, manually build an Orders payload, or
copy transport code into the host: version `0.1.0` owns that boundary. Do not
overwrite an existing integration silently; show the conflict and obtain
specific approval.

### 3. Configure without exposing credentials

Copy `mp.env.example` only when the repository does not already document
`MERCADOPAGO_ACCESS_TOKEN`. Never create or edit `.env`, commit a credential,
print a token, or put it in client-side code.

Do not configure payer data, model prices, callbacks, return URLs, or a checkout
URL in the scaffold. The library derives price and currency from the trusted
catalog.

### 4. Wire the existing host boundary

Call the composed adapter only after host authentication and cart confirmation.
Pass an opaque, server-owned `attempt_scope` that lets the durable repository
identify one purchase attempt without using shopper PII or an untrusted session
identifier.

Deliver the returned `CheckoutHandoff` through the previously identified
executor/UI boundary after the model call. Do not serialize it into a model tool
result or conversation memory. Preserve every unrelated agent capability.

If `CheckoutOutcomeUnknown` is raised, persist that state and block every
fallback or new payable path until the original operation is reconciled. Close
the attempt only when a verified terminal Order webhook and server-side Order
lookup have updated the seller's local state.

## Local verification

Use the target repository's formatter, type checker, and test runner. Add local
contract tests that mock `MercadoPagoCheckout`; tests must prove at least:

- cart fields are mapped without inventing a price or currency;
- the catalog lookup is independent from the cart/model data;
- the persisted identifier pair is reused for a retry;
- an unknown outcome is durably marked and blocks the next handoff;
- the hosted URL crosses only the post-model handoff boundary; and
- no test contacts Mercado Pago.

Compile/import only within the target's isolated environment. Do not create an
Order or contact Mercado Pago without separate explicit authorization. Report
the files changed, checks run, and any remaining production blockers.

## Payment confirmation

The hosted URL and browser return are never payment confirmation. Production
must validate the Order webhook signature, deduplicate the event, fetch the
Order server-side, match its `external_reference`, amount, and currency to the
persisted attempt, and apply a valid local state transition before fulfillment.

Official references:

- https://github.com/mercadopago/commerce-agents-checkout/blob/v0.1.0/docs/integration.md
- https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/create-order/post
- https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
