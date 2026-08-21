#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, contract, connectDestinationValue, checkoutDestinationValue, artifactDirectory] = process.argv.slice(2);
const contracts = new Set(['checkout-pro', 'checkout-api', 'bricks-wallet']);
if (!baseUrlValue || !contracts.has(contract) || !connectDestinationValue || !checkoutDestinationValue || !artifactDirectory) {
  console.error('Usage: node runtime-marketplace-ui.mjs <base-url> <contract> <connect-destination> <checkout-destination> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const connectDestination = new URL(connectDestinationValue, baseUrl);
const checkoutDestination = new URL(checkoutDestinationValue, baseUrl);
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const sdkStub = `
(() => {
  window.MercadoPago = function MercadoPago(publicKey) {
    window.__mpPublicKeySeen = publicKey;
    return {
      cardForm(config) {
        for (const field of ['cardNumber', 'expirationDate', 'securityCode']) {
          const target = document.getElementById(config.form[field].id);
          if (!target) throw new Error('Missing secure host: ' + field);
          const iframe = document.createElement('iframe');
          iframe.title = field;
          iframe.srcdoc = '<!doctype html><input aria-label="' + field + '">';
          iframe.style.cssText = 'display:block;width:100%;height:40px;border:0';
          target.appendChild(iframe);
        }
        const controller = { getCardFormData(){ return { token:'marketplace-single-use-token', installments:1, paymentMethodId:'master', cardholderEmail:'buyer@example.com' }; }, unmount(){} };
        document.getElementById(config.form.id)?.addEventListener('submit', event => { event.preventDefault(); Promise.resolve(config.callbacks?.onSubmit?.(event)).catch(error => config.callbacks?.onError?.(error)); });
        queueMicrotask(() => config.callbacks?.onFormMounted?.(null));
        window.__mpMarketplaceCardForm = { config, controller };
        return controller;
      },
      bricks() {
        return { create(name, container, settings) { window.__mpMarketplaceBrick = { name, container, settings }; settings.callbacks?.onReady?.(); return Promise.resolve({ unmount(){} }); } };
      }
    };
  };
})();
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: 'es-AR' });
const errors = [];
const requests = [];
const purchaseRequests = [];
let authorizationUrl = null;
let configCalls = 0;

page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

await page.route('https://sdk.mercadopago.com/js/v2**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: sdkStub }));
await page.route('**/api/mp-config', route => {
  configCalls += 1;
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store, max-age=0' }, body: JSON.stringify({ publicKey: 'TEST-marketplace-public-key' }) });
});
await page.route('**/api/marketplace/preference', async route => {
  let body = {};
  try { body = route.request().postDataJSON(); } catch {}
  requests.push({ endpoint: 'preference', body });
  return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ preferenceId: 'PREF-SMOKE-123', initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-SMOKE-123', total: 100 }) });
});
await page.route('**/api/marketplace/purchases', async route => {
  let body = {};
  try { body = route.request().postDataJSON(); } catch {}
  purchaseRequests.push(body);
  return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ purchaseId: 'purchase-smoke', total: 100, totalAmount: 100, currency: 'ARS' }) });
});
await page.route('**/api/marketplace/payment', async route => {
  let body = {};
  try { body = route.request().postDataJSON(); } catch {}
  requests.push({ endpoint: 'payment', body });
  return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ paymentId: 'PAY-SMOKE-123', status: 'approved' }) });
});
await page.route('https://www.mercadopago.com.ar/checkout/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><h1>Marketplace checkout redirect smoke</h1>' }));

try {
  await page.goto(connectDestination.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator(`[data-mp-marketplace-page="${contract}"]`).waitFor({ state: 'attached', timeout: 15_000 });
  const connectCta = page.locator('[data-mp-marketplace-connect="oauth"]');
  if (await connectCta.count() !== 1) throw new Error(`Expected one seller OAuth CTA, got ${await connectCta.count()}`);
  const connectHref = (await connectCta.getAttribute('href')) || await page.evaluate(() => {
    const scripts = [...document.scripts].map(script => script.textContent || '').join('\n');
    return scripts.match(/["'](\/oauth\/[A-Za-z0-9_./-]*(?:connect|start))["']/)?.[1] || '/oauth/mercadopago/connect';
  });
  const connectResponse = await fetch(new URL(connectHref, baseUrl), { redirect: 'manual' });
  const authorizationLocation = connectResponse.headers.get('location');
  if (![301, 302, 303, 307, 308].includes(connectResponse.status) || !authorizationLocation) {
    throw new Error(`Seller OAuth endpoint did not redirect; HTTP ${connectResponse.status}`);
  }
  authorizationUrl = new URL(authorizationLocation, baseUrl);
  if (!/^auth\.mercadopago\./.test(authorizationUrl.hostname) || authorizationUrl.pathname !== '/authorization') {
    throw new Error(`Unexpected OAuth authorization destination: ${authorizationUrl.origin}${authorizationUrl.pathname}`);
  }
  for (const parameter of ['client_id', 'response_type', 'platform_id', 'redirect_uri', 'state']) {
    if (!authorizationUrl.searchParams.get(parameter)) throw new Error(`OAuth authorization URL missing ${parameter}`);
  }
  if (authorizationUrl.searchParams.get('response_type') !== 'code') throw new Error('OAuth response_type is not code');
  if (authorizationUrl.searchParams.get('platform_id') !== 'mp') throw new Error('OAuth platform_id is not mp');
  if (authorizationUrl.searchParams.get('state').length < 24) throw new Error('OAuth state is unexpectedly short');

  if (contract === 'checkout-api' || contract === 'bricks-wallet') {
    checkoutDestination.searchParams.set('purchaseId', 'purchase-smoke');
    checkoutDestination.searchParams.set('total', '100');
  }
  if (contract === 'checkout-api') {
    await page.evaluate(() => localStorage.setItem('mp_marketplace_cart', JSON.stringify([{ productId: 1, quantity: 1 }])));
  }
  await page.goto(checkoutDestination.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator(`[data-mp-marketplace-checkout="${contract}"]`).waitFor({ state: 'attached', timeout: 15_000 });

  if (contract === 'checkout-api') {
    await page.waitForFunction(() => Boolean(window.__mpMarketplaceCardForm), null, { timeout: 15_000 });
    const frames = page.locator('[data-mp-secure-field] iframe');
    if (await frames.count() !== 3) throw new Error(`Expected 3 secure card iframe hosts, got ${await frames.count()}`);
    for (const frame of page.frames().filter(item => item !== page.mainFrame())) {
      const input = frame.locator('input');
      if (await input.count()) { await input.fill('1'); if (await input.inputValue() !== '1') throw new Error('Secure field is not editable'); }
    }
    const emailInput = page.locator('#form-cardholderEmail, #form-checkout__email').first();
    if (await emailInput.count()) await emailInput.fill('buyer@example.com');
    const nameInput = page.locator('#form-cardholderName, #form-checkout__cardholderName').first();
    if (await nameInput.count()) await nameInput.fill('APRO');
    const identificationInput = page.locator('#form-identificationNumber, #form-checkout__identificationNumber').first();
    if (await identificationInput.count()) await identificationInput.evaluate(element => { element.value = '12345678'; });
  }
  if (contract === 'bricks-wallet') {
    await page.waitForFunction(() => Boolean(window.__mpMarketplaceBrick), null, { timeout: 15_000 });
    const settings = await page.evaluate(() => window.__mpMarketplaceBrick);
    if (settings.name !== 'wallet') throw new Error(`Expected Wallet Brick, got ${settings.name}`);
    if (settings.settings?.initialization?.marketplace !== true) throw new Error('Wallet Brick missing marketplace: true');
    if (settings.settings?.initialization?.preferenceId !== 'PREF-SMOKE-123') throw new Error('Wallet Brick missing dynamic preferenceId');
  } else {
    const checkoutCta = page.locator(`[data-mp-marketplace-cta="${contract}"]`);
    if (await checkoutCta.count() !== 1) throw new Error(`Expected one final buyer CTA, got ${await checkoutCta.count()}`);
    if (contract === 'checkout-pro') {
      for (const [selector, value] of [['#field-nombre', 'Smoke'], ['#field-email', 'buyer@example.com'], ['#field-calle', 'Calle 123']]) {
        const input = page.locator(selector);
        if (await input.count()) await input.evaluate((element, nextValue) => {
          element.value = nextValue;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
      }
      await page.evaluate(() => {
        if (typeof cart !== 'undefined' && typeof PRODUCTS !== 'undefined' && cart.length === 0 && PRODUCTS.length) {
          cart.push({ p: PRODUCTS[0], qty: 1 });
        }
      });
    }
    if (await checkoutCta.isVisible()) await checkoutCta.click();
    else await checkoutCta.evaluate(element => element.click());
  }

  if (contract !== 'bricks-wallet') {
    await page.waitForFunction(() => /PAY-SMOKE-123|approved|aprobado|Marketplace checkout redirect smoke/i.test(document.body.innerText) || location.hostname === 'www.mercadopago.com.ar', null, { timeout: 15_000 });
  }
  if (requests.length !== 1) throw new Error(`Expected exactly one buyer creation request, got ${requests.length}`);
  for (const purchaseBody of purchaseRequests) {
    if (/(seller_id|sellerId|collector_id|collectorId|access_token|sellerToken|application_fee|marketplace_fee|amount|total|unit_price|unitPrice|\bprice\b)/.test(JSON.stringify(purchaseBody))) {
      throw new Error(`Browser sent trusted purchase fields: ${JSON.stringify(purchaseBody)}`);
    }
  }
  const body = JSON.stringify(requests[0].body);
  if (/(seller_id|sellerId|collector_id|collectorId|access_token|sellerToken|application_fee|marketplace_fee|amount|total|unit_price)/.test(body)) {
    throw new Error(`Browser sent trusted marketplace fields: ${body}`);
  }
  if (contract === 'checkout-api' && !/(token|cardToken|card_token)/.test(body)) throw new Error('Checkout API did not send the secure token to its own backend');
  if (/(cardNumber|securityCode|expirationDate)/.test(body)) throw new Error('Browser sent raw card fields');
  if (contract !== 'checkout-pro' && configCalls !== 1) throw new Error(`Expected one public-key config request, got ${configCalls}`);
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const result = { status: 'passed', contract, configCalls, purchaseRequests, request: requests[0], oauth: { origin: authorizationUrl.origin, responseType: authorizationUrl.searchParams.get('response_type'), platformId: authorizationUrl.searchParams.get('platform_id'), stateLength: authorizationUrl.searchParams.get('state').length } };
  await page.screenshot({ path: path.join(artifacts, `marketplace-${contract}-ui.png`), fullPage: true });
  fs.writeFileSync(path.join(artifacts, `marketplace-${contract}-ui.json`), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`PASS Marketplace ${contract} UI runtime`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, `marketplace-${contract}-ui-failure.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
