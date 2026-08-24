#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, 'validate-marketplace-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-marketplace-tools-'));

const commonServer = `
  const MP_APP_ID = process.env.MP_APP_ID;
  const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
  const MP_OAUTH_REDIRECT_URI = process.env.MP_OAUTH_REDIRECT_URI;
  const MP_TOKEN_ENCRYPTION_KEY = process.env.MP_TOKEN_ENCRYPTION_KEY;
  const oauthState = randomBytes(32).toString('hex');
  await oauthStateStore.save({ state: oauthState, sessionId: req.session.id, expiresAt: Date.now() + 600000 });
  const authorizationUrl = new URL('https://auth.mercadopago.com.ar/authorization');
  authorizationUrl.searchParams.set('client_id', MP_APP_ID);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('platform_id', 'mp');
  authorizationUrl.searchParams.set('redirect_uri', MP_OAUTH_REDIRECT_URI);
  authorizationUrl.searchParams.set('state', oauthState);
  app.get('/oauth/mercadopago/callback', async (req, res) => {
    if (req.query.error) return showError(req.query.error);
    const code = req.query.code; const state = req.query.state;
    const stateRecord = await oauthStateStore.consume(state, req.session.id);
    await oauthStateStore.delete(state);
    if (!stateRecord || !code) return showError('invalid OAuth callback');
    const tokenBody = new URLSearchParams({ grant_type: 'authorization_code', client_id: MP_APP_ID, client_secret: MP_CLIENT_SECRET, code, redirect_uri: MP_OAUTH_REDIRECT_URI });
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody });
    const tokens = await tokenResponse.json();
    await sellerRepository.upsert({ userId: tokens.user_id, accessToken: encryptToken(tokens.access_token, MP_TOKEN_ENCRYPTION_KEY), refreshToken: encryptToken(tokens.refresh_token, MP_TOKEN_ENCRYPTION_KEY), expiresAt: Date.now() + tokens.expires_in * 1000 });
  });
  async function refreshSellerConnection(connection) {
    const refreshBody = new URLSearchParams({ grant_type: 'refresh_token', client_id: MP_APP_ID, client_secret: MP_CLIENT_SECRET, refresh_token: decryptToken(connection.refreshToken) });
    const response = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: refreshBody });
    const tokens = await response.json();
    return sellerRepository.update(connection.userId, { accessToken: encryptToken(tokens.access_token), refreshToken: encryptToken(tokens.refresh_token), expiresAt: Date.now() + tokens.expires_in * 1000 });
  }
  const purchase = await purchaseRepository.get(req.session.purchaseId);
  const amount = Number(purchase.total); const commission = Number(purchase.marketplaceCommission);
  if (!Number.isFinite(amount) || !Number.isFinite(commission) || commission < 0 || commission >= amount) throw new Error('invalid commission');
  const sellerConnection = await sellerRepository.get(purchase.sellerConnectionId);
  const sellerAccessToken = decryptToken(sellerConnection.accessToken);
  const splitHeaders = { Authorization: \`Bearer \${sellerConnection.accessToken}\`, 'Content-Type': 'application/json' };
`;

const commonUi = contract => `
  <main data-mp-marketplace-page="${contract}">
    <a data-mp-marketplace-connect="oauth" href="/oauth/mercadopago/connect">Conectar Mercado Pago</a>
    <p>Cargando conexión...</p><p>Vendedor conectado con éxito</p><p>Error: intentá nuevamente</p>
  </main>
  <section data-mp-marketplace-checkout="${contract}"><p>Procesando pago...</p></section>
`;

