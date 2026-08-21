#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'validate-payouts-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-payouts-tools-'));

const shared = `
import crypto from 'node:crypto';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const payoutsTestMode = process.env.MP_PAYOUTS_TEST_MODE === 'true';
const notificationUrl = process.env.MP_PAYOUTS_NOTIFICATION_URL;
const privateKeyPath = process.env.MP_PAYOUTS_PRIVATE_KEY_PATH;
const payoutInstructionRepository = durableFileRepository({ atomic: true, renameSync: true });
const payoutAuditRepository = durableAuditRepository({ atomic: true, renameSync: true });
const terminalStatuses = ['processed', 'failed', 'rejected', 'cancelled'];
function authorizePayoutOperator(req) { if (!req.user?.roles?.includes('payout-operator')) throw new Error('forbidden'); }
function validateNotificationUrl(value) { const url = new URL(value); if (url.protocol !== 'https:') throw new Error('HTTPS required'); return url.toString(); }
function signedHeaders(serializedBody, instruction) {
  const headers = {
    Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`,
    'X-Idempotency-Key': instruction.idempotencyKey,
    'X-test-token': payoutsTestMode ? 'true' : 'false',
    'X-enforce-signature': payoutsTestMode ? 'false' : 'true'
  };
  if (!payoutsTestMode) {
    const privateKey = readSecret(privateKeyPath);
    headers['X-signature'] = crypto.sign(null, Buffer.from(serializedBody), privateKey).toString('base64');
  }
  return headers;
}
function loadInstruction(req) {
  const { instructionId } = req.body;
  const instruction = payoutInstructionRepository.get(instructionId);
  if (!instruction.idempotencyKey) payoutInstructionRepository.save(instructionId, { idempotencyKey: crypto.randomUUID() });
  return payoutInstructionRepository.get(instructionId);
}
`;

const argentina = `${shared}
app.post('/api/payouts', async (req, res) => {
  authorizePayoutOperator(req);
  const instruction = loadInstruction(req);
  if (instruction.transactions.length < 1 || instruction.transactions.length > 1000) throw new Error('batch size');
  for (const transaction of instruction.transactions) if (!(transaction.amount > 0)) throw new Error('amount');
  const payload = {
    external_reference: instruction.externalReference,
    notification_url: validateNotificationUrl(notificationUrl),
    transactions: instruction.transactions.map(transaction => ({
      type: 'account', account: { email: transaction.email },
      amount: { currency: 'ARS', value: transaction.amount },
      external_reference: transaction.externalReference
    }))
  };
  const serializedBody = JSON.stringify(payload);
  const response = await fetch('https://api.mercadopago.com/v1/payouts', { method: 'POST', headers: signedHeaders(serializedBody, instruction), body: serializedBody });
  const payout = await response.json();
  payoutInstructionRepository.update(instruction.id, { payoutId: payout.id, transactionIds: payout.transactions?.map(item => item.id), status: payout.status || 'created' });
  payoutAuditRepository.save({ instructionId: instruction.id, status: payout.status || 'created', at: new Date().toISOString() });
  res.json({ id: payout.id, status: payout.status || 'created', createdAt: payout.date_created });
});
app.get('/api/payouts/:id', async (req, res) => {
  authorizePayoutOperator(req);
  const instruction = payoutInstructionRepository.findByPayoutId(req.params.id);
  const response = await fetch(\`https://api.mercadopago.com/v1/payouts/\${instruction.payoutId}\`, { headers: { Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`, 'X-test-token': payoutsTestMode ? 'true' : 'false' } });
  const payout = await response.json();
  payoutInstructionRepository.update(instruction.id, { status: payout.status });
  payoutAuditRepository.save({ instructionId: instruction.id, status: payout.status, terminal: terminalStatuses.includes(payout.status) });
  res.json({ id: payout.id, status: payout.status, updatedAt: payout.last_modified });
});
`;

const brazil = `${shared}
app.post('/api/payouts', async (req, res) => {
  authorizePayoutOperator(req);
  const instruction = loadInstruction(req);
  const sourceAmount = instruction.amount;
  const destinationAmount = instruction.amount;
  const totalAmount = instruction.amount;
  if (sourceAmount !== destinationAmount || destinationAmount !== totalAmount) throw new Error('amounts must match');
  const payload = {
    external_reference: instruction.externalReference,
    point_of_interaction: { type: 'PSP_TRANSFER' },
    transaction: {
      from: { amount: { currency: 'BRL', value: sourceAmount } },
      to: { bank_account: { account_type: 'current', account_number: instruction.accountNumber }, amount: { currency: 'BRL', value: destinationAmount } },
      total_amount: { currency: 'BRL', value: totalAmount }
    },
    notification_url: validateNotificationUrl(notificationUrl)
  };
  const serializedBody = JSON.stringify(payload);
  const response = await fetch('https://api.mercadopago.com/v1/transaction-intents/process', { method: 'POST', headers: signedHeaders(serializedBody, instruction), body: serializedBody });
  const payout = await response.json();
  payoutInstructionRepository.update(instruction.id, { payoutId: payout.id, transactionId: payout.id, status: payout.status || 'created' });
  payoutAuditRepository.save({ instructionId: instruction.id, status: payout.status || 'created' });
  res.json({ id: payout.id, status: payout.status || 'created', createdAt: payout.date_created });
});
app.get('/api/payouts/:id', async (req, res) => {
  authorizePayoutOperator(req);
  const instruction = payoutInstructionRepository.findByPayoutId(req.params.id);
  const response = await fetch(\`https://api.mercadopago.com/v1/transaction-intents/\${instruction.payoutId}\`, { headers: { Authorization: \`Bearer \${MP_ACCESS_TOKEN}\`, 'X-test-token': payoutsTestMode ? 'true' : 'false' } });
  const payout = await response.json();
  payoutInstructionRepository.update(instruction.id, { status: payout.status });
  payoutAuditRepository.save({ instructionId: instruction.id, status: payout.status, terminal: terminalStatuses.includes(payout.status) });
  res.json({ id: payout.id, status: payout.status, updatedAt: payout.last_modified });
});
`;

const env = 'MP_ACCESS_TOKEN=\nMP_PAYOUTS_TEST_MODE=true\nMP_PAYOUTS_NOTIFICATION_URL=https://example.test/webhooks/payouts\nMP_PAYOUTS_PRIVATE_KEY_PATH=/run/secrets/payouts.pem\n';

function runCase(name, source, country, expectedStatus, expectedMessage = '', extraFiles = {}) {
  const root = path.join(temporaryDirectory, name);
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'payouts-service.js'), source);
  fs.writeFileSync(path.join(root, '.env.example'), env);
  for (const [file, contents] of Object.entries(extraFiles)) fs.writeFileSync(path.join(root, file), contents);
  const result = spawnSync(process.execPath, [validator, root, country], { encoding: 'utf8' });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status !== expectedStatus || (expectedMessage && !output.includes(expectedMessage))) {
    throw new Error(`${name}: expected ${expectedStatus}/${expectedMessage}, got ${result.status}\n${output}`);
  }
  console.log(`PASS ${name}`);
}

