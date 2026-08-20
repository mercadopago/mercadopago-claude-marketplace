#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const [baseUrlValue, sellerCredentialsPath, artifactDirectory, amountValue = '15', externalPosId = '001'] = process.argv.slice(2);
if (!baseUrlValue || !sellerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-qr.mjs <base-url|direct> <seller.env> <artifact-directory> [amount] [external-pos-id]');
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

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function jsonResponse(response, context) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.message || payload.error || payload.code || JSON.stringify(payload);
    throw new Error(`${context} failed with HTTP ${response.status}: ${detail || 'unknown error'}`);
  }
  return payload;
}

const useGeneratedApp = baseUrlValue !== 'direct';
const baseUrl = useGeneratedApp ? new URL(baseUrlValue).origin : null;
const seller = parseEnv(path.resolve(sellerCredentialsPath));
const artifacts = path.resolve(artifactDirectory);
const amountNumber = Number(amountValue);
const amount = amountNumber.toFixed(2);
const allowedExternalPosId = /^[A-Za-z0-9_-]{1,40}$/;

if (!seller.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');
if (!Number.isFinite(amountNumber) || amountNumber !== 15) {
  throw new Error('Argentina QR smoke tests must use exactly the API minimum of ARS 15');
}
if (!allowedExternalPosId.test(externalPosId)) throw new Error('Invalid external POS ID');
fs.mkdirSync(artifacts, { recursive: true });

const mpHeaders = {
  Authorization: `Bearer ${seller.MP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

async function findPos() {
  const payload = await jsonResponse(
    await fetch('https://api.mercadopago.com/pos?limit=100&offset=0', { headers: mpHeaders }),
    'POS lookup',
  );
  const results = Array.isArray(payload) ? payload : (payload.results || payload.data || []);
  const pos = results.find(item => item.external_id === externalPosId);
  if (!pos) throw new Error(`No seller-a POS found with external_id=${externalPosId}`);
  if (!pos.store_id) throw new Error(`POS ${externalPosId} is not linked to a Store`);
  return pos;
}

async function lookupOrder(orderId) {
  return jsonResponse(
    await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: mpHeaders }),
    `QR order ${orderId} lookup`,
  );
}

async function cleanupStaleSmokeOrders() {
  const search = new URL('https://api.mercadopago.com/v1/orders');
  search.searchParams.set('begin_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  search.searchParams.set('end_date', new Date().toISOString());
  search.searchParams.set('type', 'qr');
  search.searchParams.set('page', '1');
  search.searchParams.set('page_size', '100');
  search.searchParams.set('sort_by', 'created_date');
  search.searchParams.set('sort_order', 'desc');
  const payload = await jsonResponse(await fetch(search, { headers: mpHeaders }), 'Recent QR order search');
  for (const order of payload.data || []) {
    const reference = String(order.external_reference || '');
    if (!reference.startsWith('qrsuite') && !reference.startsWith('brewpoint-qr-')) continue;
    if (order.config?.qr?.external_pos_id !== externalPosId || order.status !== 'created') continue;
    try {
      await jsonResponse(await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
        headers: { ...mpHeaders, 'X-Idempotency-Key': randomUUID() },
      }), `Stale QR order ${order.id} cleanup`);
      console.log(`CLEANUP QR stale smoke order: ${order.id} -> canceled`);
    } catch (error) {
      if (!/HTTP 404|doesn't exist|not found/i.test(error.message)) throw error;
      console.log(`SKIP QR stale search result no longer available: ${order.id}`);
    }
  }
}

function assertOrder(order, mode) {
  if (order.type !== 'qr') throw new Error(`${mode} order has unexpected type ${order.type || 'missing'}`);
  if (order.config?.qr?.external_pos_id !== externalPosId) throw new Error(`${mode} order has the wrong external_pos_id`);
  if (order.config?.qr?.mode !== mode) throw new Error(`${mode} order returned mode ${order.config?.qr?.mode || 'missing'}`);
  if (order.total_amount !== amount) throw new Error(`${mode} order total_amount is ${order.total_amount || 'missing'}, expected ${amount}`);
  if (order.transactions?.payments?.[0]?.amount !== amount) throw new Error(`${mode} payment amount does not match ${amount}`);
  if (order.status !== 'created') throw new Error(`${mode} order started in unexpected status ${order.status || 'missing'}`);
}

async function createDirect(mode) {
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: { ...mpHeaders, 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      type: 'qr',
      total_amount: amount,
      external_reference: `qrsuite${randomUUID().replaceAll('-', '')}`.slice(0, 64),
      expiration_time: 'PT5M',
      config: { qr: { external_pos_id: externalPosId, mode } },
      transactions: { payments: [{ amount }] },
    }),
  });
  return jsonResponse(response, `Direct QR ${mode} creation`);
}

async function createThroughGeneratedApp() {
  const payload = await jsonResponse(await fetch(`${baseUrl}/api/qr/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountNumber,
      items: [{ name: 'QR smoke item', price: amountNumber, qty: 1 }],
    }),
  }), 'Generated QR create route');
  const orderId = payload.orderId || payload.order_id || payload.id;
  if (!orderId) throw new Error('Generated QR create route returned no order ID');
  try {
    if (!payload.qrData && !payload.qr_data) throw new Error('Generated dynamic QR route returned no qrData');
    const generatedLookup = await jsonResponse(
      await fetch(`${baseUrl}/api/qr/orders/${encodeURIComponent(orderId)}`),
      'Generated QR lookup route',
    );
    if ((generatedLookup.orderId || generatedLookup.order_id || generatedLookup.id) !== orderId) {
      throw new Error('Generated QR lookup route returned a different order ID');
    }
    if (!generatedLookup.status) throw new Error('Generated QR lookup route returned no status');
    const order = await lookupOrder(orderId);
    assertOrder(order, 'dynamic');
    return { order, responseHasQrData: true };
  } catch (error) {
    try {
      await jsonResponse(await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: { ...mpHeaders, 'X-Idempotency-Key': randomUUID() },
      }), 'Failed generated QR order cleanup');
    } catch (cleanupError) {
      error.message += `; cleanup failed: ${cleanupError.message}`;
    }
    throw error;
  }
}

