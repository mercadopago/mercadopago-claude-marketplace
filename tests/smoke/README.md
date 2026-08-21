# Mercado Pago Claude plugin smoke tests

This harness exercises the local plugin against clean, disposable copies of
Rubistore. It never modifies the Rubistore checkout and never commits generated
code. The pinned source commit makes every run reproducible even when the local
Rubistore working tree is dirty.

## Scope

- CubeZone validates Checkout Pro CTA detection, the local Mercado Pago button,
  `POST /checkout/preferences`, and redirect through `init_point`.
- Folium validates Checkout API CTA detection, a dedicated payment page, labels,
  editable secure fields, CardForm lifecycle selects, and runtime public-key
  loading through a no-store JSON endpoint.
- Brewpoint validates MP Point Orders API scaffolding, replacement of the legacy
  QR action, guarded use of the standard virtual terminal, order lookup, and the
  official processed/failed/refunded/canceled/expired/action-required simulations
  without physical hardware.
- A separate Brewpoint fixture validates QR Orders API scaffolding and replacement
  of its redirect-based pseudo-QR flow. It covers `dynamic`, `static`, and `hybrid`,
  real test-order create/lookup/cancel, local QR rendering, and explicit UI states.
- Four Kreativa fixtures validate Card Payment, Payment, Wallet, and Status Screen
  as distinct Bricks contracts. The fixture is disposable; the validator itself
  scans framework-agnostic source files across any application root.
- Three Folium fixtures validate Subscriptions with plan, without plan/authorized,
  and without plan/pending. They preserve the existing dedicated signup page,
  replace its demo CTA, enforce trusted recurrence configuration, and distinguish
  secure card tokenization from the pending `init_point` redirect.
- Every scenario runs once per configured IT user.
- The initial runner scaffolds and statically validates generated code. Browser
  payment execution is intentionally a separate opt-in stage.

## Local credential profiles

Copy `profiles.example.json` to `profiles.local.json`. The local file is ignored
by Git. `sellerCredentialsFile` and `buyerCredentialsFile` point to env files
outside this repository. Do not put tokens or passwords in the JSON file.

Each credentials file must provide the variables required by the selected app,
including `MP_ACCESS_TOKEN` and, for Checkout API, `MP_PUBLIC_KEY`. The scaffold
stage never reads or copies that file. Runtime tests inject its values directly
into the child server process, so no generated checkout contains a credential
file. Buyer login or test-card variables needed by the browser stage will be
documented when that stage is enabled.

## Commands

```bash
cd tests/smoke
npm run dry-run -- --source /Users/esbento/Development/MELI/rubistore_codex

# Prepare clean copies only; Claude is not invoked.
npm run smoke:prepare -- \
  --source /Users/esbento/Development/MELI/rubistore_codex \
  --profiles ./profiles.local.json

# Invoke the local Claude plugin and run deterministic static validators.
npm run smoke -- \
  --source /Users/esbento/Development/MELI/rubistore_codex \
  --profiles ./profiles.local.json \
  --max-budget-usd 5
```

Use `--scenario <id>` or `--profile <id>` to run a single matrix entry. Outputs
are written under `.work/` and remain ignored. The runner never prints credential
values.

### Point runtime without hardware

Start the generated disposable app with `MP_POINT_TEST_MODE=true`, then execute:

```bash
node runtime-point.mjs \
  http://localhost:3102 \
  /absolute/path/to/seller-a.env \
  artifacts/point \
  15
```

The runtime creates one ARS 15 test order per reliable sandbox scenario using
`NEWLAND_N950__SBX0000001`. It never prints or stores the seller access token.
The `refunded` scenario is available as an explicit filter, but is skipped by
default because the sandbox may accept its event with HTTP 204 and leave the
order as `processed`:

```bash
node runtime-point.mjs http://localhost:3102 /path/to/seller-a.env artifacts/point-refund 15 refunded
```

To exercise the real generated CTA without creating additional orders, run the
Playwright UI test against the disposable app:

```bash
node runtime-point-ui.mjs http://localhost:3102 artifacts/point-ui
```

The UI test intercepts the Point routes and verifies one create call, status
reconciliation, and actionable rendering for `processed`, `failed`, and
`action_required`.

### QR runtime without a buyer phone

The seller must already have a Store and POS. Inspect only their safe metadata:

