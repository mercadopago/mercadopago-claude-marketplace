#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, artifactDirectory] = process.argv.slice(2);
if (!baseUrlValue || !artifactDirectory) {
  console.error('Usage: node runtime-qr-ui.mjs <base-url> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const cases = [
  { status: 'processed', expectedMessage: /pago (?:aprobado|recibido)|procesado con [eé]xito/i },
  { status: 'expired', expectedMessage: /expir|venc|caduc/i },
  { status: 'refunded', expectedMessage: /reembols|devol|refund/i },
];
const browser = await chromium.launch({ headless: true });
const results = [];

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForCounter(readValue, minimum, timeoutMilliseconds, description) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (readValue() >= minimum) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function selectFirstProduct(page) {
  const candidates = [
    'button[onclick*="addItem"]',
    '.item-card',
    '.menu-item',
    '[data-product-id]',
  ];
  for (const selector of candidates) {
    const item = page.locator(selector).first();
    if (await item.count()) {
      await item.click();
      return;
    }
  }
  throw new Error('Could not find a product control to enable the QR CTA');
}

try {
  for (const testCase of cases) {
    const page = await browser.newPage();
    const errors = [];
    let createCalls = 0;
    let lookupCalls = 0;
    let cancelCalls = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(message.text());
    });

    await page.addInitScript({ content: `window.QRCode = class QRCode {
        constructor(element, options) {
          const canvas = document.createElement('canvas');
          canvas.width = options?.width || 240;
          canvas.height = options?.height || 240;
          canvas.dataset.mockQr = String(options?.text || '');
          element.appendChild(canvas);
        }
      };` });
    await page.route(/qrcode(?:\.min)?\.js/i, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/api/qr/orders**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() === 'POST' && pathname === '/api/qr/orders') {
        createCalls += 1;
        const body = request.postDataJSON();
        const mockedAmount = body.amount ?? body.items?.reduce(
          (sum, item) => sum + Number(item.price) * Number(item.qty),
          0,
        );
        if (!Number.isFinite(Number(mockedAmount)) || Number(mockedAmount) <= 0) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid mocked amount' }) });
        }
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            orderId: `ORD-MOCK-QR-${testCase.status}`,
            status: 'created',
            mode: 'dynamic',
            qrData: `000201-MOCK-${testCase.status}`,
            staticQrImage: null,
          }),
        });
      }
      if (request.method() === 'GET' && /^\/api\/qr\/orders\/[^/]+$/.test(pathname)) {
        lookupCalls += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: pathname.split('/').at(-1), type: 'qr', status: testCase.status }),
        });
      }
      if (request.method() === 'POST' && pathname.endsWith('/cancel')) {
        cancelCalls += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'canceled' }) });
      }
      return route.continue();
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const cta = page.locator('[data-mp-qr-cta="create-order"]');
    await cta.waitFor({ state: 'attached' });
    if (!(await cta.isDisabled())) throw new Error(`QR CTA must start disabled for ${testCase.status}`);
    await selectFirstProduct(page);
    if (await cta.isDisabled()) throw new Error(`QR CTA did not enable for ${testCase.status}`);
    await cta.click();
    await page.locator('#qr-container canvas, #qr-container img, [data-mp-qr-code] canvas, [data-mp-qr-code] img').first().waitFor({ state: 'attached', timeout: 10_000 });
    await waitForCounter(() => lookupCalls, 1, 10_000, `QR ${testCase.status} reconciliation`);
    await page.waitForFunction(
      ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
      { source: testCase.expectedMessage.source, flags: testCase.expectedMessage.flags },
      { timeout: 10_000 },
    );
    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes(`ORD-MOCK-QR-${testCase.status}`)) throw new Error(`QR UI did not show the order ID for ${testCase.status}`);
    if (createCalls !== 1) throw new Error(`QR CTA created ${createCalls} orders for ${testCase.status}`);
    if (errors.length) throw new Error(`QR UI errors for ${testCase.status}: ${errors.join(' | ')}`);
    await page.screenshot({ path: path.join(artifacts, `qr-ui-${testCase.status}.png`), fullPage: true });
    results.push({ status: testCase.status, createCalls, lookupCalls, cancelCalls, passed: true });
    console.log(`PASS QR UI ${testCase.status}`);
    await page.close();
  }

  const cancelPage = await browser.newPage();
  let cancelCreateCalls = 0;
  let cancelCalls = 0;
  await cancelPage.addInitScript({ content: 'window.QRCode = class { constructor(el) { el.appendChild(document.createElement("canvas")); } };' });
  await cancelPage.route(/qrcode(?:\.min)?\.js/i, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await cancelPage.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await cancelPage.route('**/api/qr/orders**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname === '/api/qr/orders') {
      cancelCreateCalls += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ orderId: 'ORD-MOCK-QR-CANCEL', status: 'created', mode: 'dynamic', qrData: '000201-MOCK-CANCEL' }) });
    }
    if (request.method() === 'POST' && pathname.endsWith('/cancel')) {
      cancelCalls += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'canceled' }) });
    }
    if (request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'created' }) });
    return route.continue();
  });
  await cancelPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await selectFirstProduct(cancelPage);
  await cancelPage.locator('[data-mp-qr-cta="create-order"]').click();
  await cancelPage.getByRole('button', { name: /cancelar|cancel/i }).last().click();
  await cancelPage.waitForFunction(() => document.body.innerText.match(/cancel|cancelad/i), null, { timeout: 10_000 }).catch(() => {});
  if (cancelCreateCalls !== 1) throw new Error(`QR cancel case created ${cancelCreateCalls} orders`);
  if (cancelCalls !== 1) throw new Error(`QR UI called cancellation ${cancelCalls} times; expected exactly one`);
  results.push({ status: 'canceled', createCalls: cancelCreateCalls, cancelCalls, passed: true });
  console.log('PASS QR UI canceled');
  await cancelPage.close();

  fs.writeFileSync(path.join(artifacts, 'qr-ui-runtime.json'), `${JSON.stringify({ status: 'passed', results }, null, 2)}\n`, { mode: 0o600 });
} finally {
  await browser.close();
}
