#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const detector = path.join(scriptDir, 'detect-checkout-cta.mjs');
const resolver = path.join(scriptDir, 'resolve-checkout-cta.mjs');
const validator = path.join(scriptDir, 'validate-checkout-screen.mjs');
const ctaValidator = path.join(scriptDir, 'validate-checkout-cta.mjs');
const proServerValidator = path.join(scriptDir, 'validate-checkout-pro-server.mjs');
const pluginRoot = path.resolve(scriptDir, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-checkout-tools-'));

const cases = [
  {
    name: 'vanilla-external-listener',
    expected: 'selected',
    file: 'index.html',
    source: `<button class="primary-action">Finalizar compra</button>
<script>document.querySelector('.primary-action').addEventListener('click', () => window.location.assign('/payment/checkout'));</script>`,
  },
  {
    name: 'react-named-handler',
    expected: 'selected',
    file: 'CheckoutButton.tsx',
    source: `const openOrder = () => navigate('/payment');
export function CheckoutButton() { return <button data-testid="order-action" onClick={openOrder}>Continue to payment</button>; }`,
  },
  {
    name: 'vue-named-handler',
    expected: 'selected',
    file: 'Cart.vue',
    source: `<template><button class="next-step" @click="openPayment">Realizar pago</button></template>
<script setup>const openPayment = () => router.push('/checkout');</script>`,
  },
  {
    name: 'checkout-pro-preference-handler',
    expected: 'selected',
    file: 'Cart.tsx',
    source: `async function startMercadoPago() {
  const response = await fetch('/api/create-preference', { method: 'POST' });
  const { init_point } = await response.json();
  window.location.assign(init_point);
}
export function Cart() { return <button className="buy-now" onClick={startMercadoPago}>Pagar com Mercado Pago</button>; }`,
  },
  {
    name: 'no-checkout-cta',
    expected: 'not_found',
    file: 'Product.vue',
    source: `<template><button @click="addToCart">Adicionar ao carrinho</button></template>`,
  },
  {
    name: 'generic-deck-navigation-is-not-cta',
    expected: 'not_found',
    file: 'deck.html',
    source: `<h2>Checkout Pro</h2>
<button id="btn-prev" onclick="go(-1)">←</button>
<button id="btn-next" onclick="go(1)">→</button>
<script>const slides = ['/intro', '/checkout']; function go(step) { window.location.assign(slides[step]); }</script>`,
  },
  {
    name: 'payment-submit-is-not-entry-cta',
    expected: 'not_found',
    file: 'PaymentForm.html',
    source: `<form><button id="pay" type="submit">Pagar agora</button></form>`,
  },
];

function checkoutFixture({ payerSource = 'form', extraField = '' } = {}) {
  const payerFields = payerSource === 'form'
    ? `<div data-mp-field="identificationNumber"><label for="identificationNumber">Documento</label><input id="identificationNumber"></div>
       <div data-mp-field="cardholderEmail"><label for="cardholderEmail">E-mail</label><input id="cardholderEmail"></div>`
    : '';
  return `
    <form data-mp-public-key-source="runtime-endpoint"
          data-mp-payer-email-source="${payerSource}"
          data-mp-payer-identification-source="${payerSource}"
          data-mp-identification-type="CPF">
      <div data-mp-field="cardNumber"><label id="number-label">Número</label><div data-mp-secure-field="cardNumber" aria-labelledby="number-label"></div></div>
      <div data-mp-field="expirationDate"><label id="expiration-label">Validade</label><div data-mp-secure-field="expirationDate" aria-labelledby="expiration-label"></div></div>
      <div data-mp-field="securityCode"><label id="cvv-label">CVV</label><div data-mp-secure-field="securityCode" aria-labelledby="cvv-label"></div></div>
      <div data-mp-field="cardholderName"><label for="cardholderName">Nome</label><input id="cardholderName"></div>
      ${payerFields}
      <select id="issuer" data-mp-sdk-required-field="issuer" hidden aria-hidden="true" tabindex="-1"></select>
      <select id="installments" data-mp-sdk-required-field="installments" hidden aria-hidden="true" tabindex="-1"></select>
      <select id="identificationType" data-mp-sdk-required-field="identificationType" hidden aria-hidden="true" tabindex="-1"></select>
      ${extraField}
    </form>
    <div id="checkout-init-error" aria-live="assertive"></div>
    <script>
      async function loadPublicKey() {
        return fetch('/api/mp-config', { cache: 'no-store' });
      }
      mp.cardForm({
        form: {
          cardNumber: {}, expirationDate: {}, securityCode: {},
          issuer: { id: 'issuer' },
          installments: { id: 'installments' },
          identificationType: { id: 'identificationType' }
        },
        callbacks: { onFormMounted: () => {} }
      });
    </script>`;
}

try {
  const runtimeInstructionFiles = [
    'commands/mp-integrate.md',
    'commands/mp-connect.md',
    'commands/mp-review.md',
    'commands/mp-test-cards.md',
    'skills/mp-integrate/SKILL.md',
    'skills/mp-integrate/SKILL-migrate.md',
    'skills/mp-test-setup/SKILL.md',
  ];
  for (const relative of runtimeInstructionFiles) {
    const instruction = fs.readFileSync(path.join(pluginRoot, relative), 'utf8');
    if (/find\s+~\/\.claude|~\/\.claude\/plugins\/cache|cache\/claude-plugins-official\/mercadopago/.test(instruction)) {
      throw new Error(`${relative}: runtime instructions reference a forbidden alternate installation cache`);
    }
  }
  const integrateCommand = fs.readFileSync(path.join(pluginRoot, 'commands/mp-integrate.md'), 'utf8');
  if (!integrateCommand.includes('${CLAUDE_PLUGIN_ROOT}/scripts/resolve-checkout-cta.mjs')
      || /cp\s+[\s\S]{0,200}\.mcp\.json/.test(integrateCommand)) {
    throw new Error('mp-integrate must use the active Claude plugin root and never copy MCP configuration');
  }
  const integrateSkill = fs.readFileSync(path.join(pluginRoot, 'skills/mp-integrate/SKILL.md'), 'utf8');
  if (!integrateSkill.includes('${CLAUDE_PLUGIN_ROOT}/scripts/validate-checkout-screen.mjs')
      || integrateSkill.includes('$MP_PLUGIN_ROOT/scripts/')) {
    throw new Error('mp-integrate skill does not consistently use the active Claude plugin root');
  }
  const preferenceInstructionFiles = [
    ...runtimeInstructionFiles,
    'agents/mp-integration-expert.md',
    'skills/mp-integrate/references/terminology-rules.md',
    'skills/mp-integrate/references/products.md',
    'skills/mp-integrate/references/guides/checkout-pro.md',
  ];
  for (const relative of new Set(preferenceInstructionFiles)) {
    const instruction = fs.readFileSync(path.join(pluginRoot, relative), 'utf8');
    if (/\/v1\/(?:checkout\/)?preferences(?:\b|\/)/.test(instruction)) {
      throw new Error(`${relative}: Checkout Pro preferences endpoint must not include /v1`);
    }
  }
  console.log('PASS checkout-pro-endpoint: /checkout/preferences has no /v1 prefix');
  console.log('PASS claude-plugin-root: alternate installation caches forbidden');

  for (const testCase of cases) {
    const directory = path.join(tempRoot, testCase.name);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, testCase.file), testCase.source);
    const run = spawnSync(process.execPath, [detector, directory], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`${testCase.name}: detector exited ${run.status}: ${run.stderr}`);
    const result = JSON.parse(run.stdout);
    if (result.status !== testCase.expected) {
      throw new Error(`${testCase.name}: expected ${testCase.expected}, received ${result.status}\n${run.stdout}`);
    }
    console.log(`PASS ${testCase.name}: ${result.status}`);
  }

  const apiAliasRun = spawnSync(process.execPath, [
    resolver,
    'checkout-api-orders',
    path.join(tempRoot, 'vanilla-external-listener'),
  ], { encoding: 'utf8' });
  if (apiAliasRun.status !== 0) throw new Error(`checkout-api-alias: ${apiAliasRun.stderr}`);
  const apiAliasResult = JSON.parse(apiAliasRun.stdout);
  if (apiAliasResult.product !== 'checkout-api' || apiAliasResult.status !== 'selected') {
    throw new Error(`checkout-api-alias: expected normalized selected result\n${apiAliasRun.stdout}`);
  }
  console.log('PASS checkout-api-alias: normalized and selected');

  const proResolverRun = spawnSync(process.execPath, [
    resolver,
    'checkout-pro',
    path.join(tempRoot, 'checkout-pro-preference-handler'),
  ], { encoding: 'utf8' });
  if (proResolverRun.status !== 0) throw new Error(`checkout-pro-resolver: ${proResolverRun.stderr}`);
  const proResolverResult = JSON.parse(proResolverRun.stdout);
  if (proResolverResult.product !== 'checkout-pro' || proResolverResult.status !== 'selected') {
    throw new Error(`checkout-pro-resolver: expected unchanged selected result\n${proResolverRun.stdout}`);
  }
  console.log('PASS checkout-pro-resolver: unchanged and selected');

  const missingResolverRun = spawnSync(process.execPath, [
    resolver,
    'checkout-api',
    path.join(tempRoot, 'no-checkout-cta'),
  ], { encoding: 'utf8' });
  if (missingResolverRun.status !== 0) throw new Error(`checkout-api-missing-resolver: ${missingResolverRun.stderr}`);
  const missingResolverResult = JSON.parse(missingResolverRun.stdout);
  if (!missingResolverResult.requiresUserSelection
      || missingResolverResult.nextAction !== 'ask_user_for_cta_or_insertion_location') {
    throw new Error(`checkout-api-missing-resolver: expected mandatory user selection\n${missingResolverRun.stdout}`);
  }
  console.log('PASS checkout-api-missing-resolver: user selection required');

  const runtimeConfigServer = path.join(tempRoot, 'runtime-config-server.mjs');
  fs.writeFileSync(runtimeConfigServer, `
    app.get('/api/mp-config', (req, res) => {
      const publicKey = process.env.MP_PUBLIC_KEY?.trim();
      res.set('Cache-Control', 'no-store, max-age=0');
      if (!publicKey) return res.status(500).json({ error: 'MP_PUBLIC_KEY missing' });
      return res.json({ publicKey });
    });
  `);
  const checkoutEntryFile = path.join(tempRoot, 'checkout-entry.html');
  fs.writeFileSync(checkoutEntryFile, '<a data-mp-checkout-cta="checkout-api" href="/checkout/payment">Finalizar compra</a>');

  const checkoutApiGuide = path.join(pluginRoot, 'skills/mp-integrate/references/guides/checkout-api.md');
  const checkoutApiGuideRun = spawnSync(process.execPath, [validator, checkoutApiGuide, checkoutApiGuide, checkoutEntryFile], { encoding: 'utf8' });
  if (checkoutApiGuideRun.status !== 0) {
    throw new Error(`checkout-api-guide: canonical scaffold failed validation\n${checkoutApiGuideRun.stdout}${checkoutApiGuideRun.stderr}`);
  }
  console.log('PASS checkout-api-guide: canonical scaffold accepted');

  for (const [name, source] of [
    ['minimal-form-sourced-payer', checkoutFixture()],
    ['minimal-application-sourced-payer', checkoutFixture({ payerSource: 'application' })],
  ]) {
    const file = path.join(tempRoot, `${name}.html`);
    fs.writeFileSync(file, source);
    const run = spawnSync(process.execPath, [validator, file, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`${name}: validator exited ${run.status}: ${run.stderr}`);
    console.log(`PASS ${name}: accepted`);
  }

  const optionalFieldFile = path.join(tempRoot, 'unjustified-issuer.html');
  fs.writeFileSync(optionalFieldFile, checkoutFixture({
    extraField: '<div data-mp-field="issuer"><label>Banco emissor</label><select></select></div>',
  }));
  const optionalFieldRun = spawnSync(process.execPath, [validator, optionalFieldFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (optionalFieldRun.status === 0 || !optionalFieldRun.stderr.includes('issuer is conditional')) {
    throw new Error(`unjustified-issuer: validator should reject the optional field\n${optionalFieldRun.stdout}${optionalFieldRun.stderr}`);
  }
  console.log('PASS unjustified-issuer: rejected');

  const missingLifecycleFile = path.join(tempRoot, 'missing-lifecycle-select.html');
  fs.writeFileSync(missingLifecycleFile, checkoutFixture().replace(
    '<select id="issuer" data-mp-sdk-required-field="issuer" hidden aria-hidden="true" tabindex="-1"></select>',
    '',
  ));
  const missingLifecycleRun = spawnSync(process.execPath, [validator, missingLifecycleFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (missingLifecycleRun.status === 0 || !missingLifecycleRun.stderr.includes('issuer: expected one required CardForm lifecycle')) {
    throw new Error(`missing-lifecycle-select: validator should reject a missing SDK node\n${missingLifecycleRun.stdout}${missingLifecycleRun.stderr}`);
  }
  console.log('PASS missing-lifecycle-select: rejected');

  const disabledLifecycleFile = path.join(tempRoot, 'disabled-lifecycle-select.html');
  fs.writeFileSync(disabledLifecycleFile, checkoutFixture().replace(
    'data-mp-sdk-required-field="installments" hidden',
    'data-mp-sdk-required-field="installments" disabled hidden',
  ));
  const disabledLifecycleRun = spawnSync(process.execPath, [validator, disabledLifecycleFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (disabledLifecycleRun.status === 0 || !disabledLifecycleRun.stderr.includes('installments: lifecycle select must never be disabled')) {
    throw new Error(`disabled-lifecycle-select: validator should reject a disabled SDK node\n${disabledLifecycleRun.stdout}${disabledLifecycleRun.stderr}`);
  }
  console.log('PASS disabled-lifecycle-select: rejected');

  const cachedPlaceholderFile = path.join(tempRoot, 'cached-public-key-placeholder.html');
  fs.writeFileSync(cachedPlaceholderFile, checkoutFixture().replace(
    "return fetch('/api/mp-config', { cache: 'no-store' });",
    "const publicKey = '%MP_PUBLIC_KEY%'; return publicKey;",
  ));
  const cachedPlaceholderRun = spawnSync(process.execPath, [validator, cachedPlaceholderFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (cachedPlaceholderRun.status === 0 || !cachedPlaceholderRun.stderr.includes('placeholder is forbidden')) {
    throw new Error(`cached-public-key-placeholder: validator should reject HTML injection tokens\n${cachedPlaceholderRun.stdout}${cachedPlaceholderRun.stderr}`);
  }
  console.log('PASS cached-public-key-placeholder: rejected');

  const cachedConfigFile = path.join(tempRoot, 'cached-runtime-config.html');
  fs.writeFileSync(cachedConfigFile, checkoutFixture().replace(", { cache: 'no-store' }", ''));
  const cachedConfigRun = spawnSync(process.execPath, [validator, cachedConfigFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (cachedConfigRun.status === 0 || !cachedConfigRun.stderr.includes('cache: "no-store"')) {
    throw new Error(`cached-runtime-config: validator should require a no-store fetch\n${cachedConfigRun.stdout}${cachedConfigRun.stderr}`);
  }
  console.log('PASS cached-runtime-config: rejected');

  const brokenLabelFile = path.join(tempRoot, 'broken-label-reference.html');
  fs.writeFileSync(brokenLabelFile, checkoutFixture().replace('id="expiration-label"', 'id="expiration-label-new"'));
  const brokenLabelRun = spawnSync(process.execPath, [validator, brokenLabelFile, runtimeConfigServer, checkoutEntryFile], { encoding: 'utf8' });
  if (brokenLabelRun.status === 0 || !brokenLabelRun.stderr.includes('expirationDate: aria-labelledby must resolve')) {
    throw new Error(`broken-label-reference: validator should reject an unresolved label id\n${brokenLabelRun.stdout}${brokenLabelRun.stderr}`);
  }
  console.log('PASS broken-label-reference: rejected');

  const inlineCheckoutFile = path.join(tempRoot, 'inline-checkout.html');
  fs.writeFileSync(inlineCheckoutFile, checkoutFixture());
  const inlineCheckoutRun = spawnSync(process.execPath, [validator, inlineCheckoutFile, runtimeConfigServer, inlineCheckoutFile], { encoding: 'utf8' });
  if (inlineCheckoutRun.status === 0 || !inlineCheckoutRun.stderr.includes('must be a separate file')) {
    throw new Error(`inline-checkout: validator should reject a checkout form in the CTA file\n${inlineCheckoutRun.stdout}${inlineCheckoutRun.stderr}`);
  }
  console.log('PASS inline-checkout: rejected');

  const apiCtaFile = path.join(tempRoot, 'checkout-api-cta.html');
  fs.writeFileSync(apiCtaFile, '<a data-mp-checkout-cta="checkout-api" href="/checkout/payment">Finalizar compra</a>');
  const apiCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-api', apiCtaFile, '/checkout/payment'], { encoding: 'utf8' });
  if (apiCtaRun.status !== 0) throw new Error(`checkout-api-cta: ${apiCtaRun.stderr}`);
  console.log('PASS checkout-api-cta: accepted');

  const namedHandlerCtaFile = path.join(tempRoot, 'named-handler-checkout-api-cta.tsx');
  fs.writeFileSync(namedHandlerCtaFile, `const openCheckout = () => navigate('/checkout/payment');
    export const Cart = () => <button data-mp-checkout-cta="checkout-api" onClick={openCheckout}>Finalizar compra</button>;`);
  const namedHandlerCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-api', namedHandlerCtaFile, '/checkout/payment'], { encoding: 'utf8' });
  if (namedHandlerCtaRun.status !== 0) throw new Error(`named-handler-checkout-api-cta: ${namedHandlerCtaRun.stderr}`);
  console.log('PASS named-handler-checkout-api-cta: accepted');

  const externalListenerCtaFile = path.join(tempRoot, 'external-listener-checkout-api-cta.html');
  fs.writeFileSync(externalListenerCtaFile, `<button class="checkout-entry" data-mp-checkout-cta="checkout-api">Finalizar compra</button>
    <script>document.querySelector('.checkout-entry').addEventListener('click', () => window.location.assign('/checkout/payment'));</script>`);
  const externalListenerCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-api', externalListenerCtaFile, '/checkout/payment'], { encoding: 'utf8' });
  if (externalListenerCtaRun.status !== 0) throw new Error(`external-listener-checkout-api-cta: ${externalListenerCtaRun.stderr}`);
  console.log('PASS external-listener-checkout-api-cta: accepted');

  const unwiredApiCtaFile = path.join(tempRoot, 'unwired-checkout-api-cta.html');
  fs.writeFileSync(unwiredApiCtaFile, '<button data-mp-checkout-cta="checkout-api">Finalizar compra</button><a href="/checkout/payment">Ajuda</a>');
  const unwiredApiCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-api', unwiredApiCtaFile, '/checkout/payment'], { encoding: 'utf8' });
  if (unwiredApiCtaRun.status === 0 || !unwiredApiCtaRun.stderr.includes('marked CTA does not reference destination')) {
    throw new Error(`unwired-checkout-api-cta: validator should reject an unrelated destination\n${unwiredApiCtaRun.stdout}${unwiredApiCtaRun.stderr}`);
  }
  console.log('PASS unwired-checkout-api-cta: rejected');

  const proCtaFile = path.join(tempRoot, 'checkout-pro-cta.html');
  fs.writeFileSync(proCtaFile, '<form action="/checkout" method="POST"><button type="submit" data-mp-checkout-cta="checkout-pro">Pagar com Mercado Pago</button></form>');
  const proCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-pro', proCtaFile, '/checkout'], { encoding: 'utf8' });
  if (proCtaRun.status !== 0) throw new Error(`checkout-pro-cta: ${proCtaRun.stderr}`);
  console.log('PASS checkout-pro-cta: accepted');

  const invalidLocalProServer = path.join(tempRoot, 'invalid-local-checkout-pro.mjs');
  fs.writeFileSync(invalidLocalProServer, `
    const BASE = process.env.APP_URL || 'http://localhost:3000';
    app.post('/checkout/preferences', async () => {
      const preference = await preferenceClient.create({ body: {
        back_urls: { success: BASE + '/success' }, auto_return: 'approved'
      }});
      return preference.init_point;
    });
  `);
  const invalidLocalProRun = spawnSync(process.execPath, [proServerValidator, invalidLocalProServer], { encoding: 'utf8' });
  if (invalidLocalProRun.status === 0 || !invalidLocalProRun.stderr.includes('public HTTPS APP_URL')) {
    throw new Error(`checkout-pro-local-auto-return: validator should reject unconditional auto_return\n${invalidLocalProRun.stdout}${invalidLocalProRun.stderr}`);
  }
  console.log('PASS checkout-pro-local-auto-return: rejected');

  const validConditionalProServer = path.join(tempRoot, 'valid-conditional-checkout-pro.mjs');
  fs.writeFileSync(validConditionalProServer, `
    const appUrl = process.env.APP_URL?.trim();
    const publicAppUrl = Boolean(appUrl && /^https:\\/\\//i.test(appUrl) && !/localhost|127\\.0\\.0\\.1/.test(appUrl));
    app.post('/checkout/preferences', async () => {
      const preference = await preferenceClient.create({ body: {
        back_urls: { success: (appUrl || 'http://localhost:3000') + '/success' },
        ...(publicAppUrl ? { auto_return: 'approved' } : {})
      }});
      return preference.init_point;
    });
  `);
  const validConditionalProRun = spawnSync(process.execPath, [proServerValidator, validConditionalProServer], { encoding: 'utf8' });
  if (validConditionalProRun.status !== 0) {
    throw new Error(`checkout-pro-public-auto-return: conditional guard should pass\n${validConditionalProRun.stdout}${validConditionalProRun.stderr}`);
  }
  console.log('PASS checkout-pro-public-auto-return: accepted');

  const missingCtaFile = path.join(tempRoot, 'missing-cta.html');
  fs.writeFileSync(missingCtaFile, '<button>Continuar</button>');
  const missingCtaRun = spawnSync(process.execPath, [ctaValidator, 'checkout-api', missingCtaFile, '/checkout/payment'], { encoding: 'utf8' });
  if (missingCtaRun.status === 0 || !missingCtaRun.stderr.includes('expected exactly one')) {
    throw new Error(`missing-cta: validator should reject an unwired checkout\n${missingCtaRun.stdout}${missingCtaRun.stderr}`);
  }
  console.log('PASS missing-cta: rejected');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
