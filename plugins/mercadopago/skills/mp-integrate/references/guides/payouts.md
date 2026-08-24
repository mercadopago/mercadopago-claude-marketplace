# Payouts (formerly Money Out) — Scaffold Contract

`money-out` is a legacy product alias. Normalize it to `payouts` for user-facing
text and documentation lookup, while retaining `product=money-out` as the
wizard routing value for backwards compatibility.

Payouts moves money from the integrator's Mercado Pago balance to one or more
destination accounts. It is not Checkout, a buyer payment, Marketplace split,
an Advanced Payment, or a seller's ordinary dashboard withdrawal. Do not add a
checkout CTA, card fields, MercadoPago.js, or a public key.

## Country contract must be resolved first

Payouts has country-specific API contracts. Never reuse a payload or endpoint
from another site.

- **Argentina (`AR`/`MLA`)**: batch Payouts contract. One request can contain
  one or more trusted destination transactions. Support payout lookup,
  transaction listing, and individual transaction lookup. Scheduling and
  cancellation are optional; cancellation is valid only for a previously
  scheduled transaction whose current state still permits it.
- **Brazil (`BR`/`MLB`)**: single Transaction Intent contract. One request has
  exactly one destination account and uses either Pix-key or bank-account data.
  Support transaction-intent lookup after creation.
- **Other countries**: query the current country-specific official guide using
  the normal documentation hierarchy. If no verified country contract is
  returned, stop with `BLOCKED: verified Payouts country contract required`.
  Never infer that the Argentina or Brazil contract applies.

The exact endpoint and payload must come from the current country guide. The
deterministic validator knows the current Argentina and Brazil contracts and
rejects the obsolete `disbursements` and `advanced_payments` routes.

## Server-only boundary

Payout creation is a privileged money-movement operation. Scaffold it as an
internal service or an authenticated back-office action, never as a public
buyer endpoint.

- Require an authenticated principal plus an explicit payout/operator
  authorization check before creation, lookup of sensitive details, or
  cancellation.
- Accept at most an opaque payout-instruction ID from an internal client. Load
  the destination, holder identity, amount, currency, description, schedule,
  and reconciliation references from a durable trusted repository.
- If a test-scenario selector is exposed, it must exist only behind explicit
  Payouts test mode and map through a server allowlist. It must never accept an
  arbitrary external reference.
- Never accept amount, currency, email, Pix key, bank, branch, account number,
  holder, document, schedule, notification URL, or external reference as
  authoritative request-body fields.
- Persist the instruction, idempotency key, returned payout/transaction IDs,
  status transitions, operator identity, and audit timestamps durably. An
  in-memory `Map` or object is permitted only in an explicitly named test
  double.
- Return only the minimum safe response to an internal client: resource ID,
  coarse status, and timestamps. Do not return destination account or holder
  identity data.

## Authentication, idempotency, and test isolation

Required server configuration:

```dotenv
MP_ACCESS_TOKEN=APP_USR-...
MP_PAYOUTS_TEST_MODE=true
MP_PAYOUTS_NOTIFICATION_URL=https://your-public-host.example/webhooks/payouts
MP_PAYOUTS_PRIVATE_KEY_PATH=/run/secrets/mp-payouts-ed25519.pem
```

- Send the Access Token only from the server.
- Use a unique and persisted `X-Idempotency-Key` for each logical payout. A
  retry of the same logical instruction must reuse that key; a new payout must
  receive a new key.
- Test mode is explicit: `MP_PAYOUTS_TEST_MODE=true` must produce
  `X-test-token: true` and must not move real funds. Production must never
  silently inherit test behavior.
- Production requires end-to-end Ed25519 signing of the exact serialized body.
  Encode the signature as base64, send it in `X-signature`, and send
  `X-enforce-signature: true`. Keep the private key outside the repository and
  logs. Test mode may use `X-enforce-signature: false`.
- Never hardcode test mode, production mode, an Access Token, a private key, or
  a destination account in application source.

## Trusted request invariants

For every country contract:

- Validate finite positive monetary values and the official country currency.
- Validate the destination type and country-specific account fields before the
  Mercado Pago call.
- Use unique reconciliation references with the documented character/length
  restrictions.
- A request may not be sent until authorization, instruction state, balance
  policy, idempotency, and destination validation have passed.
- Treat accepted/created/pending responses as asynchronous. Persist them and
  reconcile by resource lookup plus Webhooks; never equate HTTP acceptance with
  final accreditation.

For Argentina, validate that the batch has between 1 and 1000 transactions and
that each transaction currency is `ARS`. For Brazil, validate that source,
destination, and total amounts are equal, destination account type is current,
and the bank-transfer currency is `BRL`.

## Notifications and audit

Use a public HTTPS notification URL from server configuration. Do not accept it
from the caller and do not use localhost. Acknowledge the notification quickly,
then fetch the notified resource from Mercado Pago before updating local state.
Keep notification processing idempotent and append every status transition to
the audit trail. Delegate receiver signature details to `mp-webhooks` instead of
inventing a second generic webhook contract.

## Safe automated test

Automated integration tests may call Mercado Pago only when all of these are
true:

1. test credentials are loaded at runtime from an ignored file;
2. `MP_PAYOUTS_TEST_MODE=true` is set;
3. every mutation sends `X-test-token: true`;
4. the destination and payload are the official test fixtures for the resolved
   country;
5. the amount is within the configured smoke-test ceiling;
6. production signing keys and real destination data are absent.

The test must assert the accepted response and then query the created resource.
It must never retry creation with a fresh idempotency key after an ambiguous
timeout.

## Acceptance check

After the service, repository, authorization guard, audit trail, country
contract, and test-mode branch have been written, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-payouts-integration.mjs" . "{AR|BR}"
```

This check is static. A real production transfer additionally requires
production credentials, the registered Ed25519 public key, an available
balance, approved operational controls, and an explicitly authorized release.
