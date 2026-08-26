#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aliases = new Map([
  ['checkout-pro', 'checkout-pro'],
  ['checkout_api', 'checkout-api'],
  ['checkout-api', 'checkout-api'],
  ['checkout-api-orders', 'checkout-api'],
  ['checkout-transparente', 'checkout-api'],
  ['checkout-transparent', 'checkout-api'],
]);

const rawProduct = String(process.argv[2] || '').trim().toLowerCase();
const projectRoot = path.resolve(process.argv[3] || '.');
const product = aliases.get(rawProduct);

if (!product) {
  console.error('Usage: node resolve-checkout-cta.mjs <checkout-pro|checkout-api> [project-root]');
  process.exit(2);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const detector = path.join(scriptDir, 'detect-checkout-cta.mjs');
const run = spawnSync(process.execPath, [detector, projectRoot], { encoding: 'utf8' });

if (run.status !== 0) {
  process.stderr.write(run.stderr || 'Checkout CTA detector failed\n');
  process.exit(run.status || 1);
}

let detection;
try {
  detection = JSON.parse(run.stdout);
} catch (error) {
  console.error(`Checkout CTA detector returned invalid JSON: ${error.message}`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({
  product,
  requestedProduct: rawProduct,
  requiresUserSelection: detection.status !== 'selected',
  nextAction: detection.status === 'selected'
    ? 'wire_selected_cta'
    : 'ask_user_for_cta_or_insertion_location',
  ...detection,
}, null, 2)}\n`);
