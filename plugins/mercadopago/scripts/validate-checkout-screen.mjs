#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
const configTarget = process.argv[3];
const ctaTarget = process.argv[4];
if (!target) {
  console.error('Usage: node validate-checkout-screen.mjs <checkout-screen-file> [runtime-config-server-file] <cta-file>');
  process.exit(2);
}

const absolute = path.resolve(target);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
  console.error(`Checkout screen not found: ${absolute}`);
  process.exit(2);
}

const rawSource = fs.readFileSync(absolute, 'utf8');
const markdownHtml = rawSource.match(/```html\s*\n([\s\S]*?)```/i);
const source = markdownHtml ? markdownHtml[1] : rawSource;
const requiredFields = [
  'cardNumber',
  'expirationDate',
  'securityCode',
  'cardholderName',
];
const secureFields = ['cardNumber', 'expirationDate', 'securityCode'];
const cardFormLifecycleFields = ['issuer', 'installments', 'identificationType'];
const failures = [];

if (!ctaTarget) {
  failures.push('checkout CTA file is required to prove the payment screen is separate');
} else {
  const ctaAbsolute = path.resolve(ctaTarget);
  if (!fs.existsSync(ctaAbsolute) || !fs.statSync(ctaAbsolute).isFile()) {
    failures.push(`checkout CTA file not found: ${ctaAbsolute}`);
  } else if (fs.realpathSync(ctaAbsolute) === fs.realpathSync(absolute)) {
    failures.push('checkout screen must be a separate file from the page/component that owns the entry CTA');
  }
}

