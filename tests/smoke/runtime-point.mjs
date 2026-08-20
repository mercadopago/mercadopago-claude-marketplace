#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const [baseUrlValue, sellerCredentialsPath, artifactDirectory, amountValue = '15', scenarioFilterValue = ''] = process.argv.slice(2);
if (!baseUrlValue || !sellerCredentialsPath || !artifactDirectory) {
  console.error('Usage: node runtime-point.mjs <base-url> <seller.env> <artifact-directory> [amount] [scenario,...]');
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

const baseUrl = new URL(baseUrlValue).origin;
const seller = parseEnv(path.resolve(sellerCredentialsPath));
const artifacts = path.resolve(artifactDirectory);
const amount = Number(amountValue);
const virtualTerminal = 'NEWLAND_N950__SBX0000001';
const standardSimulationTimeout = 75_000;
const actionRequiredSimulationTimeout = 90_000;
const testReferencePrefix = 'brewpoint-point-';
const terminalBlockingStatuses = new Set(['created', 'at_terminal']);

if (!seller.MP_ACCESS_TOKEN) throw new Error('Missing MP_ACCESS_TOKEN in seller credentials file');
if (!Number.isFinite(amount) || amount !== 15) {
  throw new Error('Argentina Point virtual smoke tests must use exactly the API minimum of ARS 15');
}
fs.mkdirSync(artifacts, { recursive: true });

const mpHeaders = {
  Authorization: `Bearer ${seller.MP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

async function jsonResponse(response, context) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.message || payload.error || payload.code || JSON.stringify(payload);
    throw new Error(`${context} failed with HTTP ${response.status}: ${detail || 'unknown error'}`);
  }
  return payload;
}

async function createOrder() {
  const response = await fetch(`${baseUrl}/api/point/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  const payload = await jsonResponse(response, 'Generated Point create route');
  const orderId = payload.orderId || payload.order_id || payload.id;
  if (!orderId) throw new Error('Generated Point create route returned no order ID');

  const orderResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: mpHeaders,
  });
  const order = await jsonResponse(orderResponse, 'Initial Point order lookup');
  if (order.type !== 'point') throw new Error(`Created order has unexpected type: ${order.type || 'missing'}`);
  if (order.config?.point?.terminal_id !== virtualTerminal) {
    throw new Error(`Created order did not target the standard virtual terminal`);
  }
  if (order.transactions?.payments?.[0]?.amount !== amount.toFixed(2)) {
    throw new Error(`Created order amount is not formatted as ${amount.toFixed(2)}`);
  }
  return { orderId, initialStatus: order.status };
}

async function simulate(orderId, event) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/events`, {
    method: 'POST',
    headers: mpHeaders,
    body: JSON.stringify(event),
  });
  await jsonResponse(response, `Point simulation ${event.status}`);
}

async function cancelOrderIfBlocking(orderId, context) {
  const lookup = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: mpHeaders,
  });
  const order = await jsonResponse(lookup, `${context} lookup`);
  if (!terminalBlockingStatuses.has(order.status)) return false;
  await simulate(orderId, { status: 'canceled' });
  await waitForStatus(orderId, 'canceled', standardSimulationTimeout);
  console.log(`CLEANUP Point ${context}: ${orderId} -> canceled`);
  return true;
}

async function cleanupStaleVirtualOrders() {
  const search = new URL('https://api.mercadopago.com/v1/orders');
  search.searchParams.set('begin_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  search.searchParams.set('end_date', new Date().toISOString());
  search.searchParams.set('type', 'point');
  search.searchParams.set('page', '1');
  search.searchParams.set('page_size', '100');
  search.searchParams.set('sort_by', 'created_date');
  search.searchParams.set('sort_order', 'desc');
  const response = await fetch(search, { headers: mpHeaders });
  const payload = await jsonResponse(response, 'Recent Point order search');
  for (const order of payload.data || []) {
    if (order.config?.point?.terminal_id !== virtualTerminal) continue;
    if (!String(order.external_reference || '').startsWith(testReferencePrefix)) continue;
    if (!terminalBlockingStatuses.has(order.status)) continue;
    try {
      await cancelOrderIfBlocking(order.id, 'stale virtual order');
    } catch (error) {
      if (!/HTTP 404|intent not found/i.test(error.message)) throw error;
      console.log(`SKIP Point stale order without active intent: ${order.id}`);
    }
  }
}

async function waitForStatus(orderId, expectedStatus, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  const transitions = [];
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/point/orders/${encodeURIComponent(orderId)}`);
    const order = await jsonResponse(response, 'Generated Point lookup route');
    if (order.status && transitions.at(-1) !== order.status) transitions.push(order.status);
    if (order.status === expectedStatus) return transitions;
    await sleep(1_000);
  }
  throw new Error(`Order ${orderId} did not reach ${expectedStatus}; observed ${transitions.join(' -> ') || 'no status'}`);
}