```bash
node inspect-qr-resources.mjs /absolute/path/to/seller-a.env
```

Run the real API contract directly for all three QR modes. Argentina requires
exactly the ARS 15 minimum used by this smoke test. Each order is canceled before
the next one is created, and no payment is attempted:

```bash
node runtime-qr.mjs \
  direct \
  /absolute/path/to/seller-a.env \
  artifacts/qr-direct \
  15 \
  001
```

After generating the `brewpoint-qr-orders-dynamic` fixture, start it with the
seller token and POS external ID injected only into the child process:

```bash
node start-server.mjs \
  .work/<run>/brewpoint \
  /absolute/path/to/seller-a.env \
  3103 \
  qr-dynamic \
  001

node runtime-qr.mjs \
  http://localhost:3103 \
  /absolute/path/to/seller-a.env \
  artifacts/qr-generated \
  15 \
  001

node runtime-qr-ui.mjs http://localhost:3103 artifacts/qr-ui
```

The real runtime asserts that dynamic and hybrid return QR data, static has the
POS QR image, all payload amounts match, and every created order reaches
`canceled`. The Playwright runtime intercepts the generated routes and validates
one CTA action, local QR rendering, order ID visibility, reconciliation for
`processed`, `expired`, and `refunded`, plus abandonment cancellation. A buyer
phone logged into the Mercado Pago app is still required for the final real scan,
processed payment, and refund smoke test; QR has no Point-style `/events`
simulator.

### Bricks browser runtime without a real charge

After generating a Bricks fixture, start it with seller A credentials injected
into the child process, then run the deterministic browser contract. The browser
replaces MercadoPago.js and the local payment/preference route with controlled
test doubles; it verifies runtime public-key loading, the selected Brick,
callbacks, exactly one backend request, `preferenceId`, and `paymentId` without
creating a real preference or payment:

```bash
node start-server.mjs .work/<run>/kreativa /path/to/seller-a.env 3104

node runtime-bricks-ui.mjs \
  http://localhost:3104 \
  card-payment \
  /checkout/bricks/card-payment \
  artifacts/bricks-card-payment
```

Repeat with `payment`, `wallet`, or `status-screen` and the destination declared
in `scenarios.json`. Card field tokenization against the real MercadoPago.js SDK,
Wallet buyer login/redirect, and an actual payment remain separate opt-in tests.

To validate the real Card Payment SDK without submitting a charge, keep the same
server running and include the fixture's purchase context in the destination:

```bash
node runtime-bricks-real.mjs \
  http://localhost:3104 \
  '/checkout/bricks/card-payment?serviceId=1&packageIndex=0&email=buyer@example.com' \
  artifacts/bricks-card-payment-real
```

This loads the real MercadoPago.js, asserts that at least three secure iframe
inputs mounted with non-zero dimensions and remain editable, and stores only
sanitized URLs. It does not fill a card or call the payment endpoint.

### Subscriptions runtimes without a recurring charge

Generate one of the three Folium scenarios, start its disposable server, and run
the deterministic browser contract. MercadoPago.js and the local subscription
route are replaced with controlled doubles, so no plan, subscription, invoice,
or payment is created:

```bash
node start-server.mjs \
  .work/<run>/folium \
  /path/to/seller-a.env \
  3108 \
  subscriptions-with-plan \
  2c938084000000000000000000000000

node runtime-subscriptions-ui.mjs \
  http://localhost:3108 \
  with-plan \
  /checkout-suscripcion.html \
  artifacts/subscriptions-with-plan
```

Repeat with `without-plan-authorized` on port 3109 or
`without-plan-pending` on port 3110. The authorized contracts assert three
editable secure iframe fields, runtime public-key loading, and a single fake
token submission. The pending contract asserts that no public key or token is
used and that the buyer is redirected only to the returned `init_point`.

The API probe authenticates with seller A, performs read-only plan/subscription
searches, and sends one deliberately invalid create request that must be rejected.
It verifies current API availability/schema without leaving a resource behind:

```bash
node runtime-subscriptions-api.mjs \
  /absolute/path/to/seller-a.env \
  artifacts/subscriptions-api
```

A real authorized subscription is intentionally not automated by default: it can
charge immediately and continue charging. That final opt-in test requires a fresh
test-buyer card token, verification of the first result, and immediate cancellation
through `PUT /preapproval/{id}`.
