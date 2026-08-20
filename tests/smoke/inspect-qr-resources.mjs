#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [sellerCredentialsPath] = process.argv.slice(2);
if (!sellerCredentialsPath) {
  console.error('Usage: node inspect-qr-resources.mjs <seller.env>');
  process.exit(2);
}

function parseEnv(file) {
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.at(-1) === quote) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

async function jsonResponse(response, context) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.message || payload.error || payload.code || 'unknown error';
    throw new Error(`${context} failed with HTTP ${response.status}: ${detail}`);
  }
  return payload;
}

const seller = parseEnv(path.resolve(sellerCredentialsPath));
if (!seller.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');

const headers = { Authorization: `Bearer ${seller.MP_ACCESS_TOKEN}` };
const account = await jsonResponse(
  await fetch('https://api.mercadopago.com/users/me', { headers }),
  'Seller account lookup',
);
const userId = account.id;
if (!userId) throw new Error('Seller account lookup returned no user ID');

const [posPayload, storesPayload] = await Promise.all([
  jsonResponse(
    await fetch('https://api.mercadopago.com/pos?limit=100&offset=0', { headers }),
    'POS list',
  ),
  jsonResponse(
    await fetch(`https://api.mercadopago.com/users/${encodeURIComponent(userId)}/stores/search?limit=100&offset=0`, { headers }),
    'Store list',
  ),
]);

const posResults = Array.isArray(posPayload) ? posPayload : (posPayload.results || posPayload.data || []);
const storeResults = Array.isArray(storesPayload) ? storesPayload : (storesPayload.results || storesPayload.data || []);

const report = {
  sellerProfile: 'seller-a',
  userId,
  siteId: account.site_id || null,
  pos: posResults.map(pos => ({
    id: pos.id || null,
    externalId: pos.external_id || null,
    name: pos.name || null,
    storeId: pos.store_id || null,
    fixedAmount: pos.fixed_amount ?? null,
    category: pos.category ?? null,
    hasStaticQrImage: Boolean(pos.qr?.image),
    hasStaticQrTemplate: Boolean(pos.qr?.template_document),
  })),
  stores: storeResults.map(store => ({
    id: store.id || null,
    externalId: store.external_id || null,
    name: store.name || null,
  })),
};

console.log(JSON.stringify(report, null, 2));
