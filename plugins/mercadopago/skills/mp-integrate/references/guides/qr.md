# Guide: QR Code Payments (Orders API)
# Updated: 2026-08-20 | Source: official Mercado Pago QR Orders documentation

## Non-negotiable contract

- New QR integrations use `POST https://api.mercadopago.com/v1/orders` with `type: "qr"`.
- Never scaffold `/instore/orders/qr/...`, `/instore/qr/...`, a redirect Checkout order, or a QR that merely encodes a checkout URL.
- A Store and POS must already exist. The order uses the POS `external_id` in `config.qr.external_pos_id`.
- Valid QR modes are `static`, `dynamic`, and `hybrid`.
- Every creation request requires `X-Idempotency-Key`, a unique `external_reference`, one payment transaction, and matching string amounts.
- Keep the scaffold payload minimal. Do not invent `payer` data and do not carry legacy `items[].currency_id` or `items[].total_amount` into QR Orders.
- Treat cart totals as untrusted. Validate that every client-supplied number is finite and positive before computing the total; reject invalid input before calling Mercado Pago.
- Do not copy Point-only headers such as `X-Allow-Cancelable-Status` into QR cancellation.
- `type_response.qr_data` exists only for `dynamic` and `hybrid`. In `static`, show the QR returned when the POS was created.
- The access token remains server-side. Never return it or embed it in client code.

## Canonical Node.js + Express server

```js
import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(express.json());

const accessToken = process.env.MP_ACCESS_TOKEN;
const externalPosId = process.env.MP_QR_EXTERNAL_POS_ID;
const qrMode = process.env.MP_QR_MODE || 'dynamic';
const staticQrImage = process.env.MP_QR_STATIC_IMAGE || '';
const allowedQrModes = new Set(['static', 'dynamic', 'hybrid']);

if (!accessToken) throw new Error('MP_ACCESS_TOKEN is required');
if (!externalPosId) throw new Error('MP_QR_EXTERNAL_POS_ID is required');
if (!allowedQrModes.has(qrMode)) throw new Error('MP_QR_MODE must be static, dynamic, or hybrid');
if (qrMode === 'static' && !staticQrImage) {
  throw new Error('MP_QR_STATIC_IMAGE is required for static QR display');
}

const mpHeaders = () => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

async function mpJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || 'Mercado Pago API error');
    error.status = response.status;
    error.detail = payload;
    throw error;
  }
  return payload;
}

app.post('/api/qr/orders', async (req, res) => {
  try {
    const numericAmount = Number(req.body.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const amount = numericAmount.toFixed(2);
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: { ...mpHeaders(), 'X-Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        type: 'qr',
        total_amount: amount,
        external_reference: `qr${randomUUID().replaceAll('-', '')}`,
        expiration_time: 'PT15M',
        config: { qr: { external_pos_id: externalPosId, mode: qrMode } },
        transactions: { payments: [{ amount }] },
      }),
    });
    const order = await mpJson(response);
    return res.status(201).json({
      orderId: order.id,
      status: order.status,
      mode: qrMode,
      qrData: order.type_response?.qr_data || null,
      staticQrImage: qrMode === 'static' || qrMode === 'hybrid' ? staticQrImage || null : null,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, detail: error.detail });
  }
});

app.get('/api/qr/orders/:orderId', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(req.params.orderId)}`,
      { headers: mpHeaders() },
    );
    return res.json(await mpJson(response));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, detail: error.detail });
  }
});

app.post('/api/qr/orders/:orderId/cancel', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(req.params.orderId)}/cancel`,
      { method: 'POST', headers: { ...mpHeaders(), 'X-Idempotency-Key': randomUUID() } },
    );
    return res.json(await mpJson(response));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, detail: error.detail });
  }
});
```

## Client integration

Reuse the application's real final-charge CTA. Preserve its text and style, mark it with
`data-mp-qr-cta="create-order"`, and ensure its single action calls `POST /api/qr/orders`.
Do not leave a competing redirect checkout or legacy QR handler attached.

The UI must:

1. Disable the CTA when the cart/amount is empty and while order creation is in progress.
2. Show the total before creation and an actionable error on failure.
3. For `dynamic` and `hybrid`, encode the returned `qrData` locally with the project's QR library. Never send it to a third-party QR-image service.
4. For `static`, render `staticQrImage`. For `hybrid`, the dynamic code is the primary display and the static code remains a valid alternative.
5. Show the order ID and poll `GET /api/qr/orders/:orderId` until a terminal status.
6. Explicitly render `created`, `processed`, `canceled`, `expired`, and `refunded`.
7. When the buyer cancels before payment, call `POST /api/qr/orders/:orderId/cancel` before closing the UI.

## Environment

```dotenv
MP_ACCESS_TOKEN=APP_USR-...
MP_QR_EXTERNAL_POS_ID=POS001
MP_QR_MODE=dynamic
# Required only to display static mode; use the QR image returned by POS creation.
MP_QR_STATIC_IMAGE=
PORT=3000
```

## Testing limits

- Automated without a phone: validate all three payload modes; create, retrieve, and cancel real test orders; assert QR data for `dynamic`/`hybrid`; assert the configured POS QR for `static`; and exercise the full UI with intercepted API responses.
- Requires a buyer phone logged into the Mercado Pago app: scan, approve, and therefore validate a real `processed` payment and refund.
- Do not invent an Orders `/events` simulator for QR. The virtual-terminal event simulator is Point-specific.

## Pre-production checklist

- [ ] Store and POS exist and belong to the same seller whose access token creates orders
- [ ] POS `external_id` exactly matches `MP_QR_EXTERNAL_POS_ID`
- [ ] Orders API contract passes `validate-qr-server.mjs`
- [ ] Real CTA and QR UI pass `validate-qr-client.mjs`
- [ ] Webhook uses the `orders` topic
- [ ] One buyer-app scan succeeds for each enabled mode
- [ ] `/mp-review` passes before production credentials are used