function runCase(name, contract, files, expectedStatus, expectedMessage = '') {
  const root = path.join(temporaryDirectory, name);
  fs.mkdirSync(root);
  for (const [filename, source] of Object.entries(files)) fs.writeFileSync(path.join(root, filename), source);
  const result = spawnSync(process.execPath, [validator, root, contract], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

const proServer = `${commonServer}
  const preference = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: splitHeaders, body: JSON.stringify({ items: purchase.items, marketplace_fee: commission, external_reference: purchase.id }) }).then(r => r.json());
  const result = { preferenceId: preference.id, initPoint: preference.init_point };
`;
const apiServer = `${commonServer}
  const payment = await fetch('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { ...splitHeaders, 'X-Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ transaction_amount: amount, application_fee: commission, token: secureForm.token, installments: secureForm.installments, payment_method_id: secureForm.paymentMethodId, payer: { email: secureForm.email }, external_reference: purchase.id }) });
  app.get('/api/mp-config', (req, res) => res.json({ publicKey: process.env.MP_PUBLIC_KEY }));
`;
const walletServer = `${commonServer}
  const preference = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: splitHeaders, body: JSON.stringify({ items: purchase.items, marketplace_fee: commission, external_reference: purchase.id }) }).then(r => r.json());
  const result = { preferenceId: preference.id };
  app.get('/api/mp-config', (req, res) => res.json({ publicKey: process.env.MP_PUBLIC_KEY }));
`;

try {
  runCase('valid-checkout-pro', 'checkout-pro', {
    'server.js': proServer,
    'marketplace.html': `${commonUi('checkout-pro')}<script>async function checkout(){ showStatus('processing'); const result = await fetch('/api/marketplace/preference').then(r => r.json()); location.assign(result.initPoint); }</script>`,
  }, 0);
  runCase('valid-checkout-api', 'checkout-api', {
    'server.js': apiServer,
    'marketplace.html': `${commonUi('checkout-api')}<form id="card"><select hidden data-mp-sdk-required-field="issuer"></select><select hidden data-mp-sdk-required-field="installments"></select><select hidden data-mp-sdk-required-field="identificationType"></select></form><script>fetch('/api/mp-config'); mp.cardForm({ form: { id: 'card' } });</script>`,
  }, 0);
  runCase('valid-bricks-wallet', 'bricks-wallet', {
    'server.js': walletServer,
    'marketplace.html': `${commonUi('bricks-wallet')}<script>const data = await fetch('/api/marketplace/preference').then(r => r.json()); bricksBuilder.create('wallet', 'wallet', { initialization: { preferenceId: data.preferenceId, marketplace: true } });</script>`,
  }, 0);
  runCase('orders-forced', 'checkout-api', {
    'server.js': apiServer.replace('https://api.mercadopago.com/v1/payments', 'https://api.mercadopago.com/v1/orders'),
    'marketplace.html': `${commonUi('checkout-api')}<script>fetch('/api/mp-config'); mp.cardForm({});</script>`,
  }, 1, 'standalone Orders API');
  runCase('browser-selects-seller', 'checkout-pro', {
    'server.js': `${proServer}\nconst selectedSeller = req.body.seller_id;`,
    'marketplace.html': commonUi('checkout-pro'),
  }, 1, 'browser must not choose seller');
  runCase('static-oauth-state', 'checkout-pro', {
    'server.js': `${proServer}\nconst state = 'fixed-oauth-state';`,
    'marketplace.html': commonUi('checkout-pro'),
  }, 1, 'static constant');
  runCase('memory-oauth-state', 'checkout-pro', {
    'server.js': `${proServer}\nconst oauthStates = new Map();`,
    'marketplace.html': commonUi('checkout-pro'),
  }, 1, 'durable shared storage');
  runCase('raw-token-input', 'checkout-api', {
    'server.js': apiServer,
    'marketplace.html': `${commonUi('checkout-api')}<input name="card_token"><script>fetch('/api/mp-config'); mp.cardForm({});</script>`,
  }, 1, 'manual token inputs');
  runCase('seller-public-key', 'checkout-api', {
    'server.js': apiServer.replace('publicKey: process.env.MP_PUBLIC_KEY', 'publicKey: sellerConnection.publicKey || process.env.MP_PUBLIC_KEY'),
    'marketplace.html': `${commonUi('checkout-api')}<form id="card"><select hidden data-mp-sdk-required-field="issuer"></select><select hidden data-mp-sdk-required-field="installments"></select><select hidden data-mp-sdk-required-field="identificationType"></select></form><script>fetch('/api/mp-config'); mp.cardForm({ form: { id: 'card' } });</script>`,
  }, 1, 'integrator MP_PUBLIC_KEY');
  runCase('wrong-pro-fee', 'checkout-pro', {
    'server.js': proServer.replace('marketplace_fee: commission', 'application_fee: commission'),
    'marketplace.html': commonUi('checkout-pro'),
  }, 1, 'marketplace_fee');
  runCase('wallet-v1-preference', 'bricks-wallet', {
    'server.js': walletServer.replace('/checkout/preferences', '/v1/checkout/preferences'),
    'marketplace.html': `${commonUi('bricks-wallet')}<script>bricksBuilder.create('wallet', 'wallet', { initialization: { preferenceId: data.preferenceId, marketplace: true } });</script>`,
  }, 1, 'must not contain v1');
  runCase('wallet-marketplace-outside-initialization', 'bricks-wallet', {
    'server.js': walletServer,
    'marketplace.html': `${commonUi('bricks-wallet')}<script>bricksBuilder.create('wallet', 'wallet', { initialization: { preferenceId: data.preferenceId }, marketplace: true });</script>`,
  }, 1, 'inside initialization');
  runCase('browser-priced-purchase', 'bricks-wallet', {
    'server.js': walletServer,
    'marketplace.html': `${commonUi('bricks-wallet')}<script>fetch('/api/marketplace/purchases', { body: JSON.stringify({ items: [{ productId: 1, quantity: 1, unitPrice: 100 }] }) }); bricksBuilder.create('wallet', 'wallet', { initialization: { preferenceId: data.preferenceId, marketplace: true } });</script>`,
  }, 1, 'never prices/totals/fees');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
