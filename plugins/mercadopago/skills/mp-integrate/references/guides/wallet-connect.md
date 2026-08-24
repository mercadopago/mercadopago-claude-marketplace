# Wallet Connect — Scaffold Contract

Read this guide only after the developer explicitly confirms that Mercado Pago
enabled Wallet Connect for the application. Wallet Connect is not self-service.
Without that confirmation, stop with
`BLOCKED: active Wallet Connect agreement required` and do not change files.

## Product boundary

Wallet Connect is not the Wallet Brick and does not collect card data. It links a
buyer's Mercado Pago wallet to the integrator, creates a server-only payer token,
and then uses that token in Orders API payments.

The scaffold has two server-side flows:

1. Account linking: create an agreement, redirect the buyer to the returned
   approval URI, exchange the approved code for a payer token, and store the
   token encrypted.
2. Payment: resolve the connected buyer and trusted purchase on the server and
   create an idempotent Wallet Connect order.

## Required configuration

```dotenv
MP_ACCESS_TOKEN=APP_USR-...
MP_WALLET_PLATFORM_ID=...
MP_WALLET_RETURN_URI=https://your-app.example/wallet-connect/return
MP_WALLET_TOKEN_ENCRYPTION_KEY=64-hex-characters
```

Keep all four values on the server. Never expose the access token, platform ID,
approval code, agreement ID, or payer token in browser storage, HTML, logs, or
API responses. `.env.example` contains placeholders only and `.env` remains
ignored.

## Dedicated page and CTA behavior

Create a dedicated Wallet Connect page marked
`data-mp-wallet-connect-page="account-linking"`. Scan the entire application for
the real final checkout CTA. When found, preserve its text and presentation,
remove the competing handler, mark it `data-mp-wallet-connect-entry="checkout"`,
and make it navigate to the dedicated page. If no CTA exists, create the page and
report its exact route plus the invocation the developer must wire.

The dedicated page must:

- query a server endpoint that returns only safe linkage state such as
  `{ connected: true }`;
- show one `data-mp-wallet-connect-cta="start"` action when approval is needed;
- redirect only to the `agreement_uri` returned by the server;
- show one `data-mp-wallet-connect-cta="pay"` action when linked;
- send only an opaque purchase identifier to the local payment endpoint;
- render loading, approval-required, connected, processing, success with order
  ID, and actionable error states.

Do not render card fields, load MercadoPago.js, request `MP_PUBLIC_KEY`, or mount
the Wallet Brick.

## Account-linking contract

- Create agreements server-side at the current Wallet Connect agreements API.
- Send `Authorization` and the configured platform header from server
  configuration.
- Derive `external_user`, `external_flow_id`, validation amount, description,
  and return URI from authenticated server-side state. Never accept them as
  authoritative browser fields.
- Persist the pending agreement against the authenticated buyer/session before
  redirecting to the returned approval URI.
- On the exact configured return route, validate the returned agreement and
  approval code against the pending record, consume the code once, and create
  the payer token server-side.
- Encrypt the payer token with authenticated encryption (for example
  AES-256-GCM) and store it in a persistent repository. Never return or log it.
- Return only safe linkage state to the browser. Support explicit unlinking, but
  never cancel a real agreement without a direct user action.

## Orders API payment contract

- The browser sends only an opaque purchase ID.
- If the application needs a purchase bootstrap route, the browser may send only
  product IDs and quantities. Reprice items from a trusted server-side catalog;
  never accept title, unit price, total, payer identity, or wallet identity.
- Resolve buyer linkage, items/description, amount, currency, and reconciliation
  reference from trusted server-side repositories.
- Decrypt the payer token only for the outgoing request and never persist or log
  plaintext.
- Create an Orders API order with `type: "online"`, automatic capture, matching
  two-decimal string values for `total_amount` and payment `amount`, payment
  method `type: "wallet"`, `id: "wallet"`, the payer token, and the required
  stored-credential metadata.
- Include a unique `X-Idempotency-Key`, trusted `external_reference`, and the
  configured platform ID in integration data.
- Implement order lookup by ID for reconciliation and treat webhook state as the
  source of truth for asynchronous updates.
- Agreement, linkage, and purchase repositories must be durable. An in-memory
  `Map`/object is allowed only in an explicitly labeled test double, never in the
  generated application scaffold.

## Acceptance check

Before reporting a successful scaffold, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-wallet-connect-integration.mjs" .
```

The validator is static and framework-agnostic. A full live test still requires
commercial enablement, a buyer approval in the Mercado Pago wallet UI, and an
explicitly authorized test order.
