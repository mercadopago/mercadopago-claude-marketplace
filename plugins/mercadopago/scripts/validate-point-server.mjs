#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [serverFileValue] = process.argv.slice(2);
if (!serverFileValue) {
  console.error('Usage: node validate-point-server.mjs <server-file>');
  process.exit(2);
}

const serverFile = path.resolve(serverFileValue);
if (!fs.existsSync(serverFile) || !fs.statSync(serverFile).isFile()) {
  console.error(`Point server file not found: ${serverFile}`);
  process.exit(2);
}

const source = fs.readFileSync(serverFile, 'utf8');
const compact = source.replace(/\s+/g, ' ');
const failures = [];

function requirePattern(pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/orders(?:[`'"/]|\$\{)/, 'must call the Orders API at /v1/orders');
requirePattern(/type\s*:\s*['"]point['"]/, 'Point order must use type: "point"');
requirePattern(/config\s*:\s*\{[\s\S]*?point\s*:\s*\{[\s\S]*?terminal_id\s*:/, 'must send config.point.terminal_id');
requirePattern(/['"]X-Idempotency-Key['"]\s*:/i, 'must send X-Idempotency-Key');
requirePattern(/external_reference\s*:/, 'must send an external_reference');
requirePattern(/\.toFixed\(2\)|amount\s*:\s*['"]\d+\.\d{2}['"]/, 'payment amount must be formatted with exactly two decimals');
requirePattern(/MP_POINT_TERMINAL_ID/, 'production terminal must be configurable through MP_POINT_TERMINAL_ID');
requirePattern(/MP_POINT_TEST_MODE/, 'virtual terminal must be guarded by explicit MP_POINT_TEST_MODE');
requirePattern(/NEWLAND_N950__SBX0000001/, 'hardware-free test mode must support the standard virtual terminal');
requirePattern(/api\.mercadopago\.com\/v1\/orders\/\$\{|api\.mercadopago\.com\/v1\/orders\/['"]\s*\+/, 'must expose or implement order lookup by ID for status reconciliation');

forbidPattern(/\/point\/integration-api\//, 'legacy Point Integration API is forbidden; use Orders API');
forbidPattern(/payment-intents?/, 'Payment Intents is forbidden in a new Point scaffold');
forbidPattern(/type\s*:\s*['"](?:instore|online)['"]/, 'Point order must not use type: "instore" or "online"');
forbidPattern(/config\s*:\s*\{[\s\S]*?device\s*:\s*\{/, 'config.device is obsolete; use config.point.terminal_id');
forbidPattern(/default_installments\s*:/, 'config.payment_method.default_installments is not supported by the generic Point scaffold');

const unsafeFallbacks = [
  /MP_POINT_TERMINAL_ID[^\n;]*\|\|[^\n;]*NEWLAND_N950__SBX0000001/,
  /MP_POINT_TERMINAL_ID[^\n;]*\?\?[^\n;]*NEWLAND_N950__SBX0000001/,
];
if (unsafeFallbacks.some(pattern => pattern.test(compact))) {
  failures.push('virtual terminal fallback must be conditional on MP_POINT_TEST_MODE, never unconditional');
}

if (failures.length) {
  console.error(`Point server validation failed for ${serverFile}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  file: serverFile,
  ordersApi: true,
  virtualTerminalGuarded: true,
  idempotency: true,
  orderLookup: true,
}, null, 2));
