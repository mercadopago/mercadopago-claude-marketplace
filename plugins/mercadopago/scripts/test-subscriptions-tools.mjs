#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, 'validate-subscriptions-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-subscriptions-tools-'));

const serverBase = `
  const port = process.env.PORT || 3000;
  const SUBSCRIPTION_OFFERS = { monthly: { reason: 'Monthly club', amount: 100, currency: 'ARS', frequency: 1, frequencyType: 'months' } };
  const trustedOffer = SUBSCRIPTION_OFFERS[offerId];
  const external_reference = crypto.randomUUID();
  const subscriptionBackUrl = (process.env.APP_URL || 'http://localhost:' + port) + '/subscription/result';
  app.get('/api/mp-config', (req, res) => res.set('Cache-Control', 'no-store, max-age=0').json({ publicKey: process.env.MP_PUBLIC_KEY }));
  app.get('/api/subscriptions/:id', async (req, res) => fetch('https://api.mercadopago.com/preapproval/' + req.params.id));
  app.put('/api/subscriptions/:id/action', async (req, res) => {
    const statuses = { pause: 'paused', reactivate: 'authorized', cancel: 'canceled' };
    if (!statuses[req.body.action]) return res.status(400).json({ error: 'invalid action' });
    return fetch('https://api.mercadopago.com/preapproval/' + req.params.id, { method: 'PUT', body: JSON.stringify({ status: statuses[req.body.action] }) });
  });
  app.listen(port);
`;

const stateMarkup = '<p>Inicializando...</p><p>Procesando...</p><p>Suscripción activada con éxito</p><p>Error: intentá nuevamente</p><p>pending authorized paused canceled</p>';
const authorizedClient = model => `
  <main data-mp-subscriptions-page="${model}">${stateMarkup}
  <form id="subscription-card-form">
    <span id="card-number-label">Número de tarjeta</span><div id="cardNumber" data-mp-secure-field="cardNumber"></div>
    <span>Vencimiento</span><div id="expirationDate" data-mp-secure-field="expirationDate"></div>
    <span>Código de seguridad</span><div id="securityCode" data-mp-secure-field="securityCode"></div>
    <label for="cardholderName">Nombre</label><input id="cardholderName">
    <select hidden aria-hidden="true" tabindex="-1" id="issuer" data-mp-sdk-required-field="issuer"></select>
    <select hidden aria-hidden="true" tabindex="-1" id="installments" data-mp-sdk-required-field="installments"></select>
    <select hidden aria-hidden="true" tabindex="-1" id="identificationType" data-mp-sdk-required-field="identificationType"></select>
    <button data-mp-subscription-cta="${model}">Suscribirme</button>
  </form></main>
  <script>let processing = false; fetch('/api/mp-config', { cache: 'no-store' }); mp.cardForm({ form: { issuer: { id: 'issuer' }, installments: { id: 'installments' }, identificationType: { id: 'identificationType' } } });</script>
`;

