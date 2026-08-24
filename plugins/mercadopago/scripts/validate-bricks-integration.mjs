#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, variantValue] = process.argv.slice(2);
const variants = new Set(['card-payment', 'payment', 'wallet', 'status-screen']);
if (!rootValue || !variants.has(variantValue)) {
  console.error('Usage: node validate-bricks-integration.mjs <app-root> <card-payment|payment|wallet|status-screen>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`Bricks application root not found: ${appRoot}`);
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

const componentPatterns = {
  'card-payment': /(?:<CardPayment\b|import\s*\{[^}]*\bCardPayment\b[^}]*\}\s*from\s*['"]@mercadopago\/sdk-react['"]|\.create\(\s*['"]cardPayment['"])/,
  payment: /(?:<Payment\b|import\s*\{[^}]*\bPayment\b[^}]*\}\s*from\s*['"]@mercadopago\/sdk-react['"]|\.create\(\s*['"]payment['"])/,
  wallet: /(?:<Wallet\b|import\s*\{[^}]*\bWallet\b[^}]*\}\s*from\s*['"]@mercadopago\/sdk-react['"]|\.create\(\s*['"]wallet['"])/,
  'status-screen': /(?:<StatusScreen\b|import\s*\{[^}]*\bStatusScreen\b[^}]*\}\s*from\s*['"]@mercadopago\/sdk-react['"]|\.create\(\s*['"]statusScreen['"])/,
};
const trustedPurchasePattern = /derivePurchase\s*\(|purchase(?:Store|s|Repository)\s*\.\s*(?:get|find)|(?:cart|order|session(?:Cart|Order|Purchase)?|trustedPurchase|serverPurchase)\s*\.\s*(?:total|amount|unitPrice|unit_price)/i;

requirePattern(componentPatterns[variantValue], `must mount the ${variantValue} Brick using its official SDK component`);
requirePattern(new RegExp(`data-mp-bricks-page=["']${variantValue}["']`), `dedicated Brick page must declare data-mp-bricks-page="${variantValue}"`);
requirePattern(/\/api\/mp-config|import\.meta\.env\.(?:VITE_|PUBLIC_)?MP_PUBLIC_KEY|process\.env\.(?:NEXT_PUBLIC_|REACT_APP_|PUBLIC_)?MP_PUBLIC_KEY|runtimeConfig[\s\S]{0,300}?MP_PUBLIC_KEY/, 'must load the Mercado Pago public key through runtime/framework configuration');
if (/\/api\/mp-config/.test(joined)) {
  requirePattern(/Cache-Control["']?\s*[,):]\s*["'][^"']*no-store|no-store\s*,\s*max-age=0/i, 'runtime MP config endpoint must send Cache-Control: no-store');
  requirePattern(/cache\s*:\s*['"]no-store['"]/, 'client must fetch runtime MP config with cache: "no-store"');
}

forbidPattern(/%MP_PUBLIC_KEY%|<MP_PUBLIC_KEY>|YOUR_PUBLIC_KEY/, 'must not inject an unresolved public-key placeholder into client code');
forbidPattern(/(?:CardForm|PaymentForm|CheckoutForm)\s*(?:[,}]|from|\()/, 'must use an official Brick component, not CardForm/PaymentForm/CheckoutForm');
forbidPattern(/<input[^>]+(?:name|id)=["'][^"']*(?:cardNumber|expirationDate|securityCode|cardholderName)[^"']*["']/i, 'must not add raw card inputs around a Brick');
forbidPattern(/(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}/, 'must not hardcode a real-looking Mercado Pago credential');
if (/\.listen\s*\(/.test(joined)) {
  requirePattern(/process\.env\.PORT/, 'server-based Brick scaffold must respect process.env.PORT');
}
requirePattern(/(?:initializ|inicializ|carreg|cargand|loading|preparando)/i, 'must render an initializing/loading state');
requirePattern(/(?:process|procesando|processando|processing)/i, 'must render a processing state');
requirePattern(/(?:success|sucesso|exitos|aprobad|aprovad)/i, 'must render a success state');
requirePattern(/(?:error|erro|rechaz|recusad|try again|tente novamente|intentá nuevamente)/i, 'must render an actionable error state');

if (variantValue === 'card-payment' || variantValue === 'payment') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/payments|new\s+Payment\s*\(|\.payment\.create\s*\(/, 'Payment and Card Payment Bricks must create through Payments API');
  forbidPattern(/https:\/\/api\.mercadopago\.com\/v1\/orders/, 'standalone Checkout Bricks must not create an Orders API order');
  requirePattern(/['"]X-Idempotency-Key['"]\s*:|requestOptions\s*:\s*\{[\s\S]{0,300}?idempotencyKey\s*:/i, 'payment creation must send X-Idempotency-Key (directly or through SDK requestOptions.idempotencyKey)');
  requirePattern(/external_reference\s*:/, 'payment creation must include external_reference');
  requirePattern(/transaction_amount\s*:/, 'payment creation must include transaction_amount');
  requirePattern(/\btoken\s*:/, 'payment creation must include the Brick token');
  requirePattern(/installments\s*:/, 'payment creation must map installments');
  requirePattern(/payment_method_id\s*:/, 'payment creation must map payment_method_id');
  requirePattern(/payer\s*:\s*\{[\s\S]{0,400}?email\s*:/, 'payment creation must include payer.email');
  requirePattern(/Number\.isFinite|isFinite\s*\(|safeParse\s*\(|validate[A-Za-z]*(?:Amount|Cart|Order)/, 'server must validate the trusted amount as finite');
  requirePattern(trustedPurchasePattern, 'server must derive the charged amount from trusted cart/order/session state, not the browser payload');
  requirePattern(/onSubmit\s*[:=]|onSubmit\s*\{/, 'Brick must define onSubmit');
  requirePattern(/onSubmit[\s\S]{0,5000}?(?:async\s*\(|async\s+|return\s+(?:new\s+Promise|fetch\s*\())/, 'onSubmit must return/await the backend Promise');
  requirePattern(/paymentId/, 'client/server contract must preserve payment.id as paymentId');
  requirePattern(/(?:Total|Total a pagar|Importe)[\s\S]{0,500}?(?:ARS|BRL|MXN|CLP|COP|PEN|UYU|amount|total)/i, 'must show the charge total above the Brick');
}

if (variantValue === 'wallet') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/checkout\/preferences|new\s+Preference\s*\(|\.preference\.create\s*\(/, 'Wallet Brick must create a preference dynamically on the server');
  forbidPattern(/\/v1\/checkout\/preferences|\/checkout\/v1\/preferences/, 'Wallet preferences path must not contain v1');
  requirePattern(/preferenceId/, 'Wallet initialization must use the dynamically returned preferenceId');
  requirePattern(/(?:fetch|axios|request)[\s\S]{0,2000}?(?:preference|wallet)/i, 'Wallet client must request a preference for the current session');
  requirePattern(/items\s*:/, 'Wallet preference must be derived from purchase items');
  requirePattern(trustedPurchasePattern, 'Wallet preference amount must come from trusted cart/order/session state, not the browser payload');
  forbidPattern(/const\s+(?:totalAmount|amount)\s*=\s*Number\s*\(\s*(?:req\.body\.)?unit_price\s*\)/, 'Wallet server must not trust client-supplied unit_price as the preference amount');
  forbidPattern(/preferenceId\s*:\s*['"](?:<[^>]+>|PREFERENCE_ID|YOUR_PREFERENCE_ID|preference_id|123456)/i, 'Wallet must not hardcode a preferenceId placeholder');
}

if (variantValue === 'status-screen') {
  requirePattern(/paymentId/, 'Status Screen must initialize from a paymentId');
  forbidPattern(/initialization\s*[:=]\s*\{[^}]*orderId|StatusScreen[\s\S]{0,500}?orderId|statusScreen[\s\S]{0,500}?orderId/, 'Status Screen must not receive an orderId');
  requirePattern(/(?:URLSearchParams|route|params|paymentId\s*=|payment_id)/, 'Status Screen must obtain paymentId from a validated payment result or route');
  requirePattern(/(?:invalid|missing|ausente|inválid|invalido|requerid)[\s\S]{0,500}?payment/i, 'missing or invalid paymentId must produce a visible error');
  forbidPattern(/<iframe[^>]+(?:3ds|three.?ds)/i, 'Status Screen must not add a second custom 3DS iframe');
}

if (failures.length) {
  console.error(`Bricks ${variantValue} validation failed for ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  root: appRoot,
  variant: variantValue,
  filesScanned: files.length,
  runtimePublicKey: true,
  officialComponent: true,
}, null, 2));
