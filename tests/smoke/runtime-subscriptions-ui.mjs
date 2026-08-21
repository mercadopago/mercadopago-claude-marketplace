#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, model, destinationValue, artifactDirectory] = process.argv.slice(2);
const models = new Set(['with-plan', 'without-plan-authorized', 'without-plan-pending']);
if (!baseUrlValue || !models.has(model) || !destinationValue || !artifactDirectory) {
  console.error('Usage: node runtime-subscriptions-ui.mjs <base-url> <model> <destination> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const destination = new URL(destinationValue, baseUrl);
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });
const authorized = model !== 'without-plan-pending';

const sdkStub = `
(() => {
  window.MercadoPago = function MercadoPago(publicKey) {
    window.__mpPublicKeySeen = publicKey;
    return {
      cardForm(config) {
        const secureFields = ['cardNumber', 'expirationDate', 'securityCode'];
        for (const field of secureFields) {
          const target = document.getElementById(config.form[field].id);
          if (!target) throw new Error('Missing secure host: ' + field);
          const iframe = document.createElement('iframe');
          iframe.title = field;
          iframe.srcdoc = '<!doctype html><input aria-label="' + field + '" style="width:100%;height:36px">';
          iframe.style.cssText = 'display:block;width:100%;height:40px;border:0';
          target.appendChild(iframe);
        }
        const controller = {
          getCardFormData() {
            return {
              token: 'single-use-smoke-token',
              cardholderEmail: 'buyer@example.com',
              cardholderName: 'APRO',
              paymentMethodId: 'master',
              issuerId: '1',
              installments: 1,
              identificationType: 'DNI',
              identificationNumber: '12345678'
            };
          },
          unmount() {},
        };
        const form = document.getElementById(config.form.id);
        if (!form) throw new Error('Missing CardForm form: ' + config.form.id);
        form.addEventListener('submit', event => {
          event.preventDefault();
          Promise.resolve(config.callbacks?.onSubmit?.(event)).catch(error => config.callbacks?.onError?.(error));
        });
        queueMicrotask(() => config.callbacks?.onFormMounted?.(null));
        window.__mpCardFormSmoke = { config, controller };
        return controller;
      }
    };
  };
})();
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: 'es-AR' });
const errors = [];
const requests = [];
let configCalls = 0;

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
await page.route('**/api/subscriptions', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  let body = {};
  try { body = route.request().postDataJSON(); } catch {}
  requests.push(body);
  const response = authorized
    ? { id: 'SUB-SMOKE-123', subscriptionId: 'SUB-SMOKE-123', status: 'authorized' }
    : {
        id: 'SUB-SMOKE-123', subscriptionId: 'SUB-SMOKE-123', status: 'pending',
        init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=SUB-SMOKE-123',
        initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=SUB-SMOKE-123',
      };
  return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response) });
});
await page.route('https://www.mercadopago.com.ar/subscriptions/checkout**', route => route.fulfill({
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>Mercado Pago subscription smoke</title><h1>Subscription checkout pending</h1>',
}));

try {
  await page.goto(destination.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator(`[data-mp-subscriptions-page="${model}"]`).waitFor({ state: 'attached', timeout: 15_000 });

  const inputs = page.locator('input:visible:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])');
  for (let index = 0; index < await inputs.count(); index += 1) {
    const input = inputs.nth(index);
    if (await input.isDisabled()) continue;
    const type = (await input.getAttribute('type')) || 'text';
    const id = (await input.getAttribute('id')) || '';
    const name = (await input.getAttribute('name')) || '';
    const key = `${id} ${name}`.toLowerCase();
    const value = type === 'email' || key.includes('email')
      ? 'buyer@example.com'
      : type === 'tel' || key.includes('tel')
        ? '+5491100000000'
        : key.includes('cp') || key.includes('postal')
          ? '1000'
          : key.includes('cardholder')
            ? 'APRO'
            : 'Smoke Test';
    await input.fill(value);
  }

  let secureFrames = 0;
  if (authorized) {
    await page.waitForFunction(() => Boolean(window.__mpCardFormSmoke), null, { timeout: 15_000 });
    if (configCalls !== 1) throw new Error(`Expected one MP config request, got ${configCalls}`);
    if (!await page.evaluate(() => Boolean(window.__mpPublicKeySeen))) throw new Error('CardForm initialized without a runtime public key');
    secureFrames = await page.locator('[data-mp-secure-field] iframe').count();
    if (secureFrames !== 3) throw new Error(`Expected 3 secure iframe fields, got ${secureFrames}`);
    for (const frame of page.frames().filter(item => item !== page.mainFrame())) {
      const field = frame.locator('input');
      if (await field.count()) {
        await field.fill('1');
        if (await field.inputValue() !== '1') throw new Error('Secure iframe input is not editable');
      }
    }
  } else if (configCalls !== 0) {
    throw new Error(`Pending model must not request MP_PUBLIC_KEY; got ${configCalls} config calls`);
  }

  const cta = page.locator(`[data-mp-subscription-cta="${model}"]`);
  if (await cta.count() !== 1) throw new Error(`Expected exactly one final subscription CTA, got ${await cta.count()}`);
  await cta.click();

  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /SUB-SMOKE-123|authorized|autorizad|activ(?:a|ad[ao])|subscription checkout pending|pending/i.test(text)
      || location.hostname === 'www.mercadopago.com.ar';
  }, null, { timeout: 15_000 });

  if (requests.length !== 1) throw new Error(`Expected exactly one subscription creation request, got ${requests.length}`);
  const serialized = JSON.stringify(requests[0]);
  if (authorized && !/(cardToken|card_token|token)/.test(serialized)) {
    throw new Error('Authorized UI did not send the secure single-use token to its own backend');
  }
  if (!authorized && /(cardToken|card_token|single-use-smoke-token)/.test(serialized)) {
    throw new Error('Pending UI sent card token data');
  }
  if (/(cardNumber|securityCode|expirationDate)/.test(serialized)) {
    throw new Error('UI sent raw card fields to its backend');
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const result = {
    status: 'passed', model, authorized, configCalls, secureFrames,
    subscriptionRequests: requests.length,
    sentKeys: Object.keys(requests[0]).sort(),
  };
  await page.screenshot({ path: path.join(artifacts, `subscriptions-${model}-ui.png`), fullPage: true });
  fs.writeFileSync(path.join(artifacts, `subscriptions-${model}-ui.json`), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`PASS Subscriptions ${model} UI runtime`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, `subscriptions-${model}-ui-failure.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
