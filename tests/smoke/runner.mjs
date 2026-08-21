#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smokeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(smokeRoot, '../..');
const pluginRoot = path.join(repoRoot, 'plugins/mercadopago');
const defaultSource = path.resolve(repoRoot, '../rubistore_codex');
const args = process.argv.slice(2);

function valueAfter(flag, fallback = '') {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function selected(flag) {
  return args.includes(flag);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} failed with exit code ${result.status}${detail ? `\n${detail}` : ''}`);
  }
  return result;
}

function writeDiffStat(before, after, destination) {
  const ignoredDirectories = new Set(['.git', 'node_modules']);
  function filesUnder(root, relative = '', result = new Map()) {
    const directory = path.join(root, relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) filesUnder(root, child, result);
      else if (entry.isFile()) result.set(child, fs.readFileSync(path.join(root, child)));
    }
    return result;
  }

  const oldFiles = filesUnder(before);
  const newFiles = filesUnder(after);
  const paths = [...new Set([...oldFiles.keys(), ...newFiles.keys()])].sort();
  const changes = [];
  for (const file of paths) {
    if (!oldFiles.has(file)) changes.push(`A ${file} (${newFiles.get(file).length} bytes)`);
    else if (!newFiles.has(file)) changes.push(`D ${file}`);
    else if (!oldFiles.get(file).equals(newFiles.get(file))) {
      changes.push(`M ${file} (${oldFiles.get(file).length} -> ${newFiles.get(file).length} bytes)`);
    }
  }
  fs.writeFileSync(destination, changes.length ? `${changes.join('\n')}\n` : 'No file changes detected.\n');
}

function assertFile(file, description) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${description} not found: ${file}`);
  }
}

function safeId(value) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value)) throw new Error(`Unsafe id: ${value}`);
  return value;
}

function archiveApp(source, ref, app, target) {
  const archive = path.join(target, `${app}.tar`);
  run('git', ['-C', source, 'archive', '--format=tar', `--output=${archive}`, ref, app]);
  run('tar', ['-xf', archive, '-C', target]);
  fs.unlinkSync(archive);
  return path.join(target, app);
}

function ensureProfile(profile) {
  safeId(profile.id);
  if (!profile.sellerCredentialsFile) throw new Error(`Profile ${profile.id} has no sellerCredentialsFile`);
  if (!profile.buyerCredentialsFile) throw new Error(`Profile ${profile.id} has no buyerCredentialsFile`);
  const sellerCredentialsFile = path.resolve(profile.sellerCredentialsFile);
  const buyerCredentialsFile = path.resolve(profile.buyerCredentialsFile);
  assertFile(sellerCredentialsFile, `Seller credentials file for ${profile.id}`);
  assertFile(buyerCredentialsFile, `Buyer credentials file for ${profile.id}`);
  if (!Number.isFinite(profile.maxTestAmount) || profile.maxTestAmount <= 0) {
    throw new Error(`Profile ${profile.id} needs a positive maxTestAmount`);
  }
  return { ...profile, sellerCredentialsFile, buyerCredentialsFile };
}

const configFile = path.resolve(valueAfter('--scenarios', path.join(smokeRoot, 'scenarios.json')));
const source = path.resolve(valueAfter('--source', process.env.RUBISTORE_PATH || defaultSource));
const profilesFileValue = valueAfter('--profiles', process.env.MP_SMOKE_PROFILES || '');
const scenarioFilter = valueAfter('--scenario');
const profileFilter = valueAfter('--profile');
const maxBudgetUsd = valueAfter('--max-budget-usd', '5');
const config = readJson(configFile);

assertFile(path.join(source, '.git/HEAD'), 'Rubistore Git checkout');
assertFile(path.join(pluginRoot, '.claude-plugin/plugin.json'), 'Local Mercado Pago plugin');
run('git', ['-C', source, 'cat-file', '-e', `${config.sourceRef}^{commit}`]);

const scenarios = config.scenarios
  .filter(item => !scenarioFilter || item.id === scenarioFilter)
  .map(item => ({ ...item, id: safeId(item.id), app: safeId(item.app) }));

if (!scenarios.length) throw new Error('No smoke scenarios selected');

let profiles = [];
if (profilesFileValue) {
  const profilesFile = path.resolve(profilesFileValue);
  assertFile(profilesFile, 'Profiles file');
  profiles = readJson(profilesFile).profiles.map(ensureProfile)
    .filter(item => !profileFilter || item.id === profileFilter);
}

const matrix = scenarios.flatMap(scenario =>
  (profiles.length ? profiles : [{ id: '<profile-required>' }]).map(profile => ({
    scenario: scenario.id,
    profile: profile.id,
    app: scenario.app,
    product: scenario.product,
    ref: config.sourceRef,
  })),
);

console.log(JSON.stringify({ source, pluginRoot, matrix }, null, 2));

if (selected('--dry-run')) process.exit(0);
if (!profiles.length) {
  throw new Error('Execution requires --profiles <ignored-local-json> or MP_SMOKE_PROFILES');
}

