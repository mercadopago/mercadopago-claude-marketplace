#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, modelValue] = process.argv.slice(2);
const models = new Set(['with-plan', 'without-plan-authorized', 'without-plan-pending']);
if (!rootValue || !models.has(modelValue)) {
  console.error('Usage: node validate-subscriptions-integration.mjs <app-root> <with-plan|without-plan-authorized|without-plan-pending>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`Subscriptions application root not found: ${appRoot}`);
  process.exit(2);
}

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.work']);
const extensions = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte', '.astro', '.php', '.ejs', '.hbs', '.handlebars', '.env']);
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (entry.isFile() && (extensions.has(path.extname(entry.name)) || entry.name === '.env.example')) files.push(fullPath);
  }
}
collect(appRoot);

const sources = files.map(file => ({ file, source: fs.readFileSync(file, 'utf8') }));
const joined = sources.map(item => `\n/* ${path.relative(appRoot, item.file)} */\n${item.source}`).join('\n');
const failures = [];

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) {
  failures.push('.mp-integrate-progress.md must be deleted after a successful scaffold');
}

function requirePattern(pattern, message) {
  if (!pattern.test(joined)) failures.push(message);
}

function forbidPattern(pattern, message) {
  if (pattern.test(joined)) failures.push(message);
}

function countPattern(pattern) {
  return [...joined.matchAll(pattern)].length;
}