const publicKeySource = source.match(
  /data-mp-public-key-source\s*=\s*["'](runtime-endpoint|framework-public-config)["']/i,
)?.[1]?.toLowerCase();

if (!publicKeySource) {
  failures.push('screen must declare data-mp-public-key-source="runtime-endpoint|framework-public-config"');
}

if (source.includes('%MP_PUBLIC_KEY%')) {
  failures.push('literal %MP_PUBLIC_KEY% placeholder is forbidden; cached HTML can retain it');
}

if (/new\s+MercadoPago\s*\(\s*["'](?:APP_USR-|TEST-)/i.test(source)) {
  failures.push('public key must not be hard-coded in the checkout client');
}

if (publicKeySource === 'runtime-endpoint') {
  const configRoute = source.match(/fetch\s*\(\s*["']([^"']*(?:config|public-key)[^"']*)["']/i)?.[1];
  if (!configRoute) {
    failures.push('runtime-endpoint strategy must fetch a public configuration route');
  }
  if (!/cache\s*:\s*["']no-store["']/i.test(source)) {
    failures.push('runtime-endpoint strategy must fetch configuration with cache: "no-store"');
  }

  if (!configTarget) {
    failures.push('runtime-endpoint strategy requires the server/config route file as the second validator argument');
  } else {
    const configAbsolute = path.resolve(configTarget);
    if (!fs.existsSync(configAbsolute) || !fs.statSync(configAbsolute).isFile()) {
      failures.push(`runtime config server file not found: ${configAbsolute}`);
    } else {
      const configSource = fs.readFileSync(configAbsolute, 'utf8');
      if (configRoute && !configSource.includes(configRoute)) {
        failures.push(`runtime config server does not expose the client route ${configRoute}`);
      }
      if (!/MP_PUBLIC_KEY/.test(configSource)) {
        failures.push('runtime config server does not read MP_PUBLIC_KEY');
      }
      if (!/Cache-Control["']?\s*,?\s*["'][^"']*no-store/i.test(configSource)) {
        failures.push('runtime config response must send Cache-Control with no-store');
      }
      if (!/(?:status\s*\(\s*(?:4|5)\d\d\s*\)|throw\s+new\s+Error)[\s\S]{0,500}MP_PUBLIC_KEY|!\s*publicKey[\s\S]{0,500}(?:status\s*\(\s*(?:4|5)\d\d\s*\)|throw\s+new\s+Error)/i.test(configSource)) {
        failures.push('runtime config server must fail explicitly when MP_PUBLIC_KEY is missing');
      }
    }
  }
}

if (publicKeySource === 'framework-public-config') {
  const frameworkConfig = /(?:import\.meta\.env\.[A-Z0-9_]*PUBLIC_KEY|process\.env\.(?:NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*PUBLIC_KEY|useRuntimeConfig\s*\(|runtimeConfig\.public|environment\.[A-Za-z0-9_]*publicKey|window\.__[A-Z0-9_]*PUBLIC_KEY)/i;
  if (!frameworkConfig.test(source)) {
    failures.push('framework-public-config strategy must use the detected framework public configuration API');
  }
}

function readDataSource(attribute) {
  const match = source.match(new RegExp(`${attribute}\\s*=\\s*["'](form|application)["']`, 'i'));
  return match?.[1]?.toLowerCase();
}

function markerCount(field) {
  const marker = new RegExp(`data-mp-field\\s*=\\s*["']${field}["']`, 'g');
  return [...source.matchAll(marker)].length;
}

const emailSource = readDataSource('data-mp-payer-email-source');
const identificationSource = readDataSource('data-mp-payer-identification-source');

if (!emailSource) failures.push('form must declare data-mp-payer-email-source="form|application"');
if (!identificationSource) failures.push('form must declare data-mp-payer-identification-source="form|application"');

if (emailSource === 'form') requiredFields.push('cardholderEmail');
if (identificationSource === 'form') requiredFields.push('identificationNumber');

if (emailSource === 'application' && markerCount('cardholderEmail') > 0) {
  failures.push('cardholderEmail must not be rendered when payer email source is application');
}
if (identificationSource === 'application' && markerCount('identificationNumber') > 0) {
  failures.push('identificationNumber must not be rendered when payer identification source is application');
}
if (identificationSource === 'form'
    && markerCount('identificationType') === 0
    && !/data-mp-identification-type\s*=\s*["'][^"']+["']/i.test(source)) {
  failures.push('form-sourced identification needs a visible identificationType field or fixed data-mp-identification-type');
}

const issuerFields = markerCount('issuer');
if (issuerFields > 0 && !/data-mp-requires-issuer\s*=\s*["']true["']/i.test(source)) {
  failures.push('issuer is conditional; render it only with data-mp-requires-issuer="true"');
}
const installmentFields = markerCount('installments');
if (installmentFields > 0 && !/data-mp-offers-installments\s*=\s*["']true["']/i.test(source)) {
  failures.push('installments selector is optional; render it only with data-mp-offers-installments="true"');
}

for (const match of source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  try {
    new Function(match[1]);
  } catch (error) {
    failures.push(`inline checkout script has invalid JavaScript: ${error.message}`);
  }
}

for (const field of requiredFields) {
  const count = markerCount(field);
  if (count !== 1) failures.push(`${field}: expected one data-mp-field marker, found ${count}`);
}

function openingTagAt(index) {
  const start = source.lastIndexOf('<', index);
  const end = source.indexOf('>', index);
  return start >= 0 && end >= 0 ? source.slice(start, end + 1) : '';
}

function visibleLabelById(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(
    `<(?:label|span|div)\\b[^>]*\\bid\\s*=\\s*["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/(?:label|span|div)>`,
    'i',
  ));
  return Boolean(match?.[1]?.replace(/<[^>]+>/g, '').trim());
}

function fieldContext(field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldMarker = new RegExp(`data-mp-field\\s*=\\s*["']${escapedField}["']`, 'i');
  const match = fieldMarker.exec(source);
  if (!match) return '';
  const start = source.lastIndexOf('<', match.index);
  const remainder = source.slice(match.index + match[0].length);
  const next = /data-mp-field\s*=\s*["'][^"']+["']/i.exec(remainder);
  const end = next
    ? source.lastIndexOf('<', match.index + match[0].length + next.index)
    : Math.min(source.length, start + 4000);
  return source.slice(Math.max(0, start), end > start ? end : Math.min(source.length, start + 4000));
}

const visibleFields = new Set(
  [...source.matchAll(/data-mp-field\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]),
);

for (const field of visibleFields) {
  const context = fieldContext(field);
  if (secureFields.includes(field)) {
    const secureMarker = new RegExp(`data-mp-secure-field\\s*=\\s*["']${field}["']`, 'i');
    const secureMatch = secureMarker.exec(context);
    const secureTag = secureMatch ? openingTagAt(source.indexOf(secureMatch[0], source.indexOf(context))) : '';
    const labelledBy = secureTag.match(/\baria-labelledby\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const validIds = labelledBy.split(/\s+/).filter(Boolean);
    if (!validIds.length || !validIds.every(visibleLabelById)) {
      failures.push(`${field}: aria-labelledby must resolve to a non-empty visible label`);
    }
    continue;
  }

  const control = context.match(/<(?:input|select|textarea)\b[^>]*>/i)?.[0] || '';
  const id = control.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const labelledBy = control.match(/\baria-labelledby\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const explicitLabel = id && new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/label>`, 'i').test(context);
  const ariaLabel = labelledBy
    && labelledBy.split(/\s+/).filter(Boolean).every(visibleLabelById);
  if (!control || (!explicitLabel && !ariaLabel)) {
    failures.push(`${field}: visible control must have a non-empty label associated by for/id or aria-labelledby`);
  }
}

for (const field of secureFields) {
  const secureMarker = new RegExp(`data-mp-secure-field\\s*=\\s*["']${field}["']`, 'g');
  const matches = [...source.matchAll(secureMarker)];
  if (matches.length !== 1) {
    failures.push(`${field}: expected one data-mp-secure-field host, found ${matches.length}`);
    continue;
  }

  const secureTag = openingTagAt(matches[0].index);
  if (!/aria-labelledby\s*=\s*["'][^"']+["']/i.test(secureTag)) failures.push(`${field}: missing aria-labelledby`);
  if (/\b(?:disabled|readonly|readOnly|inert)\b/i.test(secureTag)) failures.push(`${field}: secure host appears disabled or readonly`);
}

for (const field of cardFormLifecycleFields) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lifecycleMarker = new RegExp(
    `<select\\b[^>]*data-mp-sdk-required-field\\s*=\\s*["']${escapedField}["'][^>]*>`,
    'gi',
  );
  const lifecycleNodes = [...source.matchAll(lifecycleMarker)];

  if (lifecycleNodes.length !== 1) {
    failures.push(`${field}: expected one required CardForm lifecycle <select>, found ${lifecycleNodes.length}`);
    continue;
  }

  const openingTag = lifecycleNodes[0][0];
  const id = openingTag.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
  const isHidden = /\bhidden(?:\s|=|>)/i.test(openingTag);

  if (!id) failures.push(`${field}: lifecycle select is missing an id`);
  if (/\bdisabled\b/i.test(openingTag)) failures.push(`${field}: lifecycle select must never be disabled`);

  if (isHidden) {
    if (!/\baria-hidden\s*=\s*["']true["']/i.test(openingTag)) {
      failures.push(`${field}: hidden lifecycle select must use aria-hidden="true"`);
    }
    if (!/\btabindex\s*=\s*["']-1["']/i.test(openingTag)) {
      failures.push(`${field}: hidden lifecycle select must use tabindex="-1"`);
    }
  } else if (markerCount(field) !== 1) {
    failures.push(`${field}: a visible lifecycle select must have one labeled data-mp-field wrapper`);
  }

  if (id) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mapped = new RegExp(`${escapedField}\\s*:\\s*\\{[\\s\\S]{0,300}?id\\s*:\\s*["']${escapedId}["']`, 'i');
    if (!mapped.test(source)) {
      failures.push(`${field}: lifecycle select ${id} is not referenced by the CardForm map`);
    }
  }
}

if (!/checkout-init-error/i.test(source) || !/aria-live\s*=\s*["'](?:assertive|polite)["']/i.test(source)) {
  failures.push('missing visible, live initialization error region');
}

if (/\.cardForm\s*\(/.test(source)) {
  if (!/onFormMounted\s*:/.test(source)) failures.push('CardForm is missing onFormMounted');
  for (const field of secureFields) {
    if (!new RegExp(`${field}\\s*:\\s*\\{`).test(source)) failures.push(`CardForm is missing ${field} configuration`);
  }
  for (const field of cardFormLifecycleFields) {
    if (!new RegExp(`${field}\\s*:\\s*\\{`).test(source)) failures.push(`CardForm is missing required ${field} configuration`);
  }
} else if (/\.fields\.create\s*\(/.test(source)) {
  for (const field of secureFields) {
    const mounted = new RegExp(`fields\\.create\\s*\\(\\s*["']${field}["'][\\s\\S]{0,500}?\\.mount\\s*\\(`);
    if (!mounted.test(source)) failures.push(`Secure Fields is missing ${field}.mount(...)`);
  }
} else {
  failures.push('no supported Mercado Pago CardForm or Secure Fields mounting code found');
}

if (/pointer-events\s*:\s*none/i.test(source)) failures.push('pointer-events: none is forbidden in checkout screen source');

if (failures.length) {
  console.error(`Checkout screen validation failed: ${path.relative(process.cwd(), absolute)}`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Checkout screen validation passed: ${path.relative(process.cwd(), absolute)}`);