const workRoot = path.join(smokeRoot, '.work');
fs.mkdirSync(workRoot, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

for (const scenario of scenarios) {
  for (const profile of profiles) {
    const runId = `${timestamp}-${scenario.id}-${profile.id}`;
    const target = path.join(workRoot, runId);
    fs.mkdirSync(target, { recursive: false });
    const appRoot = archiveApp(source, config.sourceRef, scenario.app, target);
    const baselineRoot = path.join(target, 'baseline');
    fs.cpSync(appRoot, baselineRoot, { recursive: true });
    fs.writeFileSync(path.join(target, 'prompt.txt'), `${scenario.prompt}\n`, { mode: 0o600 });
    fs.writeFileSync(path.join(target, 'run.json'), `${JSON.stringify({
      runId,
      scenario: scenario.id,
      profile: profile.id,
      sourceRef: config.sourceRef,
      appRoot,
      sellerCredentialsFile: profile.sellerCredentialsFile,
      buyerCredentialsFile: profile.buyerCredentialsFile,
      maxTestAmount: profile.maxTestAmount,
    }, null, 2)}\n`);

    console.log(`Prepared ${runId} at ${appRoot}`);
    if (selected('--prepare')) continue;
    if (!selected('--execute')) throw new Error('Choose --prepare, --execute, or --dry-run');

    const claude = spawnSync('claude', [
      '--print',
      '--output-format', 'json',
      '--no-session-persistence',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Grep,Glob,Edit,Write,Bash(node *),Bash(npm *)',
      '--model', 'sonnet',
      '--effort', 'medium',
      '--max-budget-usd', maxBudgetUsd,
      '--plugin-dir', pluginRoot,
      `/mercadopago:mp-integrate${scenario.commandArguments ? ` ${scenario.commandArguments}` : ''}\n\n${scenario.prompt}`,
    ], {
      cwd: appRoot,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    fs.writeFileSync(path.join(target, 'claude.stdout.json'), claude.stdout || '');
    fs.writeFileSync(path.join(target, 'claude.stderr.log'), claude.stderr || '');
    if (claude.status !== 0) throw new Error(`Claude failed for ${runId}; inspect ${target}`);

    if (['checkout-pro', 'checkout-api'].includes(scenario.product)) {
      const ctaValidator = path.join(pluginRoot, 'scripts/validate-checkout-cta.mjs');
      run(process.execPath, [
        ctaValidator,
        scenario.product,
        path.join(appRoot, scenario.ctaFile),
        scenario.destination,
      ], { cwd: appRoot });
    }

    if (scenario.product === 'checkout-pro') {
      const proServerValidator = path.join(pluginRoot, 'scripts/validate-checkout-pro-server.mjs');
      run(process.execPath, [proServerValidator, path.join(appRoot, scenario.serverFile)], { cwd: appRoot });
    }

    if (scenario.product === 'checkout-api') {
      const screenValidator = path.join(pluginRoot, 'scripts/validate-checkout-screen.mjs');
      run(process.execPath, [
        screenValidator,
        path.join(appRoot, scenario.checkoutScreen),
        path.join(appRoot, scenario.serverFile),
        path.join(appRoot, scenario.ctaFile),
      ], { cwd: appRoot });
    }

    if (scenario.product === 'point') {
      const pointServerValidator = path.join(pluginRoot, 'scripts/validate-point-server.mjs');
      run(process.execPath, [pointServerValidator, path.join(appRoot, scenario.serverFile)], { cwd: appRoot });
      const pointClientValidator = path.join(pluginRoot, 'scripts/validate-point-client.mjs');
      run(process.execPath, [
        pointClientValidator,
        path.join(appRoot, scenario.pointClientFile),
        scenario.pointClientMarker,
        scenario.destination,
      ], { cwd: appRoot });
    }

    if (scenario.product === 'qr') {
      const qrServerValidator = path.join(pluginRoot, 'scripts/validate-qr-server.mjs');
      run(process.execPath, [qrServerValidator, path.join(appRoot, scenario.serverFile)], { cwd: appRoot });
      const qrClientValidator = path.join(pluginRoot, 'scripts/validate-qr-client.mjs');
      run(process.execPath, [
        qrClientValidator,
        path.join(appRoot, scenario.qrClientFile),
        scenario.qrClientMarker,
        scenario.destination,
      ], { cwd: appRoot });
    }

    if (scenario.product === 'bricks') {
      const bricksValidator = path.join(pluginRoot, 'scripts/validate-bricks-integration.mjs');
      run(process.execPath, [bricksValidator, appRoot, scenario.bricksVariant], { cwd: appRoot });
    }

    if (scenario.product === 'subscriptions') {
      const subscriptionsValidator = path.join(pluginRoot, 'scripts/validate-subscriptions-integration.mjs');
      run(process.execPath, [subscriptionsValidator, appRoot, scenario.subscriptionsModel], { cwd: appRoot });
    }

    if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) {
      throw new Error(`Claude left .mp-integrate-progress.md after successful scaffold: ${appRoot}`);
    }

    writeDiffStat(baselineRoot, appRoot, path.join(target, 'changes.stat'));
    console.log(`Validated ${runId}`);
  }
}

console.log(`Smoke preparation completed on ${os.hostname()}. Payment execution remains disabled.`);
