#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDirectory, '..');
const serverValidator = path.join(scriptDirectory, 'validate-qr-server.mjs');
const clientValidator = path.join(scriptDirectory, 'validate-qr-client.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-qr-tools-'));

function validate(name, source, expectedStatus, expectedMessage = '', validator = serverValidator) {
  const file = path.join(temporaryDirectory, `${name}.mjs`);
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, [validator, file], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing expected diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

const validServer = `
  import { randomUUID } from 'node:crypto';
  const externalPosId = process.env.MP_QR_EXTERNAL_POS_ID;
  const qrMode = process.env.MP_QR_MODE || 'dynamic';
  const allowedModes = new Set(['static', 'dynamic', 'hybrid']);
  if (!allowedModes.has(qrMode)) throw new Error('invalid mode');
  const numericAmount = Number(input);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('invalid amount');
  const amount = numericAmount.toFixed(2);
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      type: 'qr', total_amount: amount, external_reference: randomUUID(),
      config: { qr: { external_pos_id: externalPosId, mode: qrMode } },
      transactions: { payments: [{ amount }] }
    })
  });
  const order = await response.json();
  const qrData = order.type_response?.qr_data;
  fetch(\`https://api.mercadopago.com/v1/orders/\${orderId}\`);
  fetch(\`https://api.mercadopago.com/v1/orders/\${orderId}/cancel\`, {
    method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() }
  });
`;

const validClient = `
  <button data-mp-qr-cta="create-order">Cobrar</button>
  <script>
    fetch('/api/qr/orders', { method: 'POST' });
    fetch('/api/qr/orders/' + orderId);
    fetch('/api/qr/orders/' + orderId + '/cancel', { method: 'POST' });
    const qrData = payload.qrData;
    const staticQrImage = payload.staticQrImage;
    new QRCode(container, { text: qrData });
    const statuses = ['created', 'processed', 'canceled', 'expired', 'refunded'];
  </script>
`;

try {
  validate('valid-qr-orders', validServer, 0);
  validate('legacy-instore-qr', validServer.replace(
    'https://api.mercadopago.com/v1/orders',
    'https://api.mercadopago.com/instore/orders/qr/seller/collectors/1/pos/001/qrs',
  ), 1, 'legacy Instore Orders QR endpoint');
  validate('redirect-order-as-qr', validServer
    .replace("type: 'qr'", "type: 'online'")
    .replace('transactions: { payments: [{ amount }] }', "transactions: { payments: [{ amount, payment_method: { type: 'redirect' } }] }"),
  1, 'QR order must not use type online');
  validate('missing-qr-mode', validServer.replace('mode: qrMode', 'other: qrMode'), 1, 'must send config.qr.mode');
  validate('missing-pos', validServer.replace('external_pos_id: externalPosId', 'terminal_id: externalPosId'), 1, 'must send config.qr.external_pos_id');
  validate('missing-cancel', validServer.replace('/cancel', '/void'), 1, 'must implement order cancellation');
  validate('unvalidated-amount', validServer.replace(
    "if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('invalid amount');",
    '',
  ), 1, 'must reject non-finite');
  validate('unsupported-item-currency', validServer.replace(
    "transactions: { payments: [{ amount }] }",
    "transactions: { payments: [{ amount }] }, items: [{ title: 'Test', unit_price: amount, quantity: 1, currency_id: 'ARS' }]",
  ), 1, 'items[].currency_id is not supported');
  validate('invented-payer', validServer.replace(
    "transactions: { payments: [{ amount }] }",
    "transactions: { payments: [{ amount }] }, payer: { email: 'buyer@example.com' }",
  ), 1, 'must not invent or preserve a payer');
  validate('point-cancel-header-in-qr', validServer.replace(
    "method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() }",
    "method: 'POST', headers: { 'X-Idempotency-Key': randomUUID(), 'X-Allow-Cancelable-Status': 'created' }",
  ), 1, 'Point-specific', serverValidator);
  validate('valid-qr-client', validClient, 0, '', clientValidator);
  validate('external-qr-service', validClient.replace(
    'new QRCode(container, { text: qrData });',
    "image.src = 'https://api.qrserver.com/v1/create-qr-code/?data=' + qrData;",
  ), 1, 'external QR-image service', clientValidator);
  validate('missing-refunded-ui', validClient.replace("'refunded'", "'paid_back'"), 1, 'refunded QR status', clientValidator);

  const qrGuide = path.join(pluginRoot, 'skills/mp-integrate/references/guides/qr.md');
  const guide = fs.readFileSync(qrGuide, 'utf8');
  const guideServer = guide.match(/## Canonical Node\.js \+ Express server[\s\S]*?```js\n([\s\S]*?)```/)?.[1];
  if (!guideServer) throw new Error('canonical-qr-guide: server block not found');
  validate('canonical-qr-guide', guideServer, 0);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
