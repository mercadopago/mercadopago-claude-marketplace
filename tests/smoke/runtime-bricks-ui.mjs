#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, variant, destinationValue, artifactDirectory] = process.argv.slice(2);
const variants = new Set(['card-payment', 'payment', 'wallet', 'status-screen']);
if (!baseUrlValue || !variants.has(variant) || !destinationValue || !artifactDirectory) {
  console.error('Usage: node runtime-bricks-ui.mjs <base-url> <variant> <destination> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const destination = new URL(destinationValue, baseUrl);
if (variant === 'status-screen') destination.searchParams.set('payment_id', '123456789');
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const sdkStub = `
  (() => {
    const render = async (type, containerId, settings) => {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Brick mount container missing: ' + containerId);
      window.__mpBrickSmoke = { type, containerId, settings, unmounted: false };
      container.dataset.smokeBrick = type;
      const label = document.createElement('p');
      label.textContent = 'Mercado Pago ' + type + ' Brick ready';
      container.appendChild(label);
      const callbacks = settings.callbacks || settings;
      if (callbacks.onReady) callbacks.onReady();
      if (type === 'cardPayment' || type === 'payment') {
        const button = document.createElement('button');
        button.id = 'mp-smoke-submit';
        button.type = 'button';
        button.textContent = 'Enviar pago de prueba';
        button.addEventListener('click', async () => {
          try {
            await callbacks.onSubmit({
              token: 'single-use-smoke-token',
              transaction_amount: 10,
              installments: 1,
              payment_method_id: 'master',
              paymentMethodId: 'master',
              issuer_id: '3',
              issuerId: '3',
              paymentType: 'credit_card',
              payer: { email: 'buyer@example.com' },
            });
          } catch (error) {
            if (callbacks.onError) callbacks.onError(error);
          }
        });
        container.appendChild(button);
      }
      return { unmount: () => { window.__mpBrickSmoke.unmounted = true; container.replaceChildren(); } };
    };
    window.MercadoPago = function MercadoPago(publicKey) {
      window.__mpPublicKeySeen = publicKey;
      return { bricks: () => ({ create: render }) };
    };
  })();
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: 'es-AR' });
const errors = [];
let configCalls = 0;
let paymentCalls = 0;
let preferenceCalls = 0;

await page.addInitScript(() => {
  const purchase = JSON.stringify({
    purchaseId: 'SMOKE-PURCHASE', service_title: 'Smoke service', seller: 'Smoke seller',
    package_name: 'Basic', unit_price: 10, marketplace_fee: 0,
    payer_email: 'buyer@example.com',
  });
  sessionStorage.setItem('kreativa_purchase', purchase);
  sessionStorage.setItem('mp_purchase', purchase);
  sessionStorage.setItem('checkout_purchase', purchase);
});

page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.route('https://sdk.mercadopago.com/js/v2**', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: sdkStub,
}));
await page.route('**/api/mp-config', route => {
  configCalls += 1;
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify({ publicKey: 'TEST-smoke-public-key' }),
  });
});
await page.route('**/api/bricks/payments', route => {
  paymentCalls += 1;
  if (route.request().method() !== 'POST') return route.fulfill({ status: 405 });
  return route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ paymentId: 123456789, id: 123456789, status: 'approved' }),
  });
});
await page.route('**/api/bricks/preference', route => {
  preferenceCalls += 1;
  if (route.request().method() !== 'POST') return route.fulfill({ status: 405 });
  return route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ preferenceId: 'PREF-SMOKE-123' }),
  });
});
await page.route('**/api/purchases/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  headers: { 'Cache-Control': 'no-store' },
  body: JSON.stringify({
    purchaseId: 'SMOKE-PURCHASE', serviceTitle: 'Smoke service', packageName: 'Basic',
    total: 10, currency: 'ARS', payerEmail: 'buyer@example.com',
  }),
}));

try {
  await page.goto(destination.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator(`[data-mp-bricks-page="${variant}"]`).waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.__mpBrickSmoke), null, { timeout: 15_000 });

  const mounted = await page.evaluate(() => ({
    type: window.__mpBrickSmoke.type,
    initialization: window.__mpBrickSmoke.settings.initialization,
    publicKey: window.__mpPublicKeySeen,
  }));
  const expectedType = { 'card-payment': 'cardPayment', payment: 'payment', wallet: 'wallet', 'status-screen': 'statusScreen' }[variant];
  if (mounted.type !== expectedType) throw new Error(`Expected ${expectedType} Brick, got ${mounted.type}`);
  if (!mounted.publicKey) throw new Error('Brick initialized without runtime public key');
  if (configCalls !== 1) throw new Error(`Expected one runtime config request, got ${configCalls}`);

  if (variant === 'card-payment' || variant === 'payment') {
    await page.locator('#mp-smoke-submit').click();
    await page.waitForFunction(() => /123456789|aprobad|aprovad|success|sucesso|exitos/i.test(document.body.innerText), null, { timeout: 10_000 });
    if (paymentCalls !== 1) throw new Error(`Expected one payment request, got ${paymentCalls}`);
  }
  if (variant === 'wallet') {
    if (preferenceCalls !== 1) throw new Error(`Expected one preference request, got ${preferenceCalls}`);
    if (mounted.initialization?.preferenceId !== 'PREF-SMOKE-123') {
      throw new Error(`Wallet mounted with wrong preferenceId: ${mounted.initialization?.preferenceId || '<missing>'}`);
    }
  }
  if (variant === 'status-screen' && String(mounted.initialization?.paymentId) !== '123456789') {
    throw new Error(`Status Screen mounted with wrong paymentId: ${mounted.initialization?.paymentId || '<missing>'}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const result = { status: 'passed', variant, mounted, configCalls, paymentCalls, preferenceCalls };
  await page.screenshot({ path: path.join(artifacts, `bricks-${variant}-ui.png`), fullPage: true });
  fs.writeFileSync(path.join(artifacts, `bricks-${variant}-ui.json`), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`PASS Bricks ${variant} UI runtime`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, `bricks-${variant}-ui-failure.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
