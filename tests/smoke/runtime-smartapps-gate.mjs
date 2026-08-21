#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smokeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(smokeRoot, '../..');
const pluginRoot = path.join(repoRoot, 'plugins/mercadopago');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-smartapps-gate-'));

function snapshot(root) {
  const result = new Map();
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else if (entry.isFile()) result.set(path.relative(root, fullPath), fs.readFileSync(fullPath));
    }
  }
  collect(root);
  return result;
}

function assertUnchanged(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  const changed = [...names].filter(name => {
    if (!before.has(name) || !after.has(name)) return true;
    return !before.get(name).equals(after.get(name));
  });
  if (changed.length) throw new Error(`SmartApps gate changed project files: ${changed.join(', ')}`);
}

try {
  const appRoot = path.join(temporaryRoot, 'inventory-terminal');
  fs.mkdirSync(path.join(appRoot, 'app/src/main'), { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'settings.gradle.kts'), 'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\n');
  fs.writeFileSync(path.join(appRoot, 'app/build.gradle.kts'), 'plugins { id("com.android.application") }\n');
  fs.writeFileSync(path.join(appRoot, 'app/src/main/AndroidManifest.xml'), '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application /></manifest>\n');
  const before = snapshot(appRoot);

  const claude = spawnSync('claude', [
    '--print',
    '--output-format', 'json',
    '--no-session-persistence',
    '--permission-mode', 'default',
    '--allowedTools', 'Read,Grep,Glob',
    '--model', 'sonnet',
    '--effort', 'medium',
    '--max-budget-usd', '1',
    '--plugin-dir', pluginRoot,
    '/mercadopago:mp-integrate product=smartapps country=AR\n\nNão tenho acordo ativo de SmartApps com o Mercado Pago. Valide o pré-requisito e não altere arquivo algum.',
  ], {
    cwd: appRoot,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (claude.status !== 0) {
    throw new Error(`Claude SmartApps gate smoke failed with exit ${claude.status}\n${claude.stdout}\n${claude.stderr}`);
  }

  const payload = JSON.parse(claude.stdout);
  const result = String(payload.result || '');
  if (!result.includes('BLOCKED: active SmartApps agreement required')) {
    throw new Error(`SmartApps gate did not return the deterministic block message:\n${result}`);
  }
  if ((payload.permission_denials || []).length) {
    throw new Error(`SmartApps gate attempted a forbidden tool: ${JSON.stringify(payload.permission_denials)}`);
  }

  assertUnchanged(before, snapshot(appRoot));
  console.log(JSON.stringify({
    status: 'passed',
    scenario: 'smartapps-no-agreement',
    projectMutations: 0,
    mcpRequired: false,
    deviceRequired: false,
  }, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
