#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'validate-wallet-connect-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-wallet-connect-tools-'));

const valid = `
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const platform = process.env.MP_WALLET_PLATFORM_ID;
const returnUri = process.env.MP_WALLET_RETURN_URI;
const encryptionKey = process.env.MP_WALLET_TOKEN_ENCRYPTION_KEY;
const agreementRepository = { save(){}, consume(){}, find(){}, update(){} };
const purchaseRepository = { get() { return { id: 'purchase-1', total: 10 }; } };
function encryptToken(value) { return sealCredential(value, encryptionKey); }
function decryptToken(value) { return openCredential(value, encryptionKey); }
app.post('/api/wallet-connect/agreements', async (req, res) => {
  const purchase = purchaseRepository.get(req.body.purchaseId);
  const response = await fetch('https://api.mercadopago.com/v2/wallet_connect/agreements', { method: 'POST', headers: { Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`, 'x-platform-id': platform }, body: JSON.stringify({ return_uri: returnUri, external_flow_id: purchase.id, external_user: authenticatedBuyer(req), agreement_data: trustedAgreementData(purchase) }) }).then(r => r.json());
  agreementRepository.save(req.session.id, response.agreement_id);
  res.json({ agreementUri: response.agreement_uri });
});
app.get('/wallet-connect/return', async (req, res) => {
  const pending = agreementRepository.consume(req.session.id, req.query.code);
  if (pending.agreementId !== req.query.agreement) throw new Error('agreement mismatch');
  const token = await fetch(\`https://api.mercadopago.com/v2/wallet_connect/agreements/\${pending.agreementId}/payer_token\`, { method: 'POST', headers: { Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`, 'x-platform-id': platform }, body: JSON.stringify({ code: req.query.code }) }).then(r => r.json());
  agreementRepository.update(req.session.userId, { encryptedPayerToken: encryptToken(token.payer_token) });
  res.redirect('/wallet-connect.html?connected=1');
});
app.post('/api/wallet-connect/orders', async (req, res) => {
  const purchase = purchaseRepository.get(req.body.purchaseId);
  const amount = Number(purchase.total).toFixed(2);
  const link = agreementRepository.find(req.session.userId);
  const payerToken = decryptToken(link.encryptedPayerToken);
  const order = await fetch('https://api.mercadopago.com/v1/orders', { method: 'POST', headers: { Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`, 'X-Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ type: 'online', capture_mode: 'automatic', total_amount: amount, external_reference: purchase.id, integration_data: { platform_id: platform }, transactions: { payments: [{ amount, payment_method: { type: 'wallet', id: 'wallet', token: payerToken }, stored_credential: { reason: 'recurring', payment_initiator: 'merchant' } }] } }) }).then(r => r.json());
  res.json({ orderId: order.id, status: order.status });
});
`;
const html = `<!doctype html><main data-mp-wallet-connect-page="account-linking"><p>Loading approval state</p><p>Connected wallet</p><p>Processing payment</p><p>Success approved</p><p>Error, tente novamente</p><button data-mp-wallet-connect-entry="checkout">Checkout</button><button data-mp-wallet-connect-cta="start">Autorizar Wallet Connect</button><button data-mp-wallet-connect-cta="pay">Pagar</button><script>fetch('/api/wallet-connect/status'); location.assign(data.agreementUri);</script></main>`;

function runCase(name, files, expectedStatus, expectedMessage = '') {
  const root = path.join(temporaryDirectory, name);
  fs.mkdirSync(root);
  for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(root, file), source);
  const result = spawnSync(process.execPath, [validator, root], { encoding: 'utf8' });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status !== expectedStatus || (expectedMessage && !output.includes(expectedMessage))) {
    throw new Error(`${name}: expected ${expectedStatus}/${expectedMessage}, got ${result.status}\n${output}`);
  }
  console.log(`PASS ${name}`);
}

try {
  runCase('valid', { 'server.js': valid, 'wallet-connect.html': html, '.env.example': 'MP_ACCESS_TOKEN=\nMP_WALLET_PLATFORM_ID=\nMP_WALLET_RETURN_URI=\nMP_WALLET_TOKEN_ENCRYPTION_KEY=\n' }, 0);
  runCase('advanced-payments', { 'server.js': valid.replace('https://api.mercadopago.com/v1/orders', 'https://api.mercadopago.com/v1/advanced_payments'), 'wallet.html': html }, 1, 'must use Orders API');
  runCase('browser-amount', { 'server.js': `${valid}\nconst unsafe = req.body.amount;`, 'wallet.html': html }, 1, 'browser must not choose');
  runCase('returns-token', { 'server.js': `${valid}\nres.json({ payerToken });`, 'wallet.html': html }, 1, 'must not return payer token');
  runCase('wallet-brick', { 'server.js': valid, 'wallet.html': `${html}<script>bricksBuilder.create('wallet', 'x', {});</script>` }, 1, 'must not load MercadoPago.js');
  runCase('missing-entry-cta', { 'server.js': valid, 'wallet.html': html.replace('data-mp-wallet-connect-entry="checkout"', '') }, 1, 'real checkout entry CTA');
  runCase('missing-encryption', { 'server.js': valid.replace('encryptToken(token.payer_token)', 'token.payer_token').replace('function encryptToken(value) { return sealCredential(value, encryptionKey); }', ''), 'wallet.html': html }, 1, 'encrypted at rest');
  runCase('memory-wallet-store', { 'server.js': `${valid}\nconst walletRepository = new Map();`, 'wallet.html': html }, 1, 'durable');
  runCase('browser-priced-bootstrap', { 'server.js': `${valid}\napp.post('/api/purchases', (req, res) => { const { items, payer } = req.body; const total = items.reduce((sum, item) => sum + item.unit_price, 0); res.json({ total, payer }); });`, 'wallet.html': html }, 1, 'purchase bootstrap may accept only');
  runCase('missing-external-user', { 'server.js': valid.replace('external_user: authenticatedBuyer(req), ', ''), 'wallet.html': html }, 1, 'external_user');
  runCase('unbound-agreement', { 'server.js': valid.replace("  if (pending.agreementId !== req.query.agreement) throw new Error('agreement mismatch');\n", ''), 'wallet.html': html }, 1, 'bind the returned agreement ID');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
