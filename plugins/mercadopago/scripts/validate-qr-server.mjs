#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [serverFileValue] = process.argv.slice(2);
if (!serverFileValue) {
  console.error('Usage: node validate-qr-server.mjs <server-file>');
  process.exit(2);
}

const serverFile = path.resolve(serverFileValue);
if (!fs.existsSync(serverFile) || !fs.statSync(serverFile).isFile()) {
  console.error(`QR server file not found: ${serverFile}`);
  process.exit(2);
}

const source = fs.readFileSync(serverFile, 'utf8');
const failures = [];

function requirePattern(pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/orders(?:[`'"/]|$\{)/, 'must create QR payments through POST /v1/orders');
requirePattern(/method\s*:\s*['"]POST['"]/i, 'QR order creation must use POST');
requirePattern(/type\s*:\s*['"]qr['"]/, 'QR order must use type: "qr"');
requirePattern(/total_amount\s*:/, 'must send total_amount');
requirePattern(/transactions\s*:\s*\{[\s\S]*?payments\s*:\s*\[[\s\S]*?amount(?:\s*:|\s*[,}])/, 'must send exactly one payment amount in transactions.payments');
requirePattern(/config\s*:\s*\{[\s\S]*?qr\s*:\s*\{[\s\S]*?external_pos_id\s*:/, 'must send config.qr.external_pos_id');
requirePattern(/config\s*:\s*\{[\s\S]*?qr\s*:\s*\{[\s\S]*?mode\s*:/, 'must send config.qr.mode');
requirePattern(/static[\s\S]*dynamic[\s\S]*hybrid|\[(?:[^\]]*['"](?:static|dynamic|hybrid)['"]){3}[^\]]*\]/, 'must constrain QR mode to static, dynamic, or hybrid');
requirePattern(/['"]X-Idempotency-Key['"]\s*:/i, 'must send X-Idempotency-Key');
requirePattern(/external_reference\s*:/, 'must send a unique external_reference');
requirePattern(/\.toFixed\(2\)/, 'QR amount must be formatted with exactly two decimals');
requirePattern(/Number\.isFinite\s*\(/, 'must reject non-finite client-supplied amounts');
requirePattern(/(?:<=\s*0|<\s*1|>\s*0)/, 'must reject zero or negative client-supplied amounts');
requirePattern(/type_response\?*\.?\[?['"]?qr_data|type_response\?*\.qr_data|type_response\s*\?\.[\s\S]*qr_data/, 'must read type_response.qr_data for dynamic and hybrid modes');
requirePattern(/api\.mercadopago\.com\/v1\/orders\/\$\{|api\.mercadopago\.com\/v1\/orders\/['"]\s*\+/, 'must implement order lookup by ID');
requirePattern(/v1\/orders\/\$\{[^}]+\}\/cancel|v1\/orders\/['"]\s*\+[^\n]+\/cancel/, 'must implement order cancellation by ID');
requirePattern(/MP_QR_EXTERNAL_POS_ID/, 'POS external ID must be configured through MP_QR_EXTERNAL_POS_ID');
requirePattern(/MP_QR_MODE/, 'QR mode must be configured through MP_QR_MODE');

forbidPattern(/\/instore\/orders\/qr\//, 'legacy Instore Orders QR endpoint is forbidden; use Orders API');
forbidPattern(/\/instore\/qr\//, 'legacy Instore QR lookup is forbidden; use Orders API');
forbidPattern(/type\s*:\s*['"](?:online|instore|point)['"]/, 'QR order must not use type online, instore, or point');
forbidPattern(/payment_method\s*:\s*\{[\s\S]*?type\s*:\s*['"]redirect['"]/, 'QR must not wrap a redirect checkout URL in a QR code');
forbidPattern(/checkout_url|init_point|sandbox_init_point/, 'QR response must expose QR data, not a Checkout redirect URL');
forbidPattern(/api\.qrserver\.com|chart\.googleapis\.com/, 'must not leak QR data to an external QR-image service');
forbidPattern(/items\s*:\s*\[[\s\S]*?total_amount\s*:/, 'items[].total_amount is a legacy QR field and must not be generated');
forbidPattern(/items\s*:\s*[^;\n]*[\s\S]*?currency_id\s*:/, 'items[].currency_id is not supported by the QR Orders contract');
forbidPattern(/payer\s*:\s*\{/, 'generic QR Orders must not invent or preserve a payer object');
forbidPattern(/X-Allow-Cancelable-Status/i, 'X-Allow-Cancelable-Status is Point-specific and must not be sent by QR');

if (failures.length) {
  console.error(`QR server validation failed for ${serverFile}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  file: serverFile,
  ordersApi: true,
  qrModes: ['static', 'dynamic', 'hybrid'],
  idempotency: true,
  lookup: true,
  cancellation: true,
}, null, 2));