try {
  runCase('valid-ar', argentina, 'AR', 0);
  runCase('valid-br', brazil, 'BR', 0);
  runCase('valid-with-existing-checkout-config', argentina, 'AR', 0, '', {
    '.env.example': `${env}MP_PUBLIC_KEY=APP_USR-public\n`,
    'checkout.html': '<script src="https://sdk.mercadopago.com/js/v2"></script><button data-mp-checkout-cta="checkout-pro">Pagar</button>',
  });
  runCase('obsolete-disbursements', argentina.replace('https://api.mercadopago.com/v1/payouts', 'https://api.mercadopago.com/v1/disbursements'), 'AR', 1, 'obsolete disbursements');
  runCase('advanced-payments', argentina.replace('https://api.mercadopago.com/v1/payouts', 'https://api.mercadopago.com/v1/advanced_payments'), 'AR', 1, 'Advanced Payments');
  runCase('browser-amount', argentina.replace('const instruction = loadInstruction(req);', 'const instruction = loadInstruction(req); const amount = req.body.amount;'), 'AR', 1, 'browser must not choose');
  runCase('browser-destination', argentina.replace('const instruction = loadInstruction(req);', 'const instruction = loadInstruction(req); const email = req.body.email;'), 'AR', 1, 'browser must not choose');
  runCase('missing-operator-guard', argentina.replaceAll('authorizePayoutOperator(req);', ''), 'AR', 1, 'authorization guard');
  runCase('memory-repository', argentina.replace('durableFileRepository({ atomic: true, renameSync: true })', 'new Map()'), 'AR', 1, 'must be durable');
  runCase('missing-idempotency', argentina.replace("'X-Idempotency-Key': instruction.idempotencyKey,", ''), 'AR', 1, 'X-Idempotency-Key');
  runCase('hardcoded-test-mode', argentina.replaceAll("'X-test-token': payoutsTestMode ? 'true' : 'false'", "'X-test-token': 'true'"), 'AR', 1, 'must derive from MP_PAYOUTS_TEST_MODE');
  runCase('missing-signature', argentina.replace("headers['X-signature'] = crypto.sign(null, Buffer.from(serializedBody), privateKey).toString('base64');", ''), 'AR', 1, 'X-signature');
  runCase('different-signed-body', argentina.replace('crypto.sign(null, Buffer.from(serializedBody)', "crypto.sign(null, Buffer.from('different')"), 'AR', 1, 'exact serialized request body');
  runCase('wrong-country-ar', brazil, 'AR', 1, 'Argentina must create');
  runCase('wrong-country-br', argentina, 'BR', 1, 'Brazil must create');
  runCase('missing-lookup', argentina.replace(/app\.get\('\/api\/payouts\/:id'[\s\S]*$/, ''), 'AR', 1, 'GET /api/payouts/:id');
  runCase('unsafe-response', argentina.replace("res.json({ id: payout.id, status: payout.status || 'created', createdAt: payout.date_created });", "res.json({ id: payout.id, status: payout.status, account: instruction.transactions[0].account });"), 'AR', 1, 'must not expose destination');
  runCase('payout-checkout-ui', argentina, 'AR', 1, 'must not add Checkout UI', {
    'payouts.html': '<script src="https://sdk.mercadopago.com/js/v2"></script><button data-mp-checkout-cta="payout">Payout</button><script>fetch("/api/payouts")</script>',
  });
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
