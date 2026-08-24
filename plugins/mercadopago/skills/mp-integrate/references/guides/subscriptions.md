# Guide: Subscriptions (Recurring Payments)
# Updated: 2026-08-21 | Sources: official Mercado Pago Subscriptions docs and API reference

## Choose one contract before scaffolding

Subscriptions has three distinct integration contracts. Never merge their payloads or UI:

| Contract | Payment method at creation | Server payload | Buyer flow |
|---|---|---|---|
| `with-plan` | Required | `preapproval_plan_id`, `payer_email`, `card_token_id`, `status: "authorized"` | Tokenize securely on the merchant page, then create `/preapproval` |
| `without-plan-authorized` | Required | `reason`, `external_reference`, `payer_email`, `card_token_id`, `auto_recurring`, `back_url`, `status: "authorized"` | Tokenize securely on the merchant page, then create `/preapproval` |
| `without-plan-pending` | Not defined yet | `reason`, `external_reference`, `payer_email`, `auto_recurring`, `back_url`, `status: "pending"` | Create `/preapproval`, then redirect to its `init_point` |

Ask for this contract with `AskUserQuestion` only when it cannot be inferred from the application or the developer's request. A subscription created without `preapproval_plan_id` cannot later be migrated to a plan.

## Non-negotiable scaffold contract

1. Scan the whole application for subscription CTAs and their current handlers. Distinguish entry CTAs (pricing cards, header links, marketing modals) from the one final create action. Reuse the application's dedicated signup page when one already exists; every entry CTA must navigate to that page and must not create a preapproval itself. Mark the one final action with `data-mp-subscription-cta="{contract}"` and the signup page root with `data-mp-subscriptions-page="{contract}"`. Remove competing demo/old handlers and their orphan server routes so the application contains exactly one preapproval creation path. If there is no CTA, create the signup page and report its exact route plus how the developer must link it.
2. The browser sends only an opaque offer ID, payer data not already present in trusted session state, and (authorized contracts only) the single-use token. Price, currency, frequency, reason, plan ID, and `external_reference` are resolved or created on the server.
3. Never render an input for `card_token`, `card_token_id`, or a raw card number. Authorized contracts tokenize with MercadoPago.js CardForm or the official Card Payment Brick. Tokens are single-use, expire in seven days, and must never be stored or logged.
4. `with-plan` uses a server-controlled `MP_SUBSCRIPTION_PLAN_ID` (or a trusted database record). Plan provisioning is an operator/admin action, never a public POST attached to the buyer CTA. Do not accept `plan_id` from the browser. Do not repeat `auto_recurring` in the subscription body: the associated plan owns those terms.
5. `without-plan-authorized` and `without-plan-pending` build `auto_recurring` from a server-side offer catalog. Never trust amount, currency, frequency, repetitions, billing day, or trial settings from the request body.
6. Create subscriptions only at exactly `/preapproval`; plans use exactly `/preapproval_plan`. Neither endpoint has a `/v1` prefix.
7. Prevent duplicate submissions in the client and server, and create a unique, persisted `external_reference` for reconciliation. The current Subscriptions API reference documents `Authorization` but not `X-Idempotency-Key`; do not claim unsupported idempotency semantics.
8. Implement `GET /api/subscriptions/:id` for reconciliation and a server-side lifecycle route whose action is allowlisted to `pause`, `reactivate`, or `cancel`. Map them to `paused`, `authorized`, and `canceled` through `PUT /preapproval/{id}`. Never accept an arbitrary status from the browser.
9. Handle `pending`, `authorized`, `paused`, and `canceled` explicitly in the UI. Also render initializing, processing, success, and actionable error states.
10. Use HTTPS for production `back_url`. A localhost HTTP fallback is acceptable only for local development.

## Authorized contracts — secure card form

Load the public key through the application's existing public runtime configuration. For vanilla applications with a backend, expose `GET /api/mp-config`, return `{ publicKey }`, send `Cache-Control: no-store, max-age=0`, and fetch it with `cache: "no-store"`. Never substitute `%MP_PUBLIC_KEY%` into HTML.

Every visible field has a persistent localized label. Card number, expiration date, and security code are iframe hosts, not `<input>` elements. Keep them empty, visible, non-zero height, and interactive. Mount CardForm only after the page is visible.

MercadoPago.js CardForm requires `issuer`, `installments`, and `identificationType` lifecycle nodes. Render one `<select hidden aria-hidden="true" tabindex="-1">` for each, keep all three inside the form, and map their exact IDs in `mp.cardForm(...)`. Never disable them. Omitting these nodes can break the SDK lifecycle and leave secure iframe fields unresponsive.

