#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [sellerCredentialsPath, artifactDirectory, maxAmountValue = '1'] = process.argv.slice(2);
if (!sellerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-payouts-api.mjs <seller.env> <artifact-directory> [max-test-amount]');
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

async function parse(response) {
  return response.json().catch(() => ({}));
}

const amount = Number(maxAmountValue);
if (!Number.isFinite(amount) || amount < 1 || amount > 10) {
  throw new Error('max-test-amount must be between 1 and 10 ARS');
}

const credentials = parseEnv(path.resolve(sellerCredentialsPath));
if (!credentials.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });

const report = {
  status: 'running',
  sellerProfile: 'seller-a',
  country: 'AR',
  testMode: true,
  amountCeiling: amount,
  mutatingCallsAttempted: 0,
  testResourcesCreated: 0,
  realFundsRisk: 'disabled by X-test-token:true',
  checks: [],
};

try {
  const identityResponse = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}` },
  });
  const identity = await parse(identityResponse);
  if (!identityResponse.ok || !identity.id) throw new Error(`Seller identity failed with HTTP ${identityResponse.status}`);
  if (identity.site_id !== 'MLA') throw new Error(`Payouts runtime is pinned to Argentina/MLA, got ${identity.site_id || 'unknown'}`);
  report.checks.push({ name: 'seller-a-identity', status: identityResponse.status, siteId: identity.site_id, userIdSuffix: String(identity.id).slice(-6), passed: true });
  console.log('PASS Payouts seller A identity (MLA)');

  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const externalReference = `smoke-payout-${suffix}`.slice(0, 64);
  const transactionReference = `smoke-txn-${suffix}`.slice(0, 64);
  const idempotencyKey = crypto.randomUUID();
  const payload = {
    external_reference: externalReference,
    description: 'Mercado Pago plugin Payouts smoke test',
    transactions: [{
      type: 'account',
      description: 'Official Argentina test destination',
      account: { email: 'test_user_ar@testuser.com' },
      amount: { currency: 'ARS', value: amount },
      external_reference: transactionReference,
    }],
  };

  report.mutatingCallsAttempted = 1;
  const createResponse = await fetch('https://api.mercadopago.com/v1/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-enforce-signature': 'false',
      'X-test-token': 'true',
    },
    body: JSON.stringify(payload),
  });
  const created = await parse(createResponse);
  if (createResponse.status !== 202 || !created.id || !String(created.id).startsWith('POP')) {
    throw new Error(`Test Payouts creation failed with HTTP ${createResponse.status}: ${created.message || created.error || created.code || 'unknown error'}`);
  }
  const transactionIds = Array.isArray(created.transactions) ? created.transactions.map(item => item.id).filter(Boolean) : [];
  if (!transactionIds.length) throw new Error('Test Payouts response did not include a transaction ID');
  report.testResourcesCreated = 1;
  report.checks.push({ name: 'test-payout-created', status: createResponse.status, payoutId: created.id, transactionCount: transactionIds.length, payoutStatus: created.status || null, passed: true });
  console.log(`PASS Payouts test batch accepted (${created.id})`);

  const lookupResponse = await fetch(`https://api.mercadopago.com/v1/payouts/${encodeURIComponent(created.id)}`, {
    headers: {
      Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}`,
      'X-test-token': 'true',
    },
  });
  const lookup = await parse(lookupResponse);
  if (!lookupResponse.ok || lookup.id !== created.id) {
    throw new Error(`Test Payouts lookup failed with HTTP ${lookupResponse.status}: ${lookup.message || lookup.error || 'unknown error'}`);
  }
  report.checks.push({ name: 'test-payout-lookup', status: lookupResponse.status, payoutId: lookup.id, payoutStatus: lookup.status || null, passed: true });
  console.log('PASS Payouts test batch lookup');

  report.status = 'passed';
  fs.writeFileSync(path.join(artifacts, 'payouts-api.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('PASS Payouts runtime in explicit test mode; no real funds moved');
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  fs.writeFileSync(path.join(artifacts, 'payouts-api-failure.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  throw error;
}
