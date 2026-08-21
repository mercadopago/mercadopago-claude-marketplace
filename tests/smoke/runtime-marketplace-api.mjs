#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [sellerCredentialsPath, artifactDirectory] = process.argv.slice(2);
if (!sellerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-marketplace-api.mjs <seller.env> <artifact-directory>');
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

const credentials = parseEnv(path.resolve(sellerCredentialsPath));
if (!credentials.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');
const artifacts = path.resolve(artifactDirectory);
fs.mkdirSync(artifacts, { recursive: true });
const report = { status: 'running', sellerProfile: 'seller-a', mutatingCallsAttempted: 0, resourcesCreated: 0, checks: [] };

try {
  const userResponse = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}` } });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user.id) throw new Error(`Seller identity failed with HTTP ${userResponse.status}`);
  report.checks.push({ name: 'seller-identity', status: userResponse.status, userIdSuffix: String(user.id).slice(-6), siteId: user.site_id || null, passed: true });
  console.log('PASS Marketplace API seller A identity');

  const methodsResponse = await fetch('https://api.mercadopago.com/v1/payment_methods', { headers: { Authorization: `Bearer ${credentials.MP_ACCESS_TOKEN}` } });
  const methods = await methodsResponse.json().catch(() => []);
  if (!methodsResponse.ok || !Array.isArray(methods)) throw new Error(`Payment methods failed with HTTP ${methodsResponse.status}`);
  report.checks.push({ name: 'seller-payment-methods', status: methodsResponse.status, count: methods.length, passed: true });
  console.log('PASS Marketplace API seller A payment methods');

  report.status = 'passed';
  report.oauthLiveTest = 'not-run: MP_APP_ID and MP_CLIENT_SECRET intentionally absent; seller consent is required';
  fs.writeFileSync(path.join(artifacts, 'marketplace-api.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('PASS Marketplace read-only API runtime; no resources or charges created');
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  fs.writeFileSync(path.join(artifacts, 'marketplace-api-failure.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  throw error;
}
