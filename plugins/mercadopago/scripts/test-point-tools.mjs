#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDirectory, '..');
const serverValidator = path.join(scriptDirectory, 'validate-point-server.mjs');
const clientValidator = path.join(scriptDirectory, 'validate-point-client.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-point-tools-'));

function validate(name, source, expectedStatus, expectedMessage = '', validator = serverValidator) {
  const file = path.join(temporaryDirectory, `${name}.mjs`);
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, [validator, file], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing expected diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

const validSource = `
  import { randomUUID } from 'node:crypto';
  const VIRTUAL_POINT_TERMINAL = 'NEWLAND_N950__SBX0000001';
  const testMode = process.env.MP_POINT_TEST_MODE === 'true';
  const terminalId = process.env.MP_POINT_TERMINAL_ID || (testMode ? VIRTUAL_POINT_TERMINAL : '');
  const amount = Number(input).toFixed(2);
  fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      type: 'point', external_reference: randomUUID(),
      transactions: { payments: [{ amount }] },
      config: { point: { terminal_id: terminalId } }
    })
  });
  fetch(\`https://api.mercadopago.com/v1/orders/\${orderId}\`);
`;

const validClient = `
  <button data-mp-point-cta="create-order">Cobrar</button>
  <script>
    fetch('/api/point/orders', { method: 'POST' });
    fetch('/api/point/orders/' + orderId);
    const statuses = ['processed', 'failed', 'refunded', 'canceled', 'expired', 'action_required'];
  </script>
`;

try {
  validate('valid-virtual-point', validSource, 0);
  validate('legacy-payment-intent', validSource.replace(
    'https://api.mercadopago.com/v1/orders',
    'https://api.mercadopago.com/point/integration-api/devices/device/payment-intents',
  ), 1, 'legacy Point Integration API');
  validate('wrong-point-payload', validSource
    .replace("type: 'point'", "type: 'instore'")
    .replace('config: { point: { terminal_id: terminalId } }', 'config: { device: { id: terminalId } }'),
  1, 'Point order must use type');
  validate('unguarded-virtual-terminal', validSource.replace(
    "process.env.MP_POINT_TERMINAL_ID || (testMode ? VIRTUAL_POINT_TERMINAL : '')",
    "process.env.MP_POINT_TERMINAL_ID || 'NEWLAND_N950__SBX0000001'",
  ), 1, 'virtual terminal fallback must be conditional');
  validate(
    'unsupported-point-installments',
    validSource.replace(
      'config: { point: { terminal_id: terminalId } }',
      'config: { point: { terminal_id: terminalId }, payment_method: { default_installments: 1 } }',
    ),
    1,
    'default_installments is not supported',
  );
  validate('valid-point-client', validClient, 0, '', clientValidator);
  validate(
    'point-client-missing-failed',
    validClient.replace("'failed', ", ''),
    1,
    'must handle the failed Point status explicitly',
    clientValidator,
  );

  const pointGuide = path.join(pluginRoot, 'skills/mp-integrate/references/guides/point.md');
  const guide = fs.readFileSync(pointGuide, 'utf8');
  const guideServer = guide.match(/### server\.js[\s\S]*?```js\n([\s\S]*?)```/)?.[1];
  if (!guideServer) throw new Error('canonical-point-guide: server.js block not found');
  const guideServerFile = path.join(temporaryDirectory, 'canonical-point-guide.mjs');
  fs.writeFileSync(guideServerFile, guideServer);
  const guideResult = spawnSync(process.execPath, [serverValidator, guideServerFile], { encoding: 'utf8' });
  if (guideResult.status !== 0) {
    throw new Error(`canonical-point-guide: failed validation\n${guideResult.stdout}${guideResult.stderr}`);
  }
  console.log('PASS canonical-point-guide: accepted');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
