#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smokeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(smokeRoot, '../..');
const pluginRoot = path.join(repoRoot, 'plugins/mercadopago');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-wallet-connect-gate-'));

function snapshot(root) {
  const result = new Map();
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else result.set(path.relative(root, fullPath), fs.readFileSync(fullPath));
    }
  }
  collect(root);
  return result;
}

try {
  const appRoot = path.join(temporaryRoot, 'store');
  fs.mkdirSync(appRoot);
  fs.writeFileSync(path.join(appRoot, 'package.json'), '{"scripts":{"start":"node server.js"}}\n');
  fs.writeFileSync(path.join(appRoot, 'server.js'), 'console.log("store")\n');
  fs.writeFileSync(path.join(appRoot, 'index.html'), '<button>Finalizar compra</button>\n');
  const before = snapshot(appRoot);
  const claude = spawnSync('claude', [
    '--print', '--output-format', 'json', '--no-session-persistence',
    '--permission-mode', 'default', '--allowedTools', 'Read,Grep,Glob',
    '--model', 'sonnet', '--effort', 'medium', '--max-budget-usd', '1',
    '--plugin-dir', pluginRoot,
    '/mercadopago:mp-integrate product=wallet-connect country=AR\n\nNão tenho habilitação nem acordo comercial ativo de Wallet Connect. Valide o pré-requisito e não altere arquivo algum.',
  ], { cwd: appRoot, env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (claude.status !== 0) throw new Error(`Claude Wallet Connect gate failed with exit ${claude.status}\n${claude.stdout}\n${claude.stderr}`);
  const payload = JSON.parse(claude.stdout);
  const result = String(payload.result || '');
  if (!result.includes('BLOCKED: active Wallet Connect agreement required')) throw new Error(`Missing deterministic gate message:\n${result}`);
  if ((payload.permission_denials || []).length) throw new Error(`Gate attempted forbidden tools: ${JSON.stringify(payload.permission_denials)}`);
  const after = snapshot(appRoot);
  const names = new Set([...before.keys(), ...after.keys()]);
  const changed = [...names].filter(name => !before.has(name) || !after.has(name) || !before.get(name).equals(after.get(name)));
  if (changed.length) throw new Error(`Gate changed project files: ${changed.join(', ')}`);
  console.log(JSON.stringify({ status: 'passed', scenario: 'wallet-connect-no-agreement', projectMutations: 0, mcpRequired: false, agreementsCreated: 0, ordersCreated: 0 }, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