Minimum structure:

```html
<main data-mp-subscriptions-page="without-plan-authorized">
  <form id="subscription-card-form">
    <div role="group" aria-labelledby="card-number-label">
      <span id="card-number-label">Número do cartão</span>
      <div id="subscription__cardNumber" data-mp-secure-field="cardNumber"></div>
    </div>
    <div role="group" aria-labelledby="expiration-label">
      <span id="expiration-label">Validade (MM/AA)</span>
      <div id="subscription__expirationDate" data-mp-secure-field="expirationDate"></div>
    </div>
    <div role="group" aria-labelledby="security-label">
      <span id="security-label">Código de segurança</span>
      <div id="subscription__securityCode" data-mp-secure-field="securityCode"></div>
    </div>
    <label for="subscription__cardholderName">Nome no cartão</label>
    <input id="subscription__cardholderName" autocomplete="cc-name" required>
    <label for="subscription__payerEmail">E-mail</label>
    <input id="subscription__payerEmail" type="email" autocomplete="email" required>
    <select hidden aria-hidden="true" tabindex="-1" id="subscription__issuer" data-mp-sdk-required-field="issuer"></select>
    <select hidden aria-hidden="true" tabindex="-1" id="subscription__installments" data-mp-sdk-required-field="installments"></select>
    <select hidden aria-hidden="true" tabindex="-1" id="subscription__identificationType" data-mp-sdk-required-field="identificationType"></select>
    <button type="submit" data-mp-subscription-cta="without-plan-authorized">Assinar</button>
  </form>
</main>
```

The exact application may source payer email and identification from an authenticated profile. In that case, omit their visible inputs and pass the trusted values separately; do not register missing fields in CardForm.

## Server-side payloads

These are minimal field contracts. Adapt the local route and trusted catalog to the application; do not expose the access token to the client.

### With plan

```js
const body = {
  preapproval_plan_id: process.env.MP_SUBSCRIPTION_PLAN_ID,
  payer_email: trustedPayer.email,
  card_token_id: singleUseCardToken,
  external_reference: subscriptionRecord.externalReference,
  back_url: subscriptionBackUrl,
  status: 'authorized',
};
```

### Without plan, authorized

```js
const body = {
  reason: trustedOffer.reason,
  external_reference: subscriptionRecord.externalReference,
  payer_email: trustedPayer.email,
  card_token_id: singleUseCardToken,
  auto_recurring: {
    frequency: trustedOffer.frequency,
    frequency_type: trustedOffer.frequencyType,
    transaction_amount: trustedOffer.amount,
    currency_id: trustedOffer.currency,
  },
  back_url: subscriptionBackUrl,
  status: 'authorized',
};
```

### Without plan, pending

```js
const body = {
  reason: trustedOffer.reason,
  external_reference: subscriptionRecord.externalReference,
  payer_email: trustedPayer.email,
  auto_recurring: {
    frequency: trustedOffer.frequency,
    frequency_type: trustedOffer.frequencyType,
    transaction_amount: trustedOffer.amount,
    currency_id: trustedOffer.currency,
  },
  back_url: subscriptionBackUrl,
  status: 'pending',
};
// Return body.id/status/init_point to the client, then navigate to init_point.
```

For all contracts, call the API from the server:

```js
const response = await fetch('https://api.mercadopago.com/preapproval', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
```

Do not return raw Mercado Pago error bodies or card tokens to the browser. Return a stable local error code and an actionable localized message, while logging only sanitized request IDs/statuses on the server.

## Plan provisioning

A reusable plan requires `reason`, `auto_recurring`, and `back_url`. Provision it once through an admin-only script or deployment step, verify it through `GET /preapproval_plan/{id}`, then store only its ID in server configuration. Do not create a new plan per subscriber.

## Acceptance check

After the CTA, page, client tokenization, server route, and lifecycle routes are complete, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-subscriptions-integration.mjs" . "{contract}"
```

Fix every failure before reporting success.

## Webhooks and testing

Enable `subscription_preapproval_plan` for plan changes, `subscription_preapproval` for subscription changes, `subscription_authorized_payment` for recurring invoices, and `payments` for the underlying payments. Delegate receiver/HMAC scaffolding to `mp-webhooks`.

Automated smoke tests may safely validate source, browser tokenization with controlled doubles, read-only API searches, and rejected invalid payloads. Creating an authorized subscription can charge immediately or schedule real charges; never do it automatically. A real end-to-end authorized test requires an explicit opt-in, a test buyer, a fresh test card token, and immediate cancellation/verification.
