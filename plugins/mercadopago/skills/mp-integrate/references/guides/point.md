# Guide: MP Point (Orders API)
# Updated: 2026-08-20 | Source: official Mercado Pago Point documentation
#
# TRAPS TO AVOID FIRST:
#   New integrations use Orders API. Payment Intents is deprecated.
#   Production uses a physical terminal paired to the correct user in PDV mode.
#   Tests without hardware use the standard virtual terminal serial SBX0000001.

---

## Hardware-independent test mode

The official Point test flow supports the standard virtual terminal
`NEWLAND_N950__SBX0000001`. It can create Point orders and simulate their final
status without a physical reader.

The virtual terminal is for test credentials only and is not valid for the
official integration-quality measurement. Never silently use it in production.
Resolve the terminal with an explicit test guard:

```js
const VIRTUAL_POINT_TERMINAL = 'NEWLAND_N950__SBX0000001';
const pointTestMode = process.env.MP_POINT_TEST_MODE === 'true';
const pointTerminalId = process.env.MP_POINT_TERMINAL_ID?.trim()
  || (pointTestMode ? VIRTUAL_POINT_TERMINAL : '');

if (!pointTerminalId) {
  throw new Error('MP_POINT_TERMINAL_ID is required outside Point test mode');
}
```

---

## Complete working server (Node.js + Express)

### Install

```bash
npm install express dotenv
```

### server.js

```js
import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(express.json());

const token = process.env.MP_ACCESS_TOKEN?.trim();
const VIRTUAL_POINT_TERMINAL = 'NEWLAND_N950__SBX0000001';
const pointTestMode = process.env.MP_POINT_TEST_MODE === 'true';
const pointTerminalId = process.env.MP_POINT_TERMINAL_ID?.trim()
  || (pointTestMode ? VIRTUAL_POINT_TERMINAL : '');

if (!token) throw new Error('MP_ACCESS_TOKEN is required');
if (!pointTerminalId) {
  throw new Error('MP_POINT_TERMINAL_ID is required outside Point test mode');
}

function pointHeaders(withIdempotency = false) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(withIdempotency ? { 'X-Idempotency-Key': randomUUID() } : {}),
  };
}

app.post('/api/point/orders', async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const amountString = amount.toFixed(2);
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: pointHeaders(true),
    body: JSON.stringify({
      type: 'point',
      external_reference: `point-${randomUUID()}`,
      expiration_time: 'PT10M',
      transactions: {
        payments: [{ amount: amountString }],
      },
      config: {
        point: {
          terminal_id: pointTerminalId,
          print_on_terminal: 'no_ticket',
        },
      },
      description: 'Point order',
    }),
  });

  const order = await response.json().catch(() => ({}));
  if (!response.ok) {
    return res.status(response.status).json({
      error: order.message || 'Could not create Point order',
      detail: order,
    });
  }

  return res.status(201).json({
    orderId: order.id,
    paymentId: order.transactions?.payments?.[0]?.id,
    status: order.status,
  });
});

app.get('/api/point/orders/:orderId', async (req, res) => {
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(req.params.orderId)}`,
    { headers: pointHeaders() },
  );
  const order = await response.json().catch(() => ({}));
  return res.status(response.status).json(order);
});

app.listen(Number(process.env.PORT || 3000));
```

### `.env.example`

```dotenv
MP_ACCESS_TOKEN=APP_USR-...
MP_POINT_TEST_MODE=true
# Required in production. Optional only when MP_POINT_TEST_MODE=true.
MP_POINT_TERMINAL_ID=
PORT=3000
```

---

## Test the integration without a device

Use app test credentials and create a fresh order for every scenario. After
creation, simulate its status with:

```text
POST /v1/orders/{order_id}/events
```

Supported official scenarios include:

- `processed` with payment metadata and `status_detail: accredited`;
- `failed`, including decline details such as `insufficient_amount`;
- `refunded`;
- `canceled`;
- `expired`;
- `action_required`.

`refunded` is the only scenario that must reuse an order already in
`processed`; do not apply it directly to a newly created order.

The client must handle every status explicitly. Treat `processed`, `failed`,
`refunded`, `canceled`, and `expired` as terminal outcomes. When
`action_required` is returned, show an actionable "check the terminal" state
instead of leaving a generic spinner or eventually reporting a timeout. Keep
`created` and `at_terminal` as pending states. Never report `failed` as a
timeout.

Most transitions take up to 10 seconds. `action_required` can take up to 40
seconds. Except for `refunded`, the order normally passes through `at_terminal`
before reaching the simulated final state.

The simulation endpoint is a test operation. Do not expose a public application
route that lets arbitrary clients choose an order's simulated status. Test code
may call Mercado Pago directly with credentials injected only into the test
process.

---

## Critical rules

- Use `type: "point"`, not `instore` or `online`.
- Send the reader as `config.point.terminal_id`, not `config.device.id`.
- Format every payment amount with exactly two decimal places.
- Keep the baseline payload minimal. Do not send
  `config.payment_method.default_installments`: it is rejected for Point orders
  in markets where installments are not configurable through that property.
- Send `X-Idempotency-Key` on create, cancel, and refund operations.
- A real terminal must be paired to the correct `user_id` and use PDV mode.
- Use the `orders` webhook topic; `point_integration_wh` is legacy.
- Do not use `/point/integration-api/.../payment-intents` in new code.
- The virtual terminal does not replace final hardware or quality validation.

---

## Pre-production checklist

- [ ] Orders API used; no Payment Intents endpoint remains
- [ ] Physical terminal ID configured through `MP_POINT_TERMINAL_ID`
- [ ] Test-mode virtual fallback cannot activate in production
- [ ] Physical device paired to the correct `user_id` in PDV mode
- [ ] `orders` webhook configured and HMAC validated
- [ ] Idempotency keys present on every mutating request
- [ ] Client handles `processed`, `failed`, `refunded`, `canceled`, `expired`, and `action_required`
- [ ] Final card/PIN/printing/connectivity checks executed on hardware
- [ ] `/mp-review` completed before production
