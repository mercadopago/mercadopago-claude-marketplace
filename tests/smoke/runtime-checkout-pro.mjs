#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrlValue, buyerCredentialsPath, artifactDirectory] = process.argv.slice(2);
if (!baseUrlValue || !buyerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-checkout-pro.mjs <base-url> <buyer.env> <artifact-directory>');
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
const buyer = parseEnv(path.resolve(buyerCredentialsPath));
if (!buyer.MP_TEST_BUYER_LOGIN) throw new Error('Missing MP_TEST_BUYER_LOGIN in buyer credentials file');
if (!buyer.MP_TEST_BUYER_PASSWORD) throw new Error('Missing MP_TEST_BUYER_PASSWORD in buyer credentials file');
if (!buyer.MP_TEST_PAYER_EMAIL) throw new Error('Missing MP_TEST_PAYER_EMAIL in buyer credentials file');
const testUserId = buyer.MP_TEST_BUYER_LOGIN.match(/test_user_(\d+)/i)?.[1];
const derivedSecurityCode = testUserId?.slice(-6);
const buyerSecret = buyer.MP_TEST_BUYER_SECURITY_CODE
  || (derivedSecurityCode?.length === 6 ? derivedSecurityCode : buyer.MP_TEST_BUYER_PASSWORD);
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'es-AR',
  viewport: { width: 1440, height: 1000 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.setDefaultNavigationTimeout(30_000);

try {
  const response = await context.request.post(`${baseUrl}/checkout/preferences`, {
    data: {
      total: 10,
      items: [{ title: 'Smoke test Checkout Pro', quantity: 1, unit_price: 10 }],
      payer: { name: 'APRO', email: buyer.MP_TEST_PAYER_EMAIL },
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok()) throw new Error(`Preference creation failed with HTTP ${response.status()}: ${payload.error || 'unknown error'}`);
  if (!payload.init_point || !payload.preference_id) throw new Error('Preference response is missing init_point or preference_id');

  const checkoutUrl = new URL(payload.init_point);
  if (!/(^|\.)mercadopago\.com(\.ar)?$/i.test(checkoutUrl.hostname)) {
    throw new Error(`Unexpected hosted checkout origin: ${checkoutUrl.hostname}`);
  }

  await page.goto(payload.init_point, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(3_000);
  if (!/(^|\.)mercadopago\.com(\.ar)?$/i.test(new URL(page.url()).hostname)) {
    throw new Error(`Hosted checkout did not load: ${page.url()}`);
  }

  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: path.join(artifacts, 'checkout-pro-hosted.png'), fullPage: true });
  if (!/mercado pago|pagar|pago/i.test(bodyText)) {
    throw new Error(`Hosted checkout loaded without recognized payment content. Title: ${await page.title()}. URL: ${page.url()}. Text: ${bodyText.slice(0, 400)}`);
  }

  const loginButton = page.getByRole('button', { name: /ingresar|iniciar sesi[oó]n|entrar/i }).first();
  const loginLink = page.getByRole('link', { name: /ingresar|iniciar sesi[oó]n|entrar/i }).first();
  let loginStarted = false;
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click();
    loginStarted = true;
  } else if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
    loginStarted = true;
  }

  let loginCompleted = false;
  let passwordMethodSelected = false;
  let secretSubmitted = false;
  let credentialRejected = false;
  if (loginStarted) {
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
    const loginInput = page.locator('input[type="email"]:visible, input[name="user_id"]:visible, input[name="email"]:visible, input[type="text"]:visible').first();
    const loginInputVisible = await loginInput.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
    if (loginInputVisible) {
      await loginInput.fill(buyer.MP_TEST_BUYER_LOGIN);
      const continueButton = page.getByRole('button', { name: /continuar|siguiente|ingresar|entrar/i }).first();
      await continueButton.waitFor({ state: 'visible', timeout: 10_000 });
      await continueButton.click();
      let password = page.locator('input[type="password"]:visible').first();
      let passwordVisible = await password.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
      if (!passwordVisible) {
        for (const frame of page.frames()) {
          const passwordMethod = frame.getByText(/contrase[nñ]a|senha|password/i, { exact: false }).last();
          const methodVisible = await passwordMethod.isVisible().catch(() => false);
          if (methodVisible) {
            await passwordMethod.click({ noWaitAfter: true });
            passwordMethodSelected = true;
            password = page.locator('input[type="password"]:visible').first();
            passwordVisible = await password.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
            break;
          }
        }
      }
      if (passwordVisible) {
        await password.fill(buyerSecret);
        await page.getByRole('button', { name: /continuar|ingresar|entrar/i }).first().click({ noWaitAfter: true });
        secretSubmitted = true;
        await page.waitForTimeout(5_000);
        const postAuthText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        credentialRejected = /incorrect|inv[aá]lid|no coincide|intenta de nuevo|tente novamente/i.test(postAuthText);
        loginCompleted = !/login|auth/i.test(new URL(page.url()).pathname);
      }
    }
  }

  await page.screenshot({ path: path.join(artifacts, 'checkout-pro-after-login-attempt.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'checkout-pro-runtime.json'), `${JSON.stringify({
    status: 'passed',
    preferenceId: payload.preference_id,
    hostedCheckoutLoaded: true,
    loginStarted,
    loginCompleted,
    passwordMethodSelected,
    secretSubmitted,
    credentialRejected,
    finalOrigin: new URL(page.url()).origin,
  }, null, 2)}\n`);
  console.log('Checkout Pro runtime validation passed');
} finally {
  await browser.close();
}
