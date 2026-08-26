#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, 'validate-bricks-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-bricks-tools-'));

const commonServer = `
  const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
  app.get('/api/mp-config', (req, res) => res.set('Cache-Control', 'no-store, max-age=0').json({ publicKey: MP_PUBLIC_KEY }));
  const port = process.env.PORT || 3000; app.listen(port);
`;
const commonClient = variant => `
  <main data-mp-bricks-page="${variant}"><p>Inicializando...</p><p>Procesando pago...</p><p>Pago aprobado con éxito</p><p>Error: intentá nuevamente</p></main>
  <script>fetch('/api/mp-config', { cache: 'no-store' });</script>
`;
const paymentServer = `
  ${commonServer}
  const amount = Number(cart.total); if (!Number.isFinite(amount)) throw new Error('invalid amount');
  fetch('https://api.mercadopago.com/v1/payments', { headers: { 'X-Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({
    transaction_amount: amount, token: form.token, installments: form.installments,
    payment_method_id: form.paymentMethodId, payer: { email: form.payer.email }, external_reference: order.id
  })});
  const result = { paymentId: payment.id };
`;

function runCase(name, variant, files, expectedStatus, expectedMessage = '') {
  const root = path.join(temporaryDirectory, name);
  fs.mkdirSync(root);
  for (const [filename, source] of Object.entries(files)) fs.writeFileSync(path.join(root, filename), source);
  const result = spawnSync(process.execPath, [validator, root, variant], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

try {
  runCase('valid-card-payment', 'card-payment', {
    'server.js': paymentServer,
    'checkout.html': `${commonClient('card-payment')}<p>Total a pagar: ARS {amount}</p><script>bricksBuilder.create('cardPayment', 'brick', { callbacks: { onSubmit: async (form) => { const response = await fetch('/api/bricks/payments'); return response.json(); } } });</script>`,
  }, 0);
  runCase('valid-payment', 'payment', {
    'server.js': paymentServer,
    'checkout.html': `${commonClient('payment')}<p>Total: ARS {total}</p><script>bricksBuilder.create('payment', 'brick', { callbacks: { onSubmit: async (form) => { return fetch('/api/bricks/payments'); } } });</script>`,
  }, 0);
  runCase('valid-sdk-idempotency', 'card-payment', {
    'server.js': paymentServer.replace("headers: { 'X-Idempotency-Key': crypto.randomUUID() }", "headers: {}, requestOptions: { idempotencyKey: crypto.randomUUID() }") ,
    'checkout.html': `${commonClient('card-payment')}<p>Total: ARS {amount}</p><script>bricksBuilder.create('cardPayment', 'brick', { callbacks: { onSubmit: async () => fetch('/api/bricks/payments') } });</script>`,
  }, 0);
  runCase('valid-wallet', 'wallet', {
    'server.js': `${commonServer} const trustedPurchase = derivePurchase(cart.id); fetch('https://api.mercadopago.com/checkout/preferences', { body: JSON.stringify({ items: trustedPurchase.items }) });`,
    'checkout.html': `${commonClient('wallet')}<script>const data = await fetch('/api/bricks/preference').then(r => r.json()); bricksBuilder.create('wallet', 'brick', { initialization: { preferenceId: data.preferenceId } });</script>`,
  }, 0);
  runCase('wallet-v1-path', 'wallet', {
    'server.js': `${commonServer} const trustedPurchase = derivePurchase(cart.id); fetch('https://api.mercadopago.com/v1/checkout/preferences', { body: JSON.stringify({ items: trustedPurchase.items }) });`,
    'checkout.html': `${commonClient('wallet')}<script>const data = await fetch('/api/bricks/preference').then(r => r.json()); bricksBuilder.create('wallet', 'brick', { initialization: { preferenceId: data.preferenceId } });</script>`,
  }, 1, 'must not contain v1');
  runCase('wallet-client-price', 'wallet', {
    'server.js': `${commonServer} const totalAmount = Number(unit_price); fetch('https://api.mercadopago.com/checkout/preferences', { body: JSON.stringify({ items: [{ unit_price: totalAmount }] }) });`,
    'checkout.html': `${commonClient('wallet')}<script>const data = await fetch('/api/bricks/preference').then(r => r.json()); bricksBuilder.create('wallet', 'brick', { initialization: { preferenceId: data.preferenceId } });</script>`,
  }, 1, 'trusted cart/order/session state');
  runCase('valid-status-screen', 'status-screen', {
    'server.js': commonServer,
    'status.html': `${commonClient('status-screen')}<script>const params = new URLSearchParams(location.search); const paymentId = params.get('payment_id'); if (!paymentId) showError('paymentId missing or invalid'); else bricksBuilder.create('statusScreen', 'brick', { initialization: { paymentId } });</script>`,
  }, 0);
  runCase('status-order-id', 'status-screen', {
    'server.js': commonServer,
    'status.html': `${commonClient('status-screen')}<script>const params = new URLSearchParams(location.search); const paymentId = params.get('payment_id'); if (!paymentId) showError('payment missing'); bricksBuilder.create('statusScreen', 'brick', { initialization: { orderId } });</script>`,
  }, 1, 'must not receive an orderId');
  runCase('hardcoded-server-port', 'status-screen', {
    'server.js': commonServer.replace('const port = process.env.PORT || 3000; app.listen(port);', 'const port = 3000; app.listen(port);'),
    'status.html': `${commonClient('status-screen')}<script>const params = new URLSearchParams(location.search); const paymentId = params.get('payment_id'); if (!paymentId) showError('paymentId missing or invalid'); else bricksBuilder.create('statusScreen', 'brick', { initialization: { paymentId } });</script>`,
  }, 1, 'must respect process.env.PORT');
  runCase('raw-card-fields', 'card-payment', {
    'server.js': paymentServer,
    'checkout.html': `${commonClient('card-payment')}<p>Total: ARS {amount}</p><input name="cardNumber"><script>bricksBuilder.create('cardPayment', 'brick', { callbacks: { onSubmit: async () => fetch('/pay') } });</script>`,
  }, 1, 'must not add raw card inputs');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
