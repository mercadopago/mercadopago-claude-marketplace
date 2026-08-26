#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue] = process.argv.slice(2);
if (!rootValue) {
  console.error('Usage: node validate-wallet-connect-integration.mjs <app-root>');
  process.exit(2);
}
const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`Wallet Connect application root not found: ${appRoot}`);
  process.exit(2);
}

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.work']);
const extensions = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte', '.astro', '.php', '.ejs', '.hbs', '.env']);
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
const walletPageSource = sources
  .filter(item => /data-mp-wallet-connect-page=["']account-linking["']/.test(item.source))
  .map(item => item.source)
  .join('\n');
const failures = [];
const requirePattern = (pattern, message) => { if (!pattern.test(joined)) failures.push(message); };
const forbidPattern = (pattern, message) => { if (pattern.test(joined)) failures.push(message); };

function routeBodies(source, routeName) {
  const bodies = [];
  const pattern = new RegExp(`\\b(?:app|router)\\.post\\s*\\(\\s*["']${routeName}["']`, 'g');
  for (const match of source.matchAll(pattern)) {
    const remainder = source.slice(match.index);
    const next = remainder.slice(match[0].length).search(/\n\s*(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/);
    bodies.push(next === -1 ? remainder : remainder.slice(0, match[0].length + next));
  }
  return bodies;
}

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) failures.push('.mp-integrate-progress.md must be deleted after a successful scaffold');

requirePattern(/data-mp-wallet-connect-page=["']account-linking["']/, 'must create a dedicated Wallet Connect account-linking page');
requirePattern(/data-mp-wallet-connect-entry=["']checkout["']/, 'must wire and mark the real checkout entry CTA');
requirePattern(/data-mp-wallet-connect-cta=["']start["']/, 'dedicated page must expose the approval-start CTA');
requirePattern(/data-mp-wallet-connect-cta=["']pay["']/, 'dedicated page must expose the connected payment CTA');

for (const variable of ['MP_ACCESS_TOKEN', 'MP_WALLET_PLATFORM_ID', 'MP_WALLET_RETURN_URI', 'MP_WALLET_TOKEN_ENCRYPTION_KEY']) {
  requirePattern(new RegExp(`process\\.env\\.${variable}|${variable}\\s*=`), `must use server configuration ${variable}`);
}
requirePattern(/https:\/\/api\.mercadopago\.com\/v2\/wallet_connect\/agreements(?:["'`/]|\$\{)/, 'must create Wallet Connect agreements through /v2/wallet_connect/agreements');
requirePattern(/agreements\/[\s\S]{0,200}?payer_token|agreements\/\$\{[^}]+\}\/payer_token/, 'must exchange the approval code for a payer token');
requirePattern(/["']x-platform-id["']\s*:|\.set\(["']x-platform-id["']/, 'agreement and payer-token requests must send x-platform-id');
requirePattern(/agreement_uri|agreementUri/, 'must redirect only to the agreement URI returned by Mercado Pago');
requirePattern(/external_user\s*:/, 'agreement creation must include an external_user derived from authenticated server state');
requirePattern(/agreementRepository|agreementStore|walletRepository|walletStore/, 'agreements and payer tokens must use persistent repository storage');
forbidPattern(/(?:agreementRepository|agreementStore|walletRepository|walletStore|purchaseRepository|purchaseStore)\s*=\s*(?:new\s+Map\s*\(|\{\s*\})/i, 'Wallet Connect repositories must be durable, not in-memory Map/object storage');
requirePattern(/(?:encrypt|seal)[A-Za-z]*(?:Token|Secret|Credential)?\s*\(/i, 'payer token must be encrypted at rest');
requirePattern(/(?:decrypt|open)[A-Za-z]*(?:Token|Secret|Credential)?\s*\(/i, 'payer token must be decrypted only for the outgoing order');
requirePattern(/(?:consume|delete|remove|usedAt|used_at)[\s\S]{0,500}?(?:code|agreement)|(?:code|agreement)[\s\S]{0,500}?(?:consume|delete|remove|usedAt|used_at)/i, 'approval code must be validated and consumed once');
requirePattern(/pending\.(?:agreementId|agreement_id)\s*!==?\s*(?:req\.query\.)?agreement|(?:req\.query\.)?agreement\s*!==?\s*pending\.(?:agreementId|agreement_id)/, 'callback must bind the returned agreement ID to the pending agreement stored for that state');
forbidPattern(/(?:res\.json|res\.send)\s*\([^\n]*(?:payer_token|payerToken|approvalCode|\bcode\b)/i, 'must not return payer token or approval code to the browser');
forbidPattern(/(?:console|logger)\.(?:log|info|debug|warn|error)\s*\([^\n]*(?:payer_token|payerToken|approvalCode|MP_ACCESS_TOKEN)/i, 'must not log Wallet Connect secrets');
forbidPattern(/(?:localStorage|sessionStorage|document\.cookie)[\s\S]{0,200}?(?:payer_token|payerToken|agreement_id|agreementId|approvalCode)/i, 'must not store Wallet Connect secrets in the browser');

requirePattern(/https:\/\/api\.mercadopago\.com\/v1\/orders/, 'Wallet Connect payments must use Orders API');
requirePattern(/type\s*:\s*["']online["']/, 'Wallet Connect order type must be online');
requirePattern(/capture_mode\s*:\s*["']automatic["']/, 'Wallet Connect order must use automatic capture');
requirePattern(/payment_method\s*:\s*\{[\s\S]{0,300}?type\s*:\s*["']wallet["'][\s\S]{0,300}?id\s*:\s*["']wallet["']|payment_method\s*:\s*\{[\s\S]{0,300}?id\s*:\s*["']wallet["'][\s\S]{0,300}?type\s*:\s*["']wallet["']/, 'payment method must be wallet/wallet');
requirePattern(/stored_credential\s*:\s*\{[\s\S]{0,300}?reason\s*:\s*["']recurring["'][\s\S]{0,300}?payment_initiator\s*:\s*["']merchant["']|stored_credential\s*:\s*\{[\s\S]{0,300}?payment_initiator\s*:\s*["']merchant["'][\s\S]{0,300}?reason\s*:\s*["']recurring["']/, 'Wallet Connect order must include recurring merchant stored-credential metadata');
requirePattern(/["']X-Idempotency-Key["']\s*:|idempotencyKey\s*:/, 'Wallet Connect order creation must be idempotent');
requirePattern(/external_reference\s*:/, 'Wallet Connect order needs a trusted external_reference');
requirePattern(/toFixed\s*\(\s*2\s*\)/, 'Wallet Connect amounts must be normalized to two-decimal strings');
requirePattern(/(?:purchase|cart|order)(?:Repository|Store|Service)?[\s\S]{0,500}?(?:get|find|load|resolve)|derive(?:Purchase|Cart|Order)\s*\(/i, 'buyer and amount must derive from trusted server-side commerce state');
forbidPattern(/req\.body\.(?:payer_token|payerToken|amount|total|price|external_user|externalUser|agreement_id|agreementId|stored_credential)/, 'browser must not choose payer token, agreement, buyer identity, amount, or stored credential');
const unsafePurchaseBootstrap = sources.some(({ source }) => routeBodies(source, '/api/purchases').some(body =>
  /req\.body|postData|request\.body/i.test(body)
  && /(?:unit_price|unitPrice|\bprice\b|\btotal\b|\bamount\b|\bpayer\b|\bemail\b)/i.test(body)
));
if (unsafePurchaseBootstrap) failures.push('purchase bootstrap may accept only product IDs and quantities; server must reprice and resolve buyer identity');
if (/<input[^>]+(?:name|id)=["'][^"']*(?:cardNumber|expirationDate|securityCode|card_token|cardToken)[^"']*["']/i.test(walletPageSource)) {
  failures.push('Wallet Connect page must not render raw card or token inputs');
}
if (/sdk\.mercadopago\.com|\.cardForm\s*\(|\.create\(\s*["']wallet["']|<Wallet\b|MP_PUBLIC_KEY/.test(walletPageSource)) {
  failures.push('Wallet Connect page must not load MercadoPago.js, Wallet Brick, or MP_PUBLIC_KEY');
}
forbidPattern(/https:\/\/api\.mercadopago\.com\/v1\/advanced_payments/, 'Wallet Connect scaffold must use Orders API, not Advanced Payments');
requirePattern(/(?:loading|carreg|cargand|inicializ)/i, 'must render a loading state');
requirePattern(/(?:approval|aprova|autoriza|vincula)/i, 'must render an approval-required state');
requirePattern(/(?:connected|conectad|vinculad)/i, 'must render a connected state');
requirePattern(/(?:processing|processando|procesando)/i, 'must render a processing state');
requirePattern(/(?:success|sucesso|aprovad|acreditad)/i, 'must render a success state');
requirePattern(/(?:error|erro|tente novamente|intentá nuevamente)/i, 'must render an actionable error state');

if (failures.length) {
  console.error(`Wallet Connect validation failed for ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ status: 'passed', root: appRoot, filesScanned: files.length, dedicatedPage: true, encryptedPayerToken: true, ordersApi: true }, null, 2));
