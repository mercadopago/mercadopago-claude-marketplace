#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, buyerCredentialsPath, artifactDirectory] = process.argv.slice(2);
const submitPayment = process.argv.includes('--submit');
if (!baseUrlValue || !buyerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-checkout-api.mjs <base-url> <buyer.env> <artifact-directory>');
  process.exit(2);
}

function parseEnv(file) {
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.at(-1) === quote) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const baseUrl = new URL(baseUrlValue).origin;
const artifacts = path.resolve(artifactDirectory);
const buyer = parseEnv(path.resolve(buyerCredentialsPath));
if (!buyer.MP_TEST_PAYER_EMAIL) throw new Error('Missing MP_TEST_PAYER_EMAIL in buyer credentials file');
fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'es-AR' });
const page = await context.newPage();
const checkoutErrors = [];
const failedRequests = [];
const sdkEvents = [];

function sanitizedUrl(value) {
  return value.replace(/([?&]public_key=)[^&]+/gi, '$1[REDACTED]');
}

page.on('console', message => {
  if (/mercado|checkout|card|token|secure/i.test(message.text())) sdkEvents.push(`${message.type()}: ${message.text()}`);
  if (message.type() === 'error' && /Checkout API|Secure Fields|MP_PUBLIC_KEY/i.test(message.text())) {
    checkoutErrors.push(message.text());
  }
});
page.on('pageerror', error => checkoutErrors.push(error.message));
page.on('requestfailed', request => {
  if (/mercadopago|checkout|mp-config/i.test(request.url())) {
    failedRequests.push(`${request.method()} ${sanitizedUrl(request.url())} — ${request.failure()?.errorText || 'failed'}`);
  }
});
page.on('response', response => {
  if (/mercadopago|process-payment/i.test(response.url())) {
    sdkEvents.push(`HTTP ${response.status()} ${sanitizedUrl(response.url())}`);
  }
});

const configResponse = await context.request.get(`${baseUrl}/api/mp-config`, {
  headers: { Accept: 'application/json' },
});
if (configResponse.status() !== 200) throw new Error(`/api/mp-config returned HTTP ${configResponse.status()}`);
if (!/no-store/i.test(configResponse.headers()['cache-control'] || '')) {
  throw new Error('/api/mp-config did not return Cache-Control: no-store');
}
const configPayload = await configResponse.json();
if (!configPayload.publicKey) throw new Error('/api/mp-config returned no publicKey');

try {
  await page.goto(`${baseUrl}/checkout/payment`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#form-checkout__cardNumber iframe').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#form-checkout__expirationDate iframe').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#form-checkout__securityCode iframe').waitFor({ state: 'visible', timeout: 30_000 });

  const expectedLabels = [
    'Número de tarjeta',
    'Vencimiento (MM/AA)',
    'Código de seguridad (CVC)',
    'Nombre en la tarjeta',
    'DNI del titular',
    'Email del comprador',
  ];
  const visibleLabels = await page.locator('label:visible').allTextContents();
  for (const label of expectedLabels) {
    if (!visibleLabels.map(value => value.trim()).includes(label)) throw new Error(`Visible label missing: ${label}`);
  }

  const secureInputs = [
    ['#form-checkout__cardNumber iframe', '#cardNumber', '5031755734530604'],
    ['#form-checkout__expirationDate iframe', '#expirationDate', '1130'],
    ['#form-checkout__securityCode iframe', '#securityCode', '123'],
  ];
  for (const [frameSelector, inputSelector, value] of secureInputs) {
    const input = page.frameLocator(frameSelector).locator(inputSelector);
    await input.click({ timeout: 15_000 });
    await input.pressSequentially(value, { delay: 35 });
    await input.press('Tab');
    if (!(await input.inputValue()).replace(/\D/g, '')) throw new Error(`Secure field did not accept input: ${frameSelector}`);
  }

  await page.locator('#form-checkout__cardholderName').fill('APRO');
  await page.locator('#form-checkout__identificationNumber').fill('12345678');
  await page.locator('#form-checkout__cardholderEmail').fill(buyer.MP_TEST_PAYER_EMAIL);
  await page.waitForTimeout(2_000);

  for (const id of ['issuer', 'installments', 'identificationType']) {
    const select = page.locator(`#form-checkout__${id}`);
    if (await select.isDisabled()) throw new Error(`${id} lifecycle select is disabled`);
    if (!(await select.getAttribute('hidden')) && !(await select.isHidden())) {
      throw new Error(`${id} lifecycle select should remain hidden`);
    }
  }

  const initError = page.locator('#checkout-init-error');
  if (await initError.isVisible()) throw new Error(`Checkout initialization error: ${await initError.textContent()}`);
  if (checkoutErrors.length) throw new Error(`Checkout console errors: ${checkoutErrors.join(' | ')}`);

  let payment = null;
  if (submitPayment) {
    const formState = await page.evaluate(() => {
      const form = document.getElementById('form-checkout');
      window.__smokeSubmitEvents = 0;
      form.addEventListener('submit', () => { window.__smokeSubmitEvents += 1; });
      return {
        valid: form.checkValidity(),
        controls: [...form.elements].map(control => ({
          id: control.id,
          type: control.type,
          valid: control.checkValidity(),
          disabled: control.disabled,
          hidden: control.hidden,
          hasValue: Boolean(control.value),
        })),
      };
    });
    if (!formState.valid) throw new Error(`Native form validation failed: ${JSON.stringify(formState.controls.filter(item => !item.valid))}`);
    const paymentResponsePromise = page.waitForResponse(
      response => response.url().endsWith('/api/process-payment'),
      { timeout: 30_000 },
    );
    await page.locator('#form-checkout__submit').click();
    let paymentResponse;
    try {
      paymentResponse = await paymentResponsePromise;
    } catch (error) {
      await page.waitForTimeout(1_000);
      const visibleResult = (await page.locator('#result').textContent().catch(() => ''))?.trim();
      const visibleInitError = (await page.locator('#checkout-init-error').textContent().catch(() => ''))?.trim();
      const submitEvents = await page.evaluate(() => window.__smokeSubmitEvents || 0);
      throw new Error(`No payment request emitted. Submit events: ${submitEvents}. Form: ${JSON.stringify(formState.controls)}. Result: ${visibleResult || '<empty>'}. Init error: ${visibleInitError || '<empty>'}. SDK events: ${sdkEvents.join(' | ') || '<none>'}`);
    }
    const paymentPayload = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok()) {
      throw new Error(`Test payment failed with HTTP ${paymentResponse.status()}: ${paymentPayload.error || 'unknown error'}`);
    }
    if (!['approved', 'processed'].includes(paymentPayload.status)) {
      throw new Error(`Unexpected test payment status: ${paymentPayload.status || 'missing'}`);
    }
    payment = { id: paymentPayload.id, status: paymentPayload.status, amount: 10, currency: 'ARS' };
    await page.locator('#result h2').waitFor({ state: 'visible', timeout: 10_000 });
  }

  await page.screenshot({ path: path.join(artifacts, 'checkout-api-filled.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'checkout-api-runtime.json'), `${JSON.stringify({
    status: 'passed',
    url: page.url(),
    labels: expectedLabels,
    secureFieldsEditable: true,
    lifecycleSelectsEnabled: true,
    configNoStore: true,
    payment,
    failedRequests,
    sdkEvents,
  }, null, 2)}\n`);
  console.log('Checkout API runtime validation passed');
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, 'checkout-api-failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
