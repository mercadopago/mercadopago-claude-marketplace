#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, countryValue] = process.argv.slice(2);
if (!rootValue || !countryValue) {
  console.error('Usage: node validate-payouts-integration.mjs <app-root> <AR|BR>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
const country = countryValue.toUpperCase();
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`Payouts application root not found: ${appRoot}`);
  process.exit(2);
}
if (!['AR', 'BR'].includes(country)) {
  console.error(`Unsupported deterministic Payouts country: ${country}. Use AR or BR.`);
  process.exit(2);
}

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.work']);
const extensions = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte', '.astro', '.java', '.kt', '.py', '.rb', '.php', '.go', '.cs', '.env']);
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
const payoutSources = sources.filter(({ file, source }) =>
  /payout|transaction[-_ ]?intent/i.test(path.basename(file))
  || /MP_PAYOUTS_|\/api\/payouts|\/v1\/payouts|transaction-intents\/process/i.test(source)
);
const joined = payoutSources.map(item => `\n/* ${path.relative(appRoot, item.file)} */\n${item.source}`).join('\n');
const payoutUiSource = sources
  .filter(({ file, source }) => /\.(?:html|jsx|tsx|vue|svelte|astro)$/i.test(file) && /\/api\/payouts|data-mp-payout|money-out/i.test(source))
  .map(item => item.source)
  .join('\n');
const failures = [];
const requirePattern = (pattern, message) => { if (!pattern.test(joined)) failures.push(message); };
const forbidPattern = (pattern, message) => { if (pattern.test(joined)) failures.push(message); };

function routeBodies(source, method, routePattern) {
  const bodies = [];
  const pattern = new RegExp(`\\b(?:app|router)\\.${method}\\s*\\(\\s*["']${routePattern}["']`, 'g');
  for (const match of source.matchAll(pattern)) {
    const remainder = source.slice(match.index);
    const next = remainder.slice(match[0].length).search(/\n\s*(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/);
    bodies.push(next === -1 ? remainder : remainder.slice(0, match[0].length + next));
  }
  return bodies;
}

const createRoutes = payoutSources.flatMap(({ source }) => routeBodies(source, 'post', '\\/api\\/payouts'));
const lookupRoutes = payoutSources.flatMap(({ source }) => routeBodies(source, 'get', '\\/api\\/payouts\\/:\\w+'));
const createJoined = createRoutes.join('\n');
const lookupJoined = lookupRoutes.join('\n');

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) failures.push('.mp-integrate-progress.md must be deleted after a successful scaffold');
if (!payoutSources.length) failures.push('must create a Payouts server integration');
if (!createRoutes.length) failures.push('must expose an authenticated internal POST /api/payouts route');
if (!lookupRoutes.length) failures.push('must expose an authenticated internal GET /api/payouts/:id lookup route');

for (const variable of ['MP_ACCESS_TOKEN', 'MP_PAYOUTS_TEST_MODE', 'MP_PAYOUTS_NOTIFICATION_URL', 'MP_PAYOUTS_PRIVATE_KEY_PATH']) {
  requirePattern(new RegExp(`process\\.env\\.${variable}|${variable}\\s*=`), `must use server configuration ${variable}`);
}

