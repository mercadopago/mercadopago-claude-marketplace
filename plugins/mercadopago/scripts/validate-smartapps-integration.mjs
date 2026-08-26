#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, appKind, ownership] = process.argv.slice(2);
const appKinds = new Set(['main', 'mini']);
const ownershipModes = new Set(['own', 'third-party']);

if (!rootValue || !appKinds.has(appKind) || !ownershipModes.has(ownership)) {
  console.error('Usage: node validate-smartapps-integration.mjs <app-root> <main|mini> <own|third-party>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`SmartApps application root not found: ${appRoot}`);
  process.exit(2);
}

const ignored = new Set(['.git', '.gradle', 'build', 'dist', 'node_modules', '.work']);
const extensions = new Set(['.xml', '.gradle', '.kts', '.kt', '.java', '.properties']);
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
}

collect(appRoot);
const sources = files.map(file => ({ file, source: fs.readFileSync(file, 'utf8') }));
const joined = sources.map(item => `\n/* ${path.relative(appRoot, item.file)} */\n${item.source}`).join('\n');
const manifests = sources.filter(item => path.basename(item.file) === 'AndroidManifest.xml');
const manifestSource = manifests.map(item => item.source).join('\n');
const gradleSource = sources
  .filter(item => /\.gradle(?:\.kts)?$/.test(item.file))
  .map(item => item.source)
  .join('\n');
const codeSource = sources
  .filter(item => /\.(?:kt|java)$/.test(item.file))
  .map(item => item.source)
  .join('\n');
const failures = [];

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) {
  failures.push('.mp-integrate-progress.md must be deleted after a successful scaffold');
}

if (!manifests.length) failures.push('AndroidManifest.xml is required; SmartApps cannot be scaffolded into a non-Android project');
if (!gradleSource) failures.push('an Android Gradle module is required');
if (!codeSource) failures.push('Kotlin or Java application code is required');

requirePattern(gradleSource, /\bminSdk(?:Version)?\s*(?:=|\s)\s*[^\s}]+/, 'Android minSdk must be declared for the selected Point Smart device');
const packageCandidates = [
  ...gradleSource.matchAll(/\b(?:namespace|applicationId)\s*(?:=\s*)?["']([^"']+)["']/g),
  ...manifestSource.matchAll(/<manifest\b[^>]*\bpackage=["']([^"']+)["']/g),
].map(match => match[1]);
if (!packageCandidates.length) {
  failures.push('Android namespace/applicationId must be declared');
} else {
  for (const packageName of packageCandidates) {
    if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){2,}$/.test(packageName)) {
      failures.push(`invalid SmartApps package name: ${packageName}`);
    }
    if (/mercado(?:pago|livre)/i.test(packageName)) {
      failures.push('SmartApps package name must not use Mercado Pago or Mercado Livre names');
    }
  }
}

requirePattern(
  gradleSource,
  /implementation\s*(?:\(|\s)\s*(?:files|fileTree)\s*\([^\n)]*(?:nativesdk|smartapps)[^\n)]*\.aar|implementation\s+files\s*\([^\n)]*(?:nativesdk|smartapps)[^\n)]*\.aar/i,
  'Gradle must load the Mercado Pago SmartApps AAR supplied by the integration kit',
);
forbidPattern(
  gradleSource,
  /com\.mercadopago:(?:sdk|sdk-android)|github\.com\/mercadopago\/sdk/i,
  'public Mercado Pago SDK coordinates must not replace the private SmartApps kit AAR',
);
forbidPattern(
  gradleSource,
  /com\.google\.android\.gms|com\.google\.firebase|firebase-(?:core|analytics|messaging|auth)/i,
  'Point Smart uses Android AOSP; Google Play Services/Firebase dependencies are forbidden by the generic scaffold',
);