function runCase(name, model, files, expectedStatus, expectedMessage = '') {
  const root = path.join(temporaryDirectory, name);
  fs.mkdirSync(root);
  for (const [filename, source] of Object.entries(files)) fs.writeFileSync(path.join(root, filename), source);
  const result = spawnSync(process.execPath, [validator, root, model], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

try {
  runCase('valid-with-plan', 'with-plan', {
    'server.js': `${serverBase}
      const MP_SUBSCRIPTION_PLAN_ID = process.env.MP_SUBSCRIPTION_PLAN_ID;
      fetch('https://api.mercadopago.com/preapproval', { method: 'POST', body: JSON.stringify({
        preapproval_plan_id: MP_SUBSCRIPTION_PLAN_ID, payer_email: trustedPayer.email,
        card_token_id: singleUseCardToken, external_reference, back_url: subscriptionBackUrl, status: 'authorized'
      }) });`,
    'checkout.html': authorizedClient('with-plan'),
  }, 0);

  runCase('valid-without-plan-authorized', 'without-plan-authorized', {
    'server.js': `${serverBase}
      fetch('https://api.mercadopago.com/preapproval', { method: 'POST', body: JSON.stringify({
        reason: trustedOffer.reason, payer_email: trustedPayer.email, card_token_id: singleUseCardToken,
        external_reference, back_url: subscriptionBackUrl, status: 'authorized', auto_recurring: {
          frequency: trustedOffer.frequency, frequency_type: trustedOffer.frequencyType,
          transaction_amount: trustedOffer.amount, currency_id: trustedOffer.currency
        }
      }) });`,
    'checkout.html': authorizedClient('without-plan-authorized'),
  }, 0);

  runCase('valid-without-plan-pending', 'without-plan-pending', {
    'server.js': `${serverBase}
      fetch('https://api.mercadopago.com/preapproval', { method: 'POST', body: JSON.stringify({
        reason: trustedOffer.reason, payer_email: trustedPayer.email, external_reference,
        back_url: subscriptionBackUrl, status: 'pending', auto_recurring: {
          frequency: trustedOffer.frequency, frequency_type: trustedOffer.frequencyType,
          transaction_amount: trustedOffer.amount, currency_id: trustedOffer.currency
        }
      }) }).then(result => result.init_point);`,
    'checkout.html': `<main data-mp-subscriptions-page="without-plan-pending">${stateMarkup}<button data-mp-subscription-cta="without-plan-pending" disabled="${'${processing}'}">Suscribirme</button></main><script>let processing = false; location.assign(result.init_point);</script>`,
  }, 0);

  runCase('manual-token-field', 'with-plan', {
    'server.js': `${serverBase} const MP_SUBSCRIPTION_PLAN_ID = process.env.MP_SUBSCRIPTION_PLAN_ID; fetch('https://api.mercadopago.com/preapproval', { body: JSON.stringify({ preapproval_plan_id: MP_SUBSCRIPTION_PLAN_ID, payer_email: trustedPayer.email, card_token_id: token, external_reference, back_url: subscriptionBackUrl, status: 'authorized' }) });`,
    'checkout.html': `${authorizedClient('with-plan')}<input id="card_token">`,
  }, 1, 'manual card-token input');

  runCase('pending-with-token', 'without-plan-pending', {
    'server.js': `${serverBase} fetch('https://api.mercadopago.com/preapproval', { body: JSON.stringify({ reason: trustedOffer.reason, payer_email: trustedPayer.email, card_token_id: token, external_reference, back_url: subscriptionBackUrl, status: 'pending', auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: trustedOffer.amount, currency_id: trustedOffer.currency } }) });`,
    'checkout.html': `<main data-mp-subscriptions-page="without-plan-pending">${stateMarkup}<button data-mp-subscription-cta="without-plan-pending" disabled>Suscribirme</button><span>init_point</span></main>`,
  }, 1, 'must not tokenize or send a card token');

  runCase('client-plan-id', 'with-plan', {
    'server.js': `${serverBase} const MP_SUBSCRIPTION_PLAN_ID = req.body.plan_id; fetch('https://api.mercadopago.com/preapproval', { body: JSON.stringify({ preapproval_plan_id: MP_SUBSCRIPTION_PLAN_ID, payer_email: trustedPayer.email, card_token_id: token, external_reference, back_url: subscriptionBackUrl, status: 'authorized' }) });`,
    'checkout.html': authorizedClient('with-plan'),
  }, 1, 'must not trust plan ID');

  runCase('disabled-sdk-select', 'without-plan-authorized', {
    'server.js': `${serverBase} fetch('https://api.mercadopago.com/preapproval', { body: JSON.stringify({ reason: trustedOffer.reason, payer_email: trustedPayer.email, card_token_id: token, external_reference, back_url: subscriptionBackUrl, status: 'authorized', auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: trustedOffer.amount, currency_id: trustedOffer.currency } }) });`,
    'checkout.html': authorizedClient('without-plan-authorized').replace('id="issuer" data-mp-sdk-required-field="issuer"', 'id="issuer" data-mp-sdk-required-field="issuer" disabled'),
  }, 1, 'must be hidden, never disabled');

  runCase('duplicate-preapproval-creators', 'with-plan', {
    'server.js': `${serverBase}
      const MP_SUBSCRIPTION_PLAN_ID = process.env.MP_SUBSCRIPTION_PLAN_ID;
      fetch('https://api.mercadopago.com/preapproval', { method: 'POST', body: JSON.stringify({ preapproval_plan_id: MP_SUBSCRIPTION_PLAN_ID, payer_email: trustedPayer.email, card_token_id: token, external_reference, back_url: subscriptionBackUrl, status: 'authorized' }) });
      mpFetch('POST', 'https://api.mercadopago.com/preapproval', { status: 'pending' });`,
    'checkout.html': authorizedClient('with-plan'),
  }, 1, 'exactly one preapproval creation path');

  runCase('legacy-entry-handler', 'without-plan-pending', {
    'server.js': `${serverBase} fetch('https://api.mercadopago.com/preapproval', { method: 'POST', body: JSON.stringify({ reason: trustedOffer.reason, payer_email: trustedPayer.email, external_reference, back_url: subscriptionBackUrl, status: 'pending', auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: trustedOffer.amount, currency_id: trustedOffer.currency } }) }).then(result => result.init_point);`,
    'checkout.html': `<main data-mp-subscriptions-page="without-plan-pending">${stateMarkup}<button data-mp-subscription-cta="without-plan-pending" disabled>Suscribirme</button></main><script>let processing = false; location.assign(result.init_point); fetch('/subscribe');</script>`,
  }, 1, 'legacy entry CTAs');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