async function cancelOrder(orderId, throughGeneratedApp) {
  const response = throughGeneratedApp
    ? await fetch(`${baseUrl}/api/qr/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' })
    : await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: { ...mpHeaders, 'X-Idempotency-Key': randomUUID() },
    });
  await jsonResponse(response, `${throughGeneratedApp ? 'Generated' : 'Direct'} QR cancellation`);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const order = await lookupOrder(orderId);
    if (order.status === 'canceled') return order.status;
    await sleep(500);
  }
  throw new Error(`QR order ${orderId} did not reach canceled`);
}

const report = {
  status: 'running',
  sellerProfile: 'seller-a',
  amount,
  currency: 'ARS',
  externalPosId,
  generatedAppIncluded: useGeneratedApp,
  scenarios: [],
};
let activeOrder = null;

try {
  const pos = await findPos();
  report.pos = {
    id: pos.id,
    storeId: pos.store_id,
    hasStaticQrImage: Boolean(pos.qr?.image),
    hasStaticQrTemplate: Boolean(pos.qr?.template_document),
  };
  if (!report.pos.hasStaticQrImage) throw new Error(`POS ${externalPosId} has no static QR image`);

  await cleanupStaleSmokeOrders();

  const modes = useGeneratedApp ? ['generated-dynamic', 'static', 'hybrid'] : ['dynamic', 'static', 'hybrid'];
  for (const scenario of modes) {
    const mode = scenario === 'generated-dynamic' ? 'dynamic' : scenario;
    try {
      let order;
      let responseHasQrData;
      if (scenario === 'generated-dynamic') {
        const generated = await createThroughGeneratedApp();
        order = generated.order;
        responseHasQrData = generated.responseHasQrData;
      } else {
        order = await createDirect(mode);
        assertOrder(order, mode);
        responseHasQrData = Boolean(order.type_response?.qr_data);
      }
      activeOrder = { id: order.id, generated: scenario === 'generated-dynamic' };
      if (['dynamic', 'hybrid'].includes(mode) && !responseHasQrData) {
        throw new Error(`${mode} order returned no type_response.qr_data`);
      }
      if (mode === 'static' && !report.pos.hasStaticQrImage) throw new Error('Static mode has no POS QR image');
      const finalStatus = await cancelOrder(activeOrder.id, activeOrder.generated);
      report.scenarios.push({
        name: scenario,
        mode,
        orderId: activeOrder.id,
        responseHasQrData,
        staticQrAvailable: mode !== 'dynamic' ? report.pos.hasStaticQrImage : null,
        finalStatus,
        passed: true,
      });
      console.log(`PASS QR ${scenario}: created -> ${finalStatus}`);
      activeOrder = null;
    } catch (error) {
      report.scenarios.push({ name: scenario, mode, orderId: activeOrder?.id || null, passed: false, error: error.message });
      throw error;
    } finally {
      fs.writeFileSync(path.join(artifacts, 'qr-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    }
  }
  report.status = 'passed';
  report.runId = randomUUID();
  fs.writeFileSync(path.join(artifacts, 'qr-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('QR runtime validation passed');
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  if (activeOrder?.id) {
    try {
      report.cleanupStatus = await cancelOrder(activeOrder.id, activeOrder.generated);
    } catch (cleanupError) {
      report.cleanupError = cleanupError.message;
    }
  }
  fs.writeFileSync(path.join(artifacts, 'qr-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  throw error;
}
