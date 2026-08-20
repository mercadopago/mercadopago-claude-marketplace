#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, artifactDirectory] = process.argv.slice(2);
if (!baseUrlValue || !artifactDirectory) {
  console.error('Usage: node runtime-point-ui.mjs <base-url> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });
const cases = [
  { status: 'processed', expectedMessage: /aprob|proces|success/i },
  { status: 'failed', expectedMessage: /rechaz|fall|error|no se pudo/i },
  { status: 'action_required', expectedMessage: /terminal|acci[oó]n|action/i },
];
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const testCase of cases) {
    const page = await browser.newPage();
    const errors = [];
    let createCalls = 0;
    let lookupCalls = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('**/api/point/orders**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() === 'POST' && pathname === '/api/point/orders') {
        createCalls += 1;
        const body = request.postDataJSON();
        if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid mocked amount' }) });
        }
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            orderId: `ORD-MOCK-${testCase.status}`,
            order_id: `ORD-MOCK-${testCase.status}`,
            status: 'created',
            test_mode: true,
          }),
        });
      }
      if (request.method() === 'GET' && pathname.startsWith('/api/point/orders/')) {
        lookupCalls += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ order_id: pathname.split('/').at(-1), status: testCase.status }),
        });
      }
      return route.continue();
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const cta = page.locator('[data-mp-point-cta="create-order"]');
    await cta.waitFor({ state: 'attached' });
    if (!(await cta.isDisabled())) throw new Error(`Point CTA must start disabled for ${testCase.status}`);
    await page.locator('.item-card').first().click();
    if (await cta.isDisabled()) throw new Error(`Point CTA did not enable for ${testCase.status}`);
    await cta.click();
    await page.locator('#point-modal.open').waitFor({ state: 'visible' });
    await page.locator('#point-order-id, #modal-order-id').first().waitFor({ state: 'visible' });
    await page.waitForFunction(
      ({ source, flags }) => {
        const message = document.querySelector('#point-message, #point-status-text')?.textContent || '';
        return new RegExp(source, flags).test(message);
      },
      { source: testCase.expectedMessage.source, flags: testCase.expectedMessage.flags },
      { timeout: 10_000 },
    );
    const message = (await page.locator('#point-message, #point-status-text').first().textContent())?.trim() || '';
    if (!testCase.expectedMessage.test(message)) {
      throw new Error(`Point UI did not explain ${testCase.status}; rendered: ${message}`);
    }
    if (createCalls !== 1) throw new Error(`Point CTA created ${createCalls} orders for ${testCase.status}`);
    if (lookupCalls < 1) throw new Error(`Point UI never reconciled ${testCase.status}`);
    if (errors.length) throw new Error(`Point UI errors for ${testCase.status}: ${errors.join(' | ')}`);
    await page.screenshot({ path: path.join(artifacts, `point-ui-${testCase.status}.png`), fullPage: true });
    results.push({ status: testCase.status, createCalls, lookupCalls, message, passed: true });
    console.log(`PASS Point UI ${testCase.status}: ${message}`);
    await page.close();
  }
  fs.writeFileSync(path.join(artifacts, 'point-ui-runtime.json'), `${JSON.stringify({ status: 'passed', results }, null, 2)}\n`, { mode: 0o600 });
} finally {
  await browser.close();
}