requirePattern(/authorizePayoutOperator|requirePayoutOperator|assertPayoutPermission|payoutAuthorization/i, 'must define an explicit payout-operator authorization guard');
if (![...createRoutes, ...lookupRoutes].every(body => /authorizePayoutOperator|requirePayoutOperator|assertPayoutPermission|payoutAuthorization/i.test(body))) {
  failures.push('must enforce an explicit payout-operator authorization guard on create and lookup routes');
}
requirePattern(/payoutInstruction(?:Repository|Store)/, 'must load payout instructions from a trusted repository');
requirePattern(/payoutAudit(?:Repository|Store)|auditPayout|recordPayoutAudit/i, 'must persist an append-only payout audit trail');
forbidPattern(/(?:payoutInstruction|payoutAudit)(?:Repository|Store)\s*=\s*(?:new\s+Map\s*\(|\{\s*\})/i, 'Payouts instruction and audit repositories must be durable, not in-memory Map/object storage');
requirePattern(/(?:atomic|renameSync|rename\s*\(|transaction\s*\(|commit\s*\()/i, 'Payouts repository writes must be atomic or transactional');

if (!/(?:req\.body\.(?:instructionId|instruction_id)|\{\s*(?:instructionId|instruction_id)\s*\}\s*=\s*req\.body)/.test(joined)
    || !/(?:load|get|find|resolve)Instruction\s*\(\s*req\s*\)|req\.body\.(?:instructionId|instruction_id)/i.test(createJoined)) {
  failures.push('POST /api/payouts must accept an opaque instructionId');
}
if (/req\.body\.(?:amount|total|currency|email|pixKey|pix_key|bank|bankId|bank_id|branch|account|accountNumber|account_number|holder|owner|document|schedule|scheduleDate|schedule_date|notificationUrl|notification_url|externalReference|external_reference)/i.test(createJoined)) {
  failures.push('browser must not choose payout amount, currency, destination, schedule, notification URL, or external reference');
}

requirePattern(/(?:["']Authorization["']|\bAuthorization)\s*:|\.set\(\s*["']Authorization["']/, 'Payouts calls must send server-side Authorization');
requirePattern(/["']X-Idempotency-Key["']\s*:|\.set\(\s*["']X-Idempotency-Key["']/, 'Payout creation must send X-Idempotency-Key');
requirePattern(/(?:persist|save|update)[\s\S]{0,300}?idempotency|idempotency[\s\S]{0,300}?(?:persist|save|update)/i, 'the logical instruction must persist and reuse its idempotency key');
requirePattern(/["']X-test-token["']\s*:|\.set\(\s*["']X-test-token["']/, 'Payout creation must send the explicit X-test-token header');
requirePattern(/(?:["']X-test-token["']\s*:\s*|\.set\(\s*["']X-test-token["']\s*,\s*)(?:payoutsTestMode|isPayoutsTestMode|testMode)\s*\?\s*["']true["']\s*:\s*["']false["']/i, 'X-test-token must derive from MP_PAYOUTS_TEST_MODE instead of being hardcoded');

requirePattern(/["']X-enforce-signature["']\s*:|\.set\(\s*["']X-enforce-signature["']/, 'Payout creation must control X-enforce-signature');
requirePattern(/(?:["']X-signature["']\s*:|\[["']X-signature["']\]\s*=|\.set\(\s*["']X-signature["'])/, 'production Payouts calls must send X-signature');
requirePattern(/ed25519|crypto\.sign\s*\(\s*null|sign\s*\(\s*null/i, 'production body must be signed with Ed25519');
requirePattern(/(?:base64|toString\s*\(\s*["']base64["']\s*\))/, 'production signature must be encoded as base64');
const serializedMatch = joined.match(/(?:const|let)\s+(\w*(?:serialized|bodyJson|requestBody)\w*)\s*=\s*JSON\.stringify\s*\(/i);
if (!serializedMatch) {
  failures.push('must serialize the production request body exactly once before signing');
} else {
  const name = serializedMatch[1];
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`(?:sign|crypto\\.sign)\\s*\\([\\s\\S]{0,250}?${escaped}`).test(joined)) failures.push('must sign the exact serialized request body');
  if (!new RegExp(`body\\s*:\\s*${escaped}\\b`).test(joined)) failures.push('must send the same serialized bytes that were signed');
}

requirePattern(/new\s+URL\s*\(|URL\s*\(/, 'must parse and validate MP_PAYOUTS_NOTIFICATION_URL');
requirePattern(/protocol[\s\S]{0,160}?https:|https:[\s\S]{0,160}?protocol/i, 'notification URL must require HTTPS');
forbidPattern(/MP_PAYOUTS_NOTIFICATION_URL\s*=\s*https?:\/\/(?:localhost|127\.0\.0\.1)/i, 'notification URL must not default to localhost');
forbidPattern(/https:\/\/api\.mercadopago\.com\/(?:v1\/)?disbursements/i, 'obsolete disbursements endpoint is forbidden; use current Payouts contract');
forbidPattern(/https:\/\/api\.mercadopago\.com\/v1\/advanced_payments/i, 'Advanced Payments is not Payouts');
if (/sdk\.mercadopago\.com|MP_PUBLIC_KEY|cardForm\s*\(|data-mp-checkout-cta/i.test(`${createJoined}\n${lookupJoined}\n${payoutUiSource}`)) {
  failures.push('Payouts is server-only and must not add Checkout UI, MercadoPago.js, or a public key to its routes or UI');
}

if (country === 'AR') {
  requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/payouts(?:["'`/?]|\$\{)/, 'Argentina must create through /v1/payouts');
  requirePattern(/transactions\s*:/, 'Argentina Payouts must build a transactions batch');
  requirePattern(/type\s*:\s*["']account["']/, 'Argentina Payouts transaction type must be account');
  requirePattern(/currency\s*:\s*["']ARS["']/, 'Argentina Payouts currency must be ARS');
  requirePattern(/(?:length\s*<\s*1|length\s*===\s*0)[\s\S]{0,300}?length\s*>\s*1000|length\s*>\s*1000[\s\S]{0,300}?(?:length\s*<\s*1|length\s*===\s*0)/, 'Argentina Payouts must validate a batch of 1 to 1000 transactions');
  if (/transaction-intents\/process/.test(joined)) failures.push('Argentina must not use the Brazil Transaction Intent contract');
} else {
  requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/transaction-intents\/process/, 'Brazil must create through /v1/transaction-intents/process');
  requirePattern(/type\s*:\s*["']PSP_TRANSFER["']/, 'Brazil Transaction Intent type must be PSP_TRANSFER');
  requirePattern(/currency\s*:\s*["']BRL["']/, 'Brazil bank-transfer currency must be BRL');
  requirePattern(/account_type\s*:\s*["']current["']|accountType\s*:\s*["']current["']/, 'Brazil destination account type must be current');
  requirePattern(/(?:from|source)[\s\S]{0,600}?(?:to|destination)[\s\S]{0,600}?total_amount|total_amount[\s\S]{0,600}?(?:from|source)[\s\S]{0,600}?(?:to|destination)/i, 'Brazil must build matching source, destination, and total amounts');
  requirePattern(/(?:source|from).*amount.*===?.*(?:destination|to).*amount|(?:source|from)Amount\s*!==?\s*(?:destination|to)Amount|amountsEqual|assertEqualAmounts/is, 'Brazil must validate that source, destination, and total amounts are equal');
  if (/\/v1\/payouts/.test(joined)) failures.push('Brazil must not use the Argentina batch Payouts contract');
}

requirePattern(/(?:accepted|created|pending|processing)/i, 'must model the accepted response as asynchronous');
requirePattern(/(?:processed|approved|completed|failed|rejected|cancelled|canceled)/i, 'must model at least one terminal reconciliation status');
requirePattern(/(?:save|update|persist)[\s\S]{0,400}?(?:status|payoutId|transactionId)|(?:status|payoutId|transactionId)[\s\S]{0,400}?(?:save|update|persist)/i, 'must persist remote IDs and status transitions');
if (!/api\.mercadopago\.com[\s\S]{0,1600}?(?:payouts|transaction-intents)\/\$\{|(?:payouts|transaction-intents)\/\$\{[\s\S]{0,1600}?api\.mercadopago\.com/.test(lookupJoined)) {
  failures.push('GET /api/payouts/:id must query the created Mercado Pago resource');
}
if (/res\.json\s*\([^\n]*(?:account|email|pix|bank|branch|holder|document|transactions)/i.test(`${createJoined}\n${lookupJoined}`)) {
  failures.push('internal Payouts responses must not expose destination or holder data');
}
forbidPattern(/(?:console|logger)\.(?:log|info|debug|warn|error)\s*\([^\n]*(?:MP_ACCESS_TOKEN|PRIVATE_KEY|privateKey|pixKey|accountNumber|holder|destination)/i, 'must not log Payouts credentials, keys, or destination details');

if (failures.length) {
  console.error(`Payouts validation failed for ${appRoot} (${country}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  root: appRoot,
  country,
  filesScanned: files.length,
  payoutFilesScanned: payoutSources.length,
  serverOnly: true,
  persistedIdempotency: true,
  productionSignature: 'ed25519'
}, null, 2));
