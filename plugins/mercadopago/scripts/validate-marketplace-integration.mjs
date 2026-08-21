#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, contractValue] = process.argv.slice(2);
const contracts = new Set(['checkout-pro', 'checkout-api', 'bricks-wallet']);
if (!rootValue || !contracts.has(contractValue)) {
  console.error('Usage: node validate-marketplace-integration.mjs <app-root> <checkout-pro|checkout-api|bricks-wallet>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`Marketplace application root not found: ${appRoot}`);
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

function requirePattern(pattern, message) {
  if (!pattern.test(joined)) failures.push(message);
}

function forbidPattern(pattern, message) {
  if (pattern.test(joined)) failures.push(message);
}

function marketplaceRouteBodies(source) {
  const bodies = [];
  const routePattern = /\b(?:app|router)\.(?:post|put|patch)\s*\(\s*["']\/api\/marketplace\/(purchases|preference|payment)["']/g;
  for (const match of source.matchAll(routePattern)) {
    const nextRoute = source.slice(match.index + match[0].length).search(/\n\s*(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/);
    const end = nextRoute === -1 ? source.length : match.index + match[0].length + nextRoute;
    bodies.push({ route: match[1], source: source.slice(match.index, end) });
  }
  return bodies;
}

function marketplacePurchaseFetches(source) {
  const calls = [];
  const pattern = /fetch\s*\(\s*["'][^"']*\/api\/marketplace\/purchases[^"']*["']/g;
  for (const match of source.matchAll(pattern)) {
    const remainder = source.slice(match.index);
    const close = remainder.search(/\}\s*\)\s*;?/);
    calls.push(close === -1 ? remainder.slice(0, 1200) : remainder.slice(0, close + 2));
  }
  return calls;
}

function publicConfigRouteBodies(source) {
  const bodies = [];
  const routePattern = /\b(?:app|router)\.get\s*\(\s*["']\/api\/mp-config["']/g;
  for (const match of source.matchAll(routePattern)) {
    const nextRoute = source.slice(match.index + match[0].length).search(/\n\s*(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/);
    const end = nextRoute === -1 ? source.length : match.index + match[0].length + nextRoute;
    bodies.push(source.slice(match.index, end));
  }
  return bodies;
}

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) {
  failures.push('.mp-integrate-progress.md must be deleted after a successful scaffold');
}

requirePattern(new RegExp(`data-mp-marketplace-page=["']${contractValue}["']`), `seller connection page must declare data-mp-marketplace-page="${contractValue}"`);
requirePattern(/data-mp-marketplace-connect=["']oauth["']/, 'seller connection page must expose one marked OAuth CTA');
requirePattern(new RegExp(`data-mp-marketplace-checkout=["']${contractValue}["']`), `buyer checkout must declare data-mp-marketplace-checkout="${contractValue}"`);

for (const variable of ['MP_APP_ID', 'MP_CLIENT_SECRET', 'MP_OAUTH_REDIRECT_URI', 'MP_TOKEN_ENCRYPTION_KEY']) {
  requirePattern(new RegExp(`process\\.env\\.${variable}|${variable}\\s*=`), `must use server configuration ${variable}`);
}
requirePattern(/https:\/\/auth\.mercadopago\.[A-Za-z.]+\/authorization/, 'must redirect sellers to the Mercado Pago authorization endpoint');
for (const parameter of ['client_id', 'response_type', 'platform_id', 'redirect_uri', 'state']) {
  requirePattern(new RegExp(`${parameter}`), `OAuth authorization URL must include ${parameter}`);
}
requirePattern(/response_type[^\n]{0,80}code|set\(["']response_type["']\s*,\s*["']code["']\)/, 'OAuth response_type must be code');
requirePattern(/platform_id[^\n]{0,80}mp|set\(["']platform_id["']\s*,\s*["']mp["']\)/, 'OAuth platform_id must be mp');
requirePattern(/randomUUID\s*\(|randomBytes\s*\(|crypto\.getRandomValues\s*\(/, 'OAuth state must be cryptographically random');
requirePattern(/(?:oauthState|stateStore|oauthRepository|session)[\s\S]{0,800}?(?:save|set|create|insert|upsert)/i, 'OAuth state must be persisted server-side with the initiating user/session');
requirePattern(/(?:consume|delete|remove|destroy|usedAt|used_at)[\s\S]{0,500}?(?:oauthState|state)|(?:oauthState|state)[\s\S]{0,500}?(?:consume|delete|remove|destroy|usedAt|used_at)/i, 'OAuth state must be one-time and consumed by the callback');
forbidPattern(/(?:const|let|var)\s+(?:oauthState|state)\s*=\s*["'][A-Za-z0-9_-]{6,}["']/, 'OAuth state must not be a static constant');
forbidPattern(/(?:const|let|var)\s+(?:states|oauthStates|oauthStateStore)\s*=\s*(?:new\s+Map|\{\})/, 'OAuth state must use durable shared storage, not an in-memory Map/object');
requirePattern(/(?:req\.query\.)?error|searchParams\.get\(["']error["']\)/, 'OAuth callback must handle provider error responses');
requirePattern(/(?:req\.query\.)?code|searchParams\.get\(["']code["']\)/, 'OAuth callback must require the authorization code');
requirePattern(/https:\/\/api\.mercadopago\.com\/oauth\/token/, 'OAuth code exchange and refresh must use exactly /oauth/token');
requirePattern(/application\/x-www-form-urlencoded|URLSearchParams\s*\(/, 'OAuth token calls must use form-urlencoded data');
requirePattern(/grant_type[\s\S]{0,300}?authorization_code|authorization_code[\s\S]{0,300}?grant_type/, 'must implement authorization-code exchange');
requirePattern(/grant_type[\s\S]{0,300}?refresh_token|refresh_token[\s\S]{0,300}?grant_type/, 'must implement refresh-token exchange');
requirePattern(/(?:sellerRepository|sellerStore|oauthRepository|marketplaceRepository)[\s\S]{0,1200}?(?:save|upsert|update|rotate)/i, 'seller OAuth credentials must use persistent repository storage');
requirePattern(/(?:encrypt|seal)[A-Za-z]*(?:Token|Secret|Credential)?\s*\(/i, 'seller access and refresh tokens must be encrypted at rest');
requirePattern(/access_token[\s\S]{0,500}?refresh_token|refresh_token[\s\S]{0,500}?access_token/, 'must persist and atomically rotate both OAuth tokens');
requirePattern(/expires_in|expiresAt|expires_at/, 'must track seller token expiry');
forbidPattern(/(?:console|logger)\.(?:log|info|debug|warn|error)\s*\([^\n]*(?:access_token|refresh_token|client_secret|sellerToken)/i, 'must not log OAuth credentials');
forbidPattern(/(?:res\.json|res\.send)\s*\([^\n]*(?:access_token|refresh_token|client_secret)/i, 'must not return OAuth credentials to the browser');
forbidPattern(/(?:localStorage|sessionStorage|document\.cookie)[\s\S]{0,200}?(?:access_token|refresh_token|sellerToken)/i, 'must not store OAuth credentials in the browser');
forbidPattern(/(?:const|let|var)\s+sellers\s*=\s*(?:\{\}|new\s+Map)/, 'production seller tokens must not live only in an in-memory object');

requirePattern(/Authorization["']?\s*:\s*`Bearer\s+\$\{[^}]*(?:seller|connection|oauth)[^}]*\}`|Authorization["']?\s*:\s*["']Bearer ["']\s*\+\s*[^\n]*(?:seller|connection|oauth)/i, 'split requests must use the connected seller OAuth access token');
requirePattern(/(?:cart|order|purchase|offer)(?:Repository|Store|Service)?[\s\S]{0,500}?(?:get|find|load|resolve)|derive(?:Cart|Order|Purchase|Offer)\s*\(/i, 'seller, amount, and commission must derive from trusted server-side commerce state');
requirePattern(/Number\.isFinite|isFinite\s*\(|safeParse\s*\(|validate[A-Za-z]*(?:Fee|Commission|Amount)/, 'server must validate the trusted amount and commission');
forbidPattern(/req\.body\.(?:seller_id|sellerId|collector_id|collectorId|access_token|sellerToken|amount|total|fee|application_fee|marketplace_fee|items|unit_price)/, 'browser must not choose seller, token, amount, items, or commission');
const forbiddenTrustedFields = /\b(?:seller_id|sellerId|collector_id|collectorId|access_token|sellerToken|amount|total|fee|application_fee|marketplace_fee|unitPrice|unit_price)\b/;
const forbiddenFinalRouteFields = /\b(?:items|cartItems|seller_id|sellerId|collector_id|collectorId|access_token|sellerToken|amount|total|fee|application_fee|marketplace_fee|unitPrice|unit_price)\b/;
const unsafeMarketplaceRoute = sources.some(({ source }) => marketplaceRouteBodies(source).some(({ route, source: body }) => {
  const destructuring = body.match(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.body/g) || [];
  return destructuring.some(statement => (route === 'purchases' ? forbiddenTrustedFields : forbiddenFinalRouteFields).test(statement));
}));
if (unsafeMarketplaceRoute) failures.push('marketplace routes must not destructure seller, priced items, amount, or commission from req.body');
const unsafePurchaseFetch = sources.some(({ source }) => marketplacePurchaseFetches(source).some(call => /(?:unitPrice|unit_price|\bprice\s*:|\btotal\s*:|\bfee\s*:)/i.test(call)));
if (unsafePurchaseFetch) failures.push('browser purchase bootstrap may send only product IDs and quantities, never prices/totals/fees');
forbidPattern(/(?:collector_id|collectorId)\s*:/, 'split payment/preference payload must not invent collector_id');
forbidPattern(/https:\/\/api\.mercadopago\.com\/v1\/orders/, 'Marketplace Split 1:1 scaffold must not force the standalone Orders API contract');
requirePattern(/external_reference\s*:/, 'split creation must include a trusted external_reference');
requirePattern(/(?:loading|carreg|cargand|inicializ)/i, 'must render a loading state');
requirePattern(/(?:processing|processando|procesando|redirecionando)/i, 'must render a processing state');
requirePattern(/(?:success|sucesso|exitos|aprovad|conectad)/i, 'must render a success/connected state');
requirePattern(/(?:error|erro|rechaz|recusad|tente novamente|intentá nuevamente)/i, 'must render an actionable error state');

if (contractValue === 'checkout-pro') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/checkout\/preferences/, 'Marketplace Checkout Pro must create exactly /checkout/preferences');
  forbidPattern(/\/v1\/checkout\/preferences|\/checkout\/v1\/preferences/, 'Marketplace Preferences path must not contain v1');
  requirePattern(/marketplace_fee\s*:/, 'Marketplace Checkout Pro must include trusted marketplace_fee');
  requirePattern(/items\s*:/, 'Marketplace Checkout Pro must include trusted items');
  requirePattern(/init_point|initPoint/, 'Marketplace Checkout Pro must redirect to returned init_point');
  forbidPattern(/application_fee\s*:/, 'Marketplace Checkout Pro must not use application_fee');
}

if (contractValue === 'checkout-api') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/payments/, 'Marketplace Checkout API must create through Payments API');
  requirePattern(/application_fee\s*:/, 'Marketplace Checkout API must include trusted application_fee');
  forbidPattern(/marketplace_fee\s*:/, 'Marketplace Checkout API must not use marketplace_fee');
  requirePattern(/['"]X-Idempotency-Key['"]\s*:|idempotencyKey\s*:/, 'Marketplace payment creation must be idempotent');
  requirePattern(/\btoken\s*:/, 'Marketplace Checkout API must send a secure single-use card token');
  requirePattern(/\.cardForm\s*\(|\.create\(\s*["']cardPayment["']|<CardPayment\b/, 'Marketplace Checkout API must use secure MercadoPago.js tokenization');
  forbidPattern(/<input[^>]+(?:name|id)=["'][^"']*(?:cardNumber|expirationDate|securityCode|card_token|cardToken)[^"']*["']/i, 'must not render raw card or manual token inputs');
  requirePattern(/\/api\/mp-config|import\.meta\.env\.(?:VITE_|PUBLIC_)?MP_PUBLIC_KEY|process\.env\.(?:NEXT_PUBLIC_|REACT_APP_|PUBLIC_)?MP_PUBLIC_KEY/, 'must deliver the integrator public key through runtime/framework configuration');
  if (/\.cardForm\s*\(/.test(joined)) {
    for (const field of ['issuer', 'installments', 'identificationType']) {
      requirePattern(new RegExp(`data-mp-sdk-required-field=["']${field}["']`), `CardForm must retain ${field} lifecycle select`);
    }
    forbidPattern(/<select[^>]+data-mp-sdk-required-field=["'](?:issuer|installments|identificationType)["'][^>]*\bdisabled\b/i, 'CardForm lifecycle selects must never be disabled');
  }
}

if (contractValue === 'bricks-wallet') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/checkout\/preferences/, 'Marketplace Wallet Brick must create exactly /checkout/preferences');
  forbidPattern(/\/v1\/checkout\/preferences|\/checkout\/v1\/preferences/, 'Marketplace Wallet preference path must not contain v1');
  requirePattern(/marketplace_fee\s*:/, 'Marketplace Wallet Brick must include trusted marketplace_fee');
  requirePattern(/\.create\(\s*["']wallet["']|<Wallet\b/, 'Marketplace Wallet Brick must use the official Wallet component');
  requirePattern(/initialization\s*:\s*\{[^}]*marketplace\s*:\s*true/, 'Marketplace Wallet Brick must set marketplace: true inside initialization');
  requirePattern(/preferenceId/, 'Marketplace Wallet Brick must initialize with a dynamic preferenceId');
  requirePattern(/\/api\/mp-config|import\.meta\.env\.(?:VITE_|PUBLIC_)?MP_PUBLIC_KEY|process\.env\.(?:NEXT_PUBLIC_|REACT_APP_|PUBLIC_)?MP_PUBLIC_KEY/, 'must deliver the integrator public key through runtime/framework configuration');
  forbidPattern(/preferenceId\s*:\s*["'](?:<[^>]+>|PREFERENCE_ID|YOUR_PREFERENCE_ID|preference_id|123456)/i, 'Marketplace Wallet Brick must not hardcode preferenceId');
}

if (contractValue === 'checkout-api' || contractValue === 'bricks-wallet') {
  const sellerPublicKeyConfig = sources.some(({ source }) => publicConfigRouteBodies(source).some(body => /(?:seller|connection|oauth)[\s\S]{0,300}?publicKey|publicKey[\s\S]{0,300}?(?:seller|connection|oauth)/i.test(body)));
  if (sellerPublicKeyConfig) failures.push('frontend must use the integrator MP_PUBLIC_KEY, never a seller OAuth public key');
}

if (failures.length) {
  console.error(`Marketplace ${contractValue} validation failed for ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  root: appRoot,
  contract: contractValue,
  filesScanned: files.length,
  oauthState: 'one-time-server-side',
  sellerTokens: 'encrypted-persistent-refreshable',
  trustedCommerceState: true,
}, null, 2));
