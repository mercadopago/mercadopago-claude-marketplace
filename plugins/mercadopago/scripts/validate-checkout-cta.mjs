#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [product, target, destination] = process.argv.slice(2);
const supportedProducts = new Set(['checkout-pro', 'checkout-api']);

if (!supportedProducts.has(product) || !target || !destination) {
  console.error('Usage: node validate-checkout-cta.mjs <checkout-pro|checkout-api> <cta-file> <destination>');
  process.exit(2);
}

const absolute = path.resolve(target);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
  console.error(`CTA file not found: ${absolute}`);
  process.exit(2);
}

const source = fs.readFileSync(absolute, 'utf8');
const failures = [];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attribute(openingTag, name) {
  const escaped = escapeRegExp(name);
  return openingTag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] || '';
}

function openingTagAt(index) {
  const start = source.lastIndexOf('<', index);
  if (start < 0) return '';
  let quote = '';
  let braces = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (quote) {
      if (char === quote && source[cursor - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') braces += 1;
    else if (char === '}' && braces > 0) braces -= 1;
    else if (char === '>' && braces === 0) return source.slice(start, cursor + 1);
  }
  return '';
}

function balancedBlock(openBrace) {
  let quote = '';
  let depth = 0;
  for (let cursor = openBrace; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (quote) {
      if (char === quote && source[cursor - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace, cursor + 1);
    }
  }
  return '';
}

function handlerBody(name) {
  if (!name) return '';
  const escaped = escapeRegExp(name);
  const declarations = [
    new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{`, 'g'),
    new RegExp(`(?:async\\s+)?${escaped}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
  ];
  for (const declaration of declarations) {
    const match = declaration.exec(source);
    if (!match) continue;
    const brace = source.indexOf('{', match.index);
    const body = balancedBlock(brace);
    if (body) return `${match[0]}${body.slice(1)}`;
  }
  const expression = new RegExp(
    `(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*([^;\\n]+)`,
    'i',
  ).exec(source);
  if (expression) return expression[0];
  return '';
}

function enclosingForm(markerIndex) {
  const start = source.lastIndexOf('<form', markerIndex);
  const closed = source.lastIndexOf('</form>', markerIndex);
  if (start < 0 || start < closed) return '';
  return openingTagAt(start + 1);
}

function visibleTextForMarkedElement(markerIndex, openingTag) {
  const tag = openingTag.match(/^<([A-Za-z][\w.:-]*)\b/)?.[1];
  if (!tag) return '';
  const start = source.lastIndexOf('<', markerIndex) + openingTag.length;
  const closing = source.indexOf(`</${tag}>`, start);
  if (closing < 0) return '';
  return source.slice(start, closing)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listenerFor(openingTag) {
  const selectors = [];
  const id = attribute(openingTag, 'id');
  const testId = attribute(openingTag, 'data-testid');
  const className = attribute(openingTag, 'class') || attribute(openingTag, 'className');
  if (id) selectors.push(`#${id}`);
  if (testId) selectors.push(`[data-testid="${testId}"]`, `[data-testid='${testId}']`);
  if (className) selectors.push(`.${className.trim().split(/\s+/)[0]}`);

  for (const selector of selectors) {
    const escaped = escapeRegExp(selector);
    const match = new RegExp(
      `(?:querySelector|getElementById)\\s*\\(\\s*["'][^"']*${escaped.replace(/\\#/g, '')}[^"']*["']\\s*\\)[\\s\\S]{0,200}?addEventListener\\s*\\(\\s*["']click["'][\\s\\S]{0,1800}?(?:\\);|\\}\\s*\\))`,
      'i',
    ).exec(source);
    if (match) return match[0];
  }
  return '';
}

const escapedProduct = escapeRegExp(product);
const marker = new RegExp(`data-mp-checkout-cta\\s*=\\s*["']${escapedProduct}["']`, 'g');
const matches = [...source.matchAll(marker)];

if (matches.length !== 1) {
  failures.push(`expected exactly one data-mp-checkout-cta="${product}" marker, found ${matches.length}`);
}

if (matches.length === 1) {
  const openingTag = openingTagAt(matches[0].index);
  if (!openingTag) {
    failures.push('could not resolve the marked CTA element');
  } else {
    const visibleText = visibleTextForMarkedElement(matches[0].index, openingTag);
    const inlineHandler = openingTag.match(/(?:onClick|onclick|@click|v-on:click|on:click)\s*=\s*(?:\{([\s\S]*?)\}|["']([\s\S]*?)["'])/i);
    const handlerExpression = inlineHandler?.[1] || inlineHandler?.[2] || '';
    const namedHandler = handlerExpression.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:\([^)]*\))?\s*$/)?.[1] || '';
    const form = enclosingForm(matches[0].index);
    const boundCode = [openingTag, form, handlerExpression, handlerBody(namedHandler), listenerFor(openingTag)]
      .filter(Boolean)
      .join('\n');
    const escapedDestination = escapeRegExp(destination);
    const destinationIsBound = new RegExp(escapedDestination).test(boundCode);

    if (!destinationIsBound) {
      failures.push(`marked CTA does not reference destination ${destination}`);
    }

    if (product === 'checkout-pro') {
      if (!/mercado\s+pago/i.test(`${openingTag} ${visibleText}`)) {
        failures.push('Checkout Pro CTA must visibly identify Mercado Pago');
      }
      const formPost = new RegExp(
        `<form\\b(?=[^>]*\\baction\\s*=\\s*["']${escapedDestination}["'])(?=[^>]*\\bmethod\\s*=\\s*["']POST["'])[^>]*>`,
        'i',
      ).test(form);
      const handlerRedirect = destinationIsBound
        && /(?:fetch\s*\(|axios\.|createPreference|preference)/i.test(boundCode)
        && /init_point/i.test(boundCode)
        && /(?:location\.(?:assign|replace)|location\.href|navigate\s*\(|router\.(?:push|replace)\s*\()/i.test(boundCode);
      if (!formPost && !handlerRedirect) {
        failures.push('Checkout Pro CTA must submit to its preference route or redirect its returned init_point');
      }
    }

    if (product === 'checkout-api') {
      const directLink = new RegExp(`\\b(?:href|to)\\s*=\\s*["']${escapedDestination}["']`, 'i').test(openingTag);
      const handlerNavigation = destinationIsBound
        && /(?:navigate\s*\(|router\.(?:push|replace)\s*\(|goTo\s*\(|location(?:\.href|\.assign|\.replace)?\s*[=(])/i.test(boundCode);
      if (!directLink && !handlerNavigation) {
        failures.push('Checkout API marked CTA must itself navigate to the separate checkout screen');
      }
    }
  }
}

if (failures.length) {
  console.error(`Checkout CTA validation failed: ${path.relative(process.cwd(), absolute)}`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Checkout CTA validation passed: ${product} · ${path.relative(process.cwd(), absolute)} → ${destination}`);
