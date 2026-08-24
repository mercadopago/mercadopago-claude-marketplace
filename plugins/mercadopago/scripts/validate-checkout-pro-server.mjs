#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node validate-checkout-pro-server.mjs <server-file>');
  process.exit(2);
}

const absolute = path.resolve(target);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
  console.error(`Checkout Pro server file not found: ${absolute}`);
  process.exit(2);
}

const source = fs.readFileSync(absolute, 'utf8');
const failures = [];

if (!/checkout\/preferences|create[-_ ]?preference|new\s+Preference\b|preferenceClient/i.test(source)) {
  failures.push('preference-creation route or client was not found');
}
if (!/\binit_point\b/.test(source)) failures.push('server must return or redirect to init_point');
if (/\bsandbox_init_point\b/.test(source)) failures.push('sandbox_init_point is forbidden');

for (const match of source.matchAll(/auto_return\s*:\s*["']approved["']/gi)) {
  const context = source.slice(Math.max(0, match.index - 1400), Math.min(source.length, match.index + 700));
  const localFallback = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(source);
  const publicUrlCheck = /https:\\?\/\\?\//i.test(context)
    && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(context);
  const conditional = /(?:\?|\bif\s*\()[\s\S]*auto_return|auto_return[\s\S]*(?:\?|:\s*\{\s*\})/i.test(context);
  if (localFallback && (!publicUrlCheck || !conditional)) {
    failures.push('auto_return="approved" must be conditional on a public HTTPS APP_URL and omitted for localhost');
  }
}

if (failures.length) {
  console.error(`Checkout Pro server validation failed: ${path.relative(process.cwd(), absolute)}`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Checkout Pro server validation passed: ${path.relative(process.cwd(), absolute)}`);
