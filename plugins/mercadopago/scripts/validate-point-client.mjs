#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [clientFileValue, marker = 'data-mp-point-cta="create-order"', createRoute = '/api/point/orders'] = process.argv.slice(2);
if (!clientFileValue) {
  console.error('Usage: node validate-point-client.mjs <client-file> [cta-marker] [create-route]');
  process.exit(2);
}

const clientFile = path.resolve(clientFileValue);
if (!fs.existsSync(clientFile) || !fs.statSync(clientFile).isFile()) {
  console.error(`Point client file not found: ${clientFile}`);
  process.exit(2);
}

const source = fs.readFileSync(clientFile, 'utf8');
const failures = [];
const requiredStatuses = ['processed', 'failed', 'refunded', 'canceled', 'expired', 'action_required'];

if (!source.includes(marker)) failures.push(`must preserve and mark the Point CTA with ${marker}`);
if (!source.includes(createRoute)) failures.push(`must create the Point order through ${createRoute}`);
if (!/method\s*:\s*['"]POST['"]/i.test(source)) failures.push('Point order creation must use POST');
if (!/api\/point\/orders\/[^'"`]*\$?\{?|api\/point\/orders\/["']\s*\+/i.test(source)) {
  failures.push('must poll or reconcile the Point order by ID');
}
for (const status of requiredStatuses) {
  if (!new RegExp(`['"]${status}['"]`).test(source)) {
    failures.push(`must handle the ${status} Point status explicitly`);
  }
}
if (/new\s+QRCode\s*\(|function\s+generateQR\s*\(/.test(source)) {
  failures.push('must remove the replaced QR checkout flow');
}

if (failures.length) {
  console.error(`Point client validation failed for ${clientFile}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  file: clientFile,
  ctaLinked: true,
  orderReconciliation: true,
  statusesHandled: requiredStatuses,
}, null, 2));
