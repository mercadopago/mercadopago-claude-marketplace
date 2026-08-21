#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, destinationValue, artifactDirectory] = process.argv.slice(2);
if (!baseUrlValue || !destinationValue || !artifactDirectory) {
  console.error('Usage: node runtime-bricks-real.mjs <base-url> <destination-with-purchase-context> <artifact-directory>');
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue).origin;
const destination = new URL(destinationValue, baseUrl).toString();
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: 'es-AR' });
const errors = [];
const failedRequests = [];
const sdkResponses = [];

function sanitize(value) {
  return value.replace(/([?&](?:public_key|key)=)[^&]+/gi, '$1[REDACTED]');
}

page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('requestfailed', request => {
  if (/mercadopago|mp-config/i.test(request.url())) {
    failedRequests.push(`${request.method()} ${sanitize(request.url())}: ${request.failure()?.errorText || 'failed'}`);
  }
});
page.on('response', response => {
  if (/mercadopago|mp-config/i.test(response.url())) sdkResponses.push(`HTTP ${response.status()} ${sanitize(response.url())}`);
});

try {
  await page.goto(destination, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('[data-mp-bricks-page="card-payment"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => document.querySelectorAll('#brick-container iframe').length >= 3, null, { timeout: 45_000 });

  const container = page.locator('#brick-container');
  const box = await container.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) throw new Error('Card Payment Brick container has no interactive dimensions');
  const frames = [];
  for (const frame of page.frames().filter(candidate => candidate !== page.mainFrame())) {
    const frameElement = await frame.frameElement().catch(() => null);
    if (frameElement && await frameElement.evaluate(element => Boolean(element.closest('#brick-container'))).catch(() => false)) {
      frames.push(frame);
    }
  }
  if (frames.length < 3) throw new Error(`Expected at least three Mercado Pago secure frames, found ${frames.length}`);
  const interactiveFrames = [];
  for (const frame of frames) {
    const input = frame.locator('input').first();
    if (await input.count()) {
      interactiveFrames.push({
        url: sanitize(frame.url()),
        disabled: await input.isDisabled(),
        editable: await input.isEditable(),
      });
    }
  }
  if (interactiveFrames.length < 3) throw new Error(`Expected at least three secure inputs, found ${interactiveFrames.length}`);
  if (interactiveFrames.some(frame => frame.disabled || !frame.editable)) {
    throw new Error(`One or more secure Brick fields are not editable: ${JSON.stringify(interactiveFrames)}`);
  }
  if (errors.some(error => /FIELDS_SETUP_FAILED|public.?key|brick.*(?:fail|error)/i.test(error))) {
    throw new Error(`Mercado Pago Brick initialization errors: ${errors.join(' | ')}`);
  }
  if (failedRequests.length) throw new Error(`Mercado Pago requests failed: ${failedRequests.join(' | ')}`);

  const result = {
    status: 'passed',
    destination: new URL(destination).pathname,
    secureFrameCount: frames.length,
    editableSecureInputCount: interactiveFrames.length,
    interactiveFrames,
    sdkResponses,
  };
  await page.screenshot({ path: path.join(artifacts, 'bricks-card-payment-real-sdk.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'bricks-card-payment-real-sdk.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`PASS real Card Payment Brick SDK mount: ${interactiveFrames.length} editable secure inputs`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, 'bricks-card-payment-real-sdk-failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
