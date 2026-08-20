#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [clientFileValue, marker = 'data-mp-qr-cta="create-order"', createRoute = '/api/qr/orders'] = process.argv.slice(2);
if (!clientFileValue) {
  console.error('Usage: node validate-qr-client.mjs <client-file> [cta-marker] [create-route]');
  process.exit(2);
}

const clientFile = path.resolve(clientFileValue);
if (!fs.existsSync(clientFile) || !fs.statSync(clientFile).isFile()) {
  console.error(`QR client file not found: ${clientFile}`);
  process.exit(2);
}

const source = fs.readFileSync(clientFile, 'utf8');
const failures = [];
const requiredStatuses = ['created', 'processed', 'canceled', 'expired', 'refunded'];

if (!source.includes(marker)) failures.push(`must preserve and mark the QR CTA with ${marker}`);
if (!source.includes(createRoute)) failures.push(`must create the QR order through ${createRoute}`);
if (!/method\s*:\s*['"]POST['"]/i.test(source)) failures.push('QR order creation must use POST');
if (!/qrData|qr_data/.test(source)) failures.push('must render QR data returned for dynamic and hybrid modes');
if (!/staticQrImage|static_qr_image|MP_QR_STATIC_IMAGE/.test(source)) failures.push('must support the POS QR image used by static mode');
if (!/new\s+QRCode\s*\(|QRCode\.to|toDataURL\s*\(|createQr/i.test(source)) failures.push('must encode QR data locally');
if (!/api\/qr\/orders\/[^'"`]*\$?\{?|api\/qr\/orders\/['"]\s*\+/i.test(source)) failures.push('must poll or reconcile the QR order by ID');
if (!/api\/qr\/orders\/[^\n]*\/cancel/.test(source)) failures.push('must cancel a created QR order when the buyer abandons it');
for (const status of requiredStatuses) {
  if (!new RegExp(`['"]${status}['"]`).test(source)) failures.push(`must handle the ${status} QR status explicitly`);
}
if (/api\.qrserver\.com|chart\.googleapis\.com/.test(source)) failures.push('must not send QR data to an external QR-image service');
if (/checkout_url|init_point|sandbox_init_point/.test(source)) failures.push('must not redirect to Checkout Pro or encode a checkout URL');
if (/\/create-order['"`]/.test(source) && !source.includes('/api/qr/orders')) failures.push('legacy create-order route must be replaced');

if (failures.length) {
  console.error(`QR client validation failed for ${clientFile}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  file: clientFile,
  ctaLinked: true,
  localQrEncoding: true,
  statusesHandled: requiredStatuses,
}, null, 2));