requirePattern(new RegExp(`data-mp-subscriptions-page=["']${modelValue}["']`), `signup page must declare data-mp-subscriptions-page="${modelValue}"`);
requirePattern(new RegExp(`data-mp-subscription-cta=["']${modelValue}["']`), `final CTA must declare data-mp-subscription-cta="${modelValue}"`);
requirePattern(/https:\/\/api\.mercadopago\.com\/preapproval(?:[?'"`/]|$)/, 'must create subscriptions through exactly /preapproval');
forbidPattern(/api\.mercadopago\.com\/(?:v1|V1)\/preapproval(?:_plan)?/, 'Subscriptions endpoints must not contain a v1 segment');
forbidPattern(/(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}/, 'must not hardcode a real-looking Mercado Pago credential');
forbidPattern(/console\.(?:log|debug|info|error)\s*\([^)]*(?:cardToken|card_token|token\b)/i, 'must not log a card token or access token');
forbidPattern(/<input[^>]+(?:name|id)=["'][^"']*(?:card_token|cardToken|card-token)[^"']*["']/i, 'must never render a manual card-token input');
forbidPattern(/<input[^>]+(?:name|id)=["'][^"']*(?:cardNumber|card_number|expirationDate|securityCode)[^"']*["']/i, 'must not collect raw card data in normal inputs');
forbidPattern(/(?:req\.body\.(?:amount|price|currency|frequency|plan_id|planId)|\{[^}]*\b(?:amount|price|currency|frequency|plan_id|planId)\b[^}]*\}\s*=\s*req\.body)/i, 'must not trust plan ID or recurrence terms from the browser');
forbidPattern(/(?:app|router)\.post\s*\(\s*["'][^"']*(?:create-plan|preapproval[-_]?plan|subscription[-_]?plan)/i, 'plan provisioning must not be exposed as a public buyer POST route');
forbidPattern(/(?:fetch|axios\.(?:post|request))\s*\(\s*["']\/subscribe["']|<form[^>]+action=["']\/subscribe["']/i, 'legacy entry CTAs must navigate to the dedicated signup page, not call a competing /subscribe handler');
requirePattern(/external_reference(?:\s*:|\s*[,}])/, 'subscription creation must include external_reference for reconciliation');
requirePattern(/payer_email\s*:/, 'subscription creation must include payer_email');
requirePattern(/(?:SUBSCRIPTION_OFFERS|subscriptionOffers|offerCatalog|trustedOffer|resolveOffer|deriveSubscriptionOffer)/, 'amount/frequency/plan selection must come from trusted server-side offer configuration');
requirePattern(/(?:inFlight|isSubmitting|processing|procesando|processando|disabled\s*=|\.disabled\s*=\s*true)/i, 'client must prevent duplicate subscription submissions');
requirePattern(/(?:APP_URL|PUBLIC_APP_URL|BASE_URL|subscriptionBackUrl|backUrl)/, 'back_url must be derived from explicit application configuration');
requirePattern(/(?:initializ|inicializ|carreg|cargand|loading|preparando)/i, 'must render an initializing/loading state');
requirePattern(/(?:process|procesando|processando|processing)/i, 'must render a processing state');
requirePattern(/(?:success|sucesso|exitos|activad|autorizad)/i, 'must render a success/authorized state');
requirePattern(/(?:error|erro|rechaz|recusad|try again|tente novamente|intentá nuevamente)/i, 'must render an actionable error state');
for (const status of ['pending', 'authorized', 'paused', 'canceled']) {
  requirePattern(new RegExp(`\\b${status}\\b`, 'i'), `must handle the ${status} subscription state explicitly`);
}
requirePattern(/(?:app|router)\.get\s*\(\s*["'][^"']*subscriptions\/:\w+|GET[\s\S]{0,300}?\/api\/subscriptions\/:/i, 'must expose a server-side subscription lookup route');
requirePattern(/https:\/\/api\.mercadopago\.com\/preapproval\/\$?\{?[^\s}'"`/]+\}?|\/preapproval\/['"`]\s*\+/, 'lookup/lifecycle calls must target /preapproval/{id}');
requirePattern(/(?:pause[\s\S]{0,500}?paused|reactivat[\s\S]{0,500}?authorized|cancel[\s\S]{0,500}?canceled)/i, 'lifecycle route must allowlist pause/reactivate/cancel instead of accepting arbitrary status');
if (/\.listen\s*\(/.test(joined)) requirePattern(/process\.env\.PORT/, 'server must respect process.env.PORT');

const preapprovalCreatorPattern = /(?:fetch|mpFetch)\s*\(\s*(?:["']POST["']\s*,\s*)?["'](?:https:\/\/api\.mercadopago\.com)?\/preapproval["']/g;
const preapprovalCreators = sources.reduce((total, item) => total + [...item.source.matchAll(preapprovalCreatorPattern)].length, 0);
if (preapprovalCreators !== 1) {
  failures.push(`application must contain exactly one preapproval creation path; found ${preapprovalCreators}`);
}

const authorized = modelValue !== 'without-plan-pending';
if (authorized) {
  requirePattern(/\.cardForm\s*\(|\.create\(\s*["']cardPayment["']|<CardPayment\b/, 'authorized subscriptions must use MercadoPago.js CardForm or Card Payment Brick');
  requirePattern(/card_token_id\s*:/, 'authorized subscription must send the securely generated card_token_id');
  requirePattern(/status\s*:\s*["']authorized["']/, 'authorized subscription must be created with status authorized');
  requirePattern(/\/api\/mp-config|import\.meta\.env\.(?:VITE_|PUBLIC_)?MP_PUBLIC_KEY|process\.env\.(?:NEXT_PUBLIC_|REACT_APP_|PUBLIC_)?MP_PUBLIC_KEY|runtimeConfig[\s\S]{0,300}?MP_PUBLIC_KEY/, 'authorized subscription must load MP_PUBLIC_KEY through runtime/framework configuration');
  if (/\/api\/mp-config/.test(joined)) {
    requirePattern(/Cache-Control["']?\s*[,):]\s*["'][^"']*no-store|no-store\s*,\s*max-age=0/i, 'runtime MP config endpoint must send Cache-Control: no-store');
    requirePattern(/cache\s*:\s*["']no-store["']/, 'client must fetch runtime MP config with cache: no-store');
  }
  forbidPattern(/%MP_PUBLIC_KEY%|<MP_PUBLIC_KEY>|YOUR_PUBLIC_KEY/, 'must not inject an unresolved public-key placeholder into client code');

  if (/\.cardForm\s*\(/.test(joined)) {
    for (const field of ['issuer', 'installments', 'identificationType']) {
      requirePattern(new RegExp(`data-mp-sdk-required-field=["']${field}["']`), `CardForm must keep the ${field} lifecycle select in the DOM`);
      requirePattern(new RegExp(`<select[^>]+data-mp-sdk-required-field=["']${field}["'][^>]*>|<select[^>]+id=["'][^"']*${field}[^"']*["'][^>]*>`, 'i'), `CardForm must render a select for ${field}`);
    }
    forbidPattern(/<select[^>]+data-mp-sdk-required-field=["'](?:issuer|installments|identificationType)["'][^>]*\bdisabled\b/i, 'CardForm lifecycle selects must be hidden, never disabled');
    for (const field of ['cardNumber', 'expirationDate', 'securityCode']) {
      requirePattern(new RegExp(`data-mp-secure-field=["']${field}["']`), `CardForm must mark the secure ${field} iframe host`);
    }
    requirePattern(/<(?:label|span)[^>]*(?:card-number|cardNumber|tarjeta|cartão|cartao)[^>]*>|Número do cartão|Número de tarjeta|Card number/i, 'card number needs a persistent visible label');
    requirePattern(/Validade|Vencimiento|Expiration/i, 'expiration date needs a persistent visible label');
    requirePattern(/Código de segurança|Código de seguridad|Security code|CVV|CVC/i, 'security code needs a persistent visible label');
  }
} else {
  requirePattern(/status\s*:\s*["']pending["']/, 'pending subscription must be created with status pending');
  requirePattern(/init_point/, 'pending subscription must return and navigate to init_point');
  forbidPattern(/card_token_id\s*:|\.cardForm\s*\(|\.create\(\s*["']cardPayment["']|<CardPayment\b/, 'pending subscription must not tokenize or send a card token');
}

if (modelValue === 'with-plan') {
  requirePattern(/MP_SUBSCRIPTION_PLAN_ID/, 'with-plan subscriptions must load a server-controlled MP_SUBSCRIPTION_PLAN_ID');
  requirePattern(/preapproval_plan_id\s*:\s*(?:process\.env\.)?MP_SUBSCRIPTION_PLAN_ID|preapproval_plan_id\s*:\s*(?:trustedOffer|offer|planRecord)\.(?:planId|plan_id|preapprovalPlanId)/, 'with-plan payload must use the trusted server-side plan ID');
} else {
  forbidPattern(/preapproval_plan_id\s*:/, 'without-plan subscriptions must not send preapproval_plan_id');
  requirePattern(/reason\s*:/, 'without-plan subscription must include reason');
  requirePattern(/auto_recurring\s*:/, 'without-plan subscription must include trusted auto_recurring terms');
  requirePattern(/frequency\s*:/, 'without-plan auto_recurring must include frequency');
  requirePattern(/frequency_type\s*:/, 'without-plan auto_recurring must include frequency_type');
  requirePattern(/transaction_amount\s*:/, 'without-plan auto_recurring must include transaction_amount');
  requirePattern(/currency_id\s*:/, 'without-plan auto_recurring must include currency_id');
}

if (countPattern(new RegExp(`data-mp-subscription-cta=["']${modelValue}["']`, 'g')) !== 1) {
  failures.push(`must have exactly one final data-mp-subscription-cta="${modelValue}" action`);
}

if (failures.length) {
  console.error(`Subscriptions ${modelValue} validation failed for ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  root: appRoot,
  model: modelValue,
  filesScanned: files.length,
  secureTokenization: authorized,
  pendingRedirect: !authorized,
}, null, 2));
