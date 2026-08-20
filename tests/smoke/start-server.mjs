#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [appDirectory, credentialsPath, portValue, runtimeMode = 'default', runtimeResourceId = ''] = process.argv.slice(2);
if (!appDirectory || !credentialsPath || !portValue) {
  console.error('Usage: node start-server.mjs <app-directory> <seller.env> <port> [default|point-virtual|qr-dynamic] [resource-id]');
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
    if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    values[match[1]] = value;
  }
  return values;
}

const cwd = path.resolve(appDirectory);
const credentialsFile = path.resolve(credentialsPath);
const port = Number(portValue);

if (!fs.statSync(cwd).isDirectory()) throw new Error(`App directory not found: ${cwd}`);
if (!fs.statSync(credentialsFile).isFile()) throw new Error(`Credentials file not found: ${credentialsFile}`);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Invalid port: ${portValue}`);

const credentials = parseEnv(credentialsFile);
const requiredCredentials = ['point-virtual', 'qr-dynamic'].includes(runtimeMode)
  ? ['MP_ACCESS_TOKEN']
  : ['MP_ACCESS_TOKEN', 'MP_PUBLIC_KEY'];
for (const key of requiredCredentials) {
  if (!credentials[key]) throw new Error(`Missing ${key} in seller credentials file`);
}
if (!['default', 'point-virtual', 'qr-dynamic'].includes(runtimeMode)) throw new Error(`Unknown runtime mode: ${runtimeMode}`);
if (runtimeMode === 'qr-dynamic' && !/^[A-Za-z0-9_-]{1,40}$/.test(runtimeResourceId)) {
  throw new Error('qr-dynamic requires a valid POS external_id as resource-id');
}

const child = spawn('npm', ['start'], {
  cwd,
  env: {
    ...process.env,
    ...credentials,
    PORT: String(port),
    APP_URL: `http://localhost:${port}`,
    BASE_URL: `http://localhost:${port}`,
    ...(runtimeMode === 'point-virtual' ? {
      MP_POINT_TEST_MODE: 'true',
      MP_POINT_TERMINAL_ID: '',
    } : {}),
    ...(runtimeMode === 'qr-dynamic' ? {
      MP_QR_MODE: 'dynamic',
      MP_QR_EXTERNAL_POS_ID: runtimeResourceId,
      MP_QR_STATIC_IMAGE: '',
    } : {}),
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', code => process.exit(code ?? 1));
