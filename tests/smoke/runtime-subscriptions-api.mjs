#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [sellerCredentialsPath, artifactDirectory] = process.argv.slice(2);
if (!sellerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-subscriptions-api.mjs <seller.env> <artifact-directory>');
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

const credentials = parseEnv(path.resolve(sellerCredentialsPath));
if (!credentials.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });
const headers = { Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

const report = {
  status: 'running',
  sellerProfile: 'seller-a',
  mutatingCallsAttempted: 1,
  resourcesCreated: 0,
  checks: [],
};

try {
  for (const [name, url] of [
    ['plan-search', 'https://api.mercadopago.com/preapproval_plan/search?status=active&limit=1'],
    ['subscription-search', 'https://api.mercadopago.com/preapproval/search?limit=1'],
  ]) {
    const response = await fetch(url, { headers });
    const payload = await parse(response);
    if (!response.ok) throw new Error(`${name} failed with HTTP ${response.status}: ${payload.message || payload.error || 'unknown error'}`);
    report.checks.push({
      name,
      status: response.status,
      resultCount: Array.isArray(payload.results) ? payload.results.length : null,
      hasPaging: Boolean(payload.paging),
      passed: true,
    });
    console.log(`PASS Subscriptions API ${name}`);
  }

  // Deliberately invalid status: exercises current create-schema rejection without
  // creating a plan, subscription, invoice, or payment.
  const invalidResponse = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers,
    body: JSON.stringify({ status: '__mp_smoke_invalid_status__' }),
  });
  const invalidPayload = await parse(invalidResponse);
  if (invalidResponse.ok || invalidPayload.id) {
    throw new Error('Invalid preapproval probe unexpectedly created a resource');
  }
  if (![400, 401, 403, 422].includes(invalidResponse.status)) {
    throw new Error(`Invalid preapproval probe returned unexpected HTTP ${invalidResponse.status}`);
  }
  report.checks.push({
    name: 'invalid-create-rejected',
    status: invalidResponse.status,
    apiCode: invalidPayload.code || invalidPayload.error || null,
    passed: true,
  });
  console.log(`PASS Subscriptions API invalid create rejected (${invalidResponse.status})`);

  report.status = 'passed';
  fs.writeFileSync(path.join(artifacts, 'subscriptions-api.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('PASS Subscriptions read-only/schema runtime; no resources or charges created');
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  fs.writeFileSync(path.join(artifacts, 'subscriptions-api-failure.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  throw error;
}