const scenarios = [
  {
    name: 'processed',
    expectedStatus: 'processed',
    event: {
      status: 'processed',
      payment_method_type: 'credit_card',
      installments: 1,
      payment_method_id: 'visa',
      status_detail: 'accredited',
    },
    timeout: standardSimulationTimeout,
  },
  {
    name: 'failed-insufficient-amount',
    expectedStatus: 'failed',
    event: {
      status: 'failed',
      payment_method_type: 'credit_card',
      installments: 1,
      payment_method_id: 'visa',
      status_detail: 'insufficient_amount',
    },
    timeout: standardSimulationTimeout,
  },
  {
    name: 'refunded',
    optIn: true,
    expectedStatus: 'refunded',
    prerequisite: {
      expectedStatus: 'processed',
      event: {
        status: 'processed',
        payment_method_type: 'credit_card',
        installments: 1,
        payment_method_id: 'visa',
        status_detail: 'accredited',
      },
    },
    event: { status: 'refunded' },
    prerequisiteSettleMilliseconds: 10_000,
    timeout: standardSimulationTimeout,
  },
  { name: 'canceled', expectedStatus: 'canceled', event: { status: 'canceled' }, timeout: standardSimulationTimeout },
  { name: 'expired', expectedStatus: 'expired', event: { status: 'expired' }, timeout: standardSimulationTimeout },
  { name: 'action-required', expectedStatus: 'action_required', event: { status: 'action_required' }, timeout: actionRequiredSimulationTimeout },
];
const scenarioFilter = new Set(scenarioFilterValue.split(',').filter(Boolean));
const selectedScenarios = scenarioFilter.size
  ? scenarios.filter(scenario => scenarioFilter.has(scenario.name))
  : scenarios.filter(scenario => !scenario.optIn);
if (!selectedScenarios.length) throw new Error(`No matching Point scenarios: ${scenarioFilterValue}`);

const report = {
  status: 'running',
  sellerProfile: 'seller-a',
  virtualTerminal,
  amount,
  currency: 'ARS',
  skippedByDefault: scenarioFilter.size
    ? []
    : scenarios.filter(scenario => scenario.optIn).map(scenario => scenario.name),
  scenarios: [],
};

let activeOrderId = '';
try {
  await cleanupStaleVirtualOrders();
  for (const scenario of selectedScenarios) {
    let created;
    try {
      created = await createOrder();
      activeOrderId = created.orderId;
      const transitions = [];
      if (scenario.prerequisite) {
        await simulate(created.orderId, scenario.prerequisite.event);
        transitions.push(...await waitForStatus(
          created.orderId,
          scenario.prerequisite.expectedStatus,
          standardSimulationTimeout,
        ));
        if (scenario.prerequisiteSettleMilliseconds) {
          await sleep(scenario.prerequisiteSettleMilliseconds);
        }
      }
      await simulate(created.orderId, scenario.event);
      for (const status of await waitForStatus(created.orderId, scenario.expectedStatus, scenario.timeout)) {
        if (transitions.at(-1) !== status) transitions.push(status);
      }
      report.scenarios.push({
        name: scenario.name,
        orderId: created.orderId,
        initialStatus: created.initialStatus,
        expectedStatus: scenario.expectedStatus,
        transitions,
        passed: true,
      });
      console.log(`PASS Point ${scenario.name}: ${transitions.join(' -> ')}`);
    } catch (error) {
      report.scenarios.push({
        name: scenario.name,
        orderId: created?.orderId || null,
        expectedStatus: scenario.expectedStatus,
        passed: false,
        error: error.message,
      });
      console.error(`FAIL Point ${scenario.name}: ${error.message}`);
      if (activeOrderId) {
        try {
          await cancelOrderIfBlocking(activeOrderId, `failed ${scenario.name}`);
        } catch (cleanupError) {
          report.scenarios.at(-1).cleanupError = cleanupError.message;
        }
      }
    } finally {
      activeOrderId = '';
      fs.writeFileSync(path.join(artifacts, 'point-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    }
  }
  report.status = report.scenarios.every(scenario => scenario.passed) ? 'passed' : 'failed';
  report.runId = randomUUID();
  fs.writeFileSync(path.join(artifacts, 'point-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  if (report.status === 'passed') {
    console.log('Point virtual-terminal runtime validation passed');
  } else {
    process.exitCode = 1;
    console.error('Point virtual-terminal runtime validation completed with failures');
  }
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  if (activeOrderId) {
    try {
      await cancelOrderIfBlocking(activeOrderId, 'failed scenario');
    } catch (cleanupError) {
      report.cleanupError = cleanupError.message;
    }
  }
  fs.writeFileSync(path.join(artifacts, 'point-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  throw error;
}
