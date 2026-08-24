# Guide: Checkout Bricks
# Updated: 2026-08-20 | Source: official Mercado Pago Checkout Bricks documentation

Use this file as an orchestration contract. Adapt routes, files, language, styles,
and framework conventions to the application being edited.

## Choose exactly one Brick

| `brick=` | Client component | Server contract |
|---|---|---|
| `card-payment` | `CardPayment` or `cardPayment` | Create a payment from the token via Payments API |
| `payment` | `Payment` or `payment` | Create the selected payment method via Payments API |
| `wallet` | `Wallet` or `wallet` | Create a preference dynamically via exactly `/checkout/preferences`, with no version segment |
| `status-screen` | `StatusScreen` or `statusScreen` | Display an existing payment using `paymentId`; it does not create a payment |

`CardForm`, `PaymentForm`, and `CheckoutForm` are not React SDK components.
Use `CardPayment`, `Payment`, `Wallet`, or `StatusScreen` from
`@mercadopago/sdk-react`. In vanilla applications, use MercadoPago.js v2 and
`mp.bricks().create(...)`.

## Application-generic scaffold rules

1. Inspect the whole project before choosing files. Reuse its framework, router,
   server, start command, styling, currency, cart/order state, and language.
   When the server listens on a port, preserve `process.env.PORT` (or the stack's
   equivalent environment override) so disposable, container, and production
   runtimes can select the port.
2. Use the real checkout/charge CTA when one exists. Preserve its text and style,
   remove its previous competing handler, and navigate it to the new Brick route.
   If no CTA exists, still create the route and tell the developer exactly how to
   open and link it.
3. Create the Brick UI as a dedicated route/page owned by a new file. Do not place
   it inside an existing cart, modal, drawer, or unrelated checkout form.
4. Never collect raw card fields. The Brick owns card number, expiration, CVV,
   cardholder, and required payer fields. Do not add duplicate inputs around it.
5. Show the server-owned total above `CardPayment` and `Payment`. Do not trust an
   amount supplied by the browser when creating the payment or preference.
6. Load the public key through the detected framework's public configuration
   convention. In a vanilla app with a backend, expose `GET /api/mp-config` as
   JSON with `Cache-Control: no-store, max-age=0`, fetch it with `cache:
   'no-store'`, and fail visibly when `MP_PUBLIC_KEY` is missing. Never inject an
   HTML placeholder such as `%MP_PUBLIC_KEY%`.
7. Keep `MP_ACCESS_TOKEN` server-side. Never log or persist card tokens.
8. Render explicit initializing, processing, success, and actionable error states.
   The submit callback must return/await the server request.
9. Initialize only after the mount node exists. When using the vanilla builder,
   retain the controller and call `unmount()` when the page/component is removed.
   The React SDK component owns its controller lifecycle; do not invent a second
   controller around it.

## Card Payment Brick

- The backend receives the Brick output and creates the payment with the minimum
  card fields returned by the SDK: token, transaction amount, installments,
  payment method ID, and payer email.
- Map both the SDK's camelCase names and the API's snake_case deliberately; do not
  silently send `undefined` for `payment_method_id` or `issuer_id`.
- Include `issuer_id` only when the Brick returns it.
- Generate a new `X-Idempotency-Key` for the logical purchase and reuse it only
  when retrying that same purchase.
- Return the created `payment.id` as `paymentId`. Use it to render Status Screen.
- `onSubmit` must return a Promise that resolves only after the backend responds.

## Payment Brick

- Payment Brick is multi-method. Preserve `paymentType`/selected-method data from
  the Brick and branch server mapping according to the returned method instead of
  forcing card-only fields onto Pix, ticket, or wallet flows.
- All creation branches use the Payments API. Validate against trusted
  cart/session data before sending the request.
- Return `paymentId`, `status`, and any method-specific next-step data required by
  the UI. A pending Pix/ticket response is not a generic error.

## Wallet Brick

- Create a new preference on the server for the current cart/session.
- Send only an opaque purchase/cart identifier from the browser. Re-read product,
  quantity, currency, and amount from trusted server-side cart/order/session state;
  never build the preference from `unit_price` supplied by the client.
- The path is exactly `/checkout/preferences`; there is no `v1` segment.
- Return only the generated preference ID needed by the client.
- Never hardcode `PREFERENCE_ID`, `YOUR_PREFERENCE_ID`, a copied ID, or an ID in
  source control. Fetch it for the current session before mounting Wallet.
- Configure same-origin return URLs only when the application has a public HTTPS
  origin. Do not enable localhost `auto_return`.
- Wallet requires a logged-in Mercado Pago buyer for the wallet-only experience.

## Status Screen Brick

- It is a result screen, not a payment-creation form.
- Initialize it with `paymentId` from the Payments API response or a validated
  route/query parameter. Never pass an Orders API order ID.
- Do not render a second custom 3DS iframe; Status Screen handles the challenge.
- Missing or malformed `paymentId` must produce a visible error instead of
  mounting an empty Brick.

## Required validation after scaffolding

Run from the application root, replacing the variant:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . card-payment
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . payment
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . wallet
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bricks-integration.mjs" . status-screen
```

Fix every failure before reporting the scaffold as complete.

## Test boundary

- Mounting, configuration delivery, CTA routing, callbacks, states, and backend
  request shape can be automated without a real charge by intercepting local API
  routes in Playwright.
- A real Card Payment/Payment test uses test credentials and a test card. Never
  submit a charge unless the developer explicitly authorized payment execution.
- Wallet redirect/login needs a buyer test account and may require an interactive
  browser session.