requirePattern(
  manifestSource,
  /<meta-data\b[^>]*android:name=["']com\.mercadolibre\.android\.sdk\.CLIENT_ID["'][^>]*android:value=["'][^"']+["'][^>]*>/i,
  'AndroidManifest must declare the exact SmartApps CLIENT_ID metadata',
);
forbidPattern(
  manifestSource,
  /android:name=["']com\.mercadolibre\.android\.sdk\.CLIENT_ID["'][^>]*android:value=["'](?:CLIENT_ID_VALUE|CLIENT_ID|123456789)["']/i,
  'CLIENT_ID metadata must not retain a documentation placeholder',
);

const hasHomeCategory = /<category\b[^>]*android:name=["']android\.intent\.category\.HOME["'][^>]*>/i.test(manifestSource);
if (appKind === 'main' && !hasHomeCategory) failures.push('main SmartApp must declare android.intent.category.HOME');
if (appKind === 'mini' && hasHomeCategory) failures.push('mini SmartApp must not claim android.intent.category.HOME');
requirePattern(manifestSource, /<action\b[^>]*android:name=["']android\.intent\.action\.MAIN["'][^>]*>/i, 'SmartApps launcher activity must declare android.intent.action.MAIN');
requirePattern(manifestSource, /<category\b[^>]*android:name=["']android\.intent\.category\.LAUNCHER["'][^>]*>/i, 'SmartApps launcher activity must declare android.intent.category.LAUNCHER');
if (appKind === 'main') {
  requirePattern(manifestSource, /<category\b[^>]*android:name=["']android\.intent\.category\.DEFAULT["'][^>]*>/i, 'main SmartApp must declare android.intent.category.DEFAULT');
}

const oauthMetadata = manifestSource.match(/<meta-data\b[^>]*android:name=["']com\.mercadolibre\.android\.sdk\.OAUTH_ENABLED["'][^>]*>/i)?.[0] || '';
const oauthEnabled = /android:value=["']true["']/i.test(oauthMetadata);
if (ownership === 'third-party' && !oauthEnabled) failures.push('third-party SmartApps must set OAUTH_ENABLED=true');
if (ownership === 'own' && oauthEnabled) failures.push('own-terminal SmartApps must not enable third-party OAuth mode');

forbidPattern(manifestSource, /android:(?:debuggable|testOnly)=["']true["']/i, 'debug/test-only manifest flags are forbidden');
forbidPattern(manifestSource, /android:allowBackup=["']true["']/i, 'android:allowBackup=true is forbidden');
forbidPattern(manifestSource, /android:usesCleartextTraffic=["']true["']|cleartextTrafficPermitted=["']true["']/i, 'cleartext traffic is forbidden');

const forbiddenPermissions = [
  'BLUETOOTH', 'BLUETOOTH_ADMIN', 'BLUETOOTH_ADVERTISE', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN',
  'CAMERA', 'NFC', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
  'MANAGE_EXTERNAL_STORAGE', 'QUERY_ALL_PACKAGES', 'REQUEST_INSTALL_PACKAGES', 'SYSTEM_ALERT_WINDOW',
  'USB_PERMISSION', 'USB_SET', 'USE_BIOMETRIC', 'USE_FINGERPRINT', 'ACCESS_WIFI_STATE',
];
for (const permission of forbiddenPermissions) {
  const pattern = new RegExp(`android:name=["']android\\.permission\\.${permission}["']`, 'i');
  if (pattern.test(manifestSource)) failures.push(`direct Android permission ${permission} is forbidden; use the Mercado Pago SDK capability`);
}

forbidPattern(
  joined,
  /br\.com\.uol\.pagseguro|cielo\.lio\.permission|com\.getnet|com\.pax|com\.sunmi/i,
  'third-party payment-terminal libraries or permissions are forbidden',
);
forbidPattern(
  joined,
  /(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}|client[_-]?secret\s*[=:]\s*["'][^"']+["']/i,
  'credentials or client secrets must not be embedded in the SmartApp',
);
forbidPattern(
  codeSource,
  /api\.mercadopago\.com|\/v1\/(?:payments|orders)|\/checkout\/preferences/i,
  'terminal payment processing must use the SmartApps SDK, not direct Mercado Pago payment API calls',
);

requirePattern(codeSource, /class\s+\w+\s*:\s*Application\s*\(|extends\s+Application\b/, 'SDK initialization must live in an Android Application class');
requirePattern(codeSource, /MPConfigBuilder\s*\(/, 'SmartApps must configure the SDK with MPConfigBuilder');
requirePattern(codeSource, /MPManager(?:\.INSTANCE)?\.initialize\s*\(/, 'SmartApps must initialize MPManager');
requirePattern(codeSource, /paymentMethodsTools[\s\S]{0,200}?getPaymentMethods\s*(?:\(|\{)/i, 'payment methods must be discovered through getPaymentMethods');
requirePattern(codeSource, /launchPaymentFlow\s*\(/, 'payments must be launched through the SmartApps SDK payment flow');
requirePattern(codeSource, /doIfSuccess\s*(?:\(|\{)|onSuccess\s*\(/, 'payment flow must handle successful responses');
requirePattern(codeSource, /doIfError\s*(?:\(|\{)|onError\s*\(/, 'payment flow must handle actionable errors');
requirePattern(codeSource, /external_reference|externalReference/, 'each transaction needs a unique external reconciliation reference');
requirePattern(codeSource, /(?:UUID\.randomUUID|randomUUID|SecureRandom|uniquePaymentReference)/, 'transaction reconciliation reference must be generated uniquely');

if (failures.length) {
  console.error(`SmartApps validation failed for ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  root: appRoot,
  appKind,
  ownership,
  filesScanned: files.length,
  manifests: manifests.length,
  sdkOnlyPaymentFlow: true,
  staticOnly: true,
}, null, 2));
