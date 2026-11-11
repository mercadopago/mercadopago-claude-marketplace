#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [rootValue, appKind, ownership] = process.argv.slice(2);
const appKinds = new Set(['main', 'mini']);
const ownershipModes = new Set(['own', 'third-party']);

if (!rootValue || !appKinds.has(appKind) || !ownershipModes.has(ownership)) {
  console.error('Uso: node validate-smartapps-integration.mjs <raíz-app> <main|mini> <own|third-party>');
  process.exit(2);
}

const appRoot = path.resolve(rootValue);
if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) {
  console.error(`No se encontró la raíz de la aplicación SmartApps: ${appRoot}`);
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
const warnings = new Set();

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

// Resolución deliberadamente limitada: nunca ejecutar Gradle ni evaluar código.
// Un valor dinámico o ambiguo requiere revisión; no es un error demostrado.
function uncomment(source) {
  return source.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match, quoted) => quoted || ' ');
}

function expressionAt(source, start) {
  let index = start;
  while (/\s/.test(source[index] || '') && index < source.length) index++;
  const begin = index;
  const stack = [];
  let quote = '';
  for (; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) {
      if (!stack.length) break;
      stack.pop();
    } else if (!stack.length && (char === ',' || char === ';' || char === '\n')) break;
  }
  return source.slice(begin, index).trim();
}

function splitTopLevel(source, delimiter) {
  const parts = [];
  let start = 0;
  let quote = '';
  const stack = [];
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) stack.pop();
    else if (char === delimiter && !stack.length) { parts.push(source.slice(start, i).trim()); start = i + 1; }
  }
  return [...parts, source.slice(start).trim()];
}

function calls(source, name) {
  const result = [];
  const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf('(');
    let depth = 1;
    let quote = '';
    for (let i = open + 1; i < source.length; i++) {
      const char = source[i];
      if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === '(') depth++;
      else if (char === ')' && --depth === 0) { result.push(splitTopLevel(source.slice(open + 1, i), ',')); break; }
    }
  }
  return result;
}

function addValue(map, name, value) {
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(value);
}

function decodeXml(value) {
  return value.replace(/&#x([\da-f]+);|&#(\d+);|&(quot|apos|amp|lt|gt);/gi, (all, hex, dec, named) => {
    if (hex || dec) {
      const code = Number.parseInt(hex || dec, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' })[named.toLowerCase()];
  });
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)]
    .map(match => [match[1], decodeXml(match[3])]));
}

const properties = new Map();
const variables = new Map();
const placeholders = new Map();
const resources = new Map();
const buildFields = new Map();
const cleanCode = uncomment(codeSource);
const cleanGradle = uncomment(gradleSource);
for (const item of sources) {
  if (path.basename(item.file) === 'gradle.properties') {
    for (const match of item.source.matchAll(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/gm)) {
      addValue(properties, match[1], JSON.stringify(match[2]));
    }
  }
  if (/[/\\]res[/\\]values[/\\][^/\\]+\.xml$/.test(item.file)) {
    const xml = item.source.replace(/<!--[\s\S]*?-->/g, '');
    for (const match of xml.matchAll(/<string\b([^>]*)>([^<]*)<\/string\s*>/g)) {
      const name = attributes(match[1]).name;
      const value = decodeXml(match[2]).trim();
      if (name) addValue(resources, name, value.startsWith('@string/') ? value : JSON.stringify(value));
    }
  }
}
for (const source of [cleanCode, cleanGradle]) {
  for (const match of source.matchAll(/\b(?:val|var|String|long|Long)\s+(\w+)(?:\s*:\s*[\w?.<>]+)?\s*=\s*/g)) {
    addValue(variables, match[1], expressionAt(source, match.index + match[0].length));
  }
}
for (const match of cleanGradle.matchAll(/\bmanifestPlaceholders\s*\[\s*["']([\w.-]+)["']\s*\]\s*=\s*/g)) {
  addValue(placeholders, match[1], expressionAt(cleanGradle, match.index + match[0].length));
}
for (const match of cleanGradle.matchAll(/\bmanifestPlaceholders\s*(?:\+?=|\.putAll\s*\()\s*/g)) {
  const body = expressionAt(cleanGradle, match.index + match[0].length);
  for (const entry of body.matchAll(/(?:["']([\w.-]+)["']|\b([\w.-]+))\s*(?::|\bto\b)\s*/g)) {
    addValue(placeholders, entry[1] || entry[2], expressionAt(body, entry.index + entry[0].length));
  }
}
for (const args of calls(cleanGradle, 'buildConfigField')) {
  if (/^["']String["']$/.test(args[0] || '') && /^["'][\w]+["']$/.test(args[1] || '')) {
    addValue(buildFields, args[1].slice(1, -1), args[2] || '');
  }
}

const unknown = () => ({ value: null, min: null, max: null, safe: null, generated: false, type: 'unknown' });
const literal = (value, type = 'string') => ({ value, min: value.length, max: value.length, safe: /^[A-Za-z0-9_-]*$/.test(value), generated: false, type });
function combine(parts) {
  return {
    value: parts.every(part => part.value !== null) ? parts.map(part => part.value).join('') : null,
    min: parts.every(part => part.min !== null) ? parts.reduce((sum, part) => sum + part.min, 0) : null,
    max: parts.every(part => part.max !== null) ? parts.reduce((sum, part) => sum + part.max, 0) : null,
    safe: parts.some(part => part.safe === false) ? false : parts.every(part => part.safe === true) ? true : null,
    generated: parts.some(part => part.generated),
    type: 'string',
  };
}
function resolveName(map, name, seen) {
  const values = map.get(name);
  const kind = [properties, variables, placeholders, resources, buildFields].indexOf(map);
  if (!values || values.size !== 1 || seen.has(`${kind}:${name}`)) return unknown();
  const next = new Set(seen).add(`${kind}:${name}`);
  return evaluate([...values][0], next);
}
function evaluate(expression, seen = new Set()) {
  if (!expression || seen.size > 12) return unknown();
  const expr = expression.trim();
  const concatenation = splitTopLevel(expr, '+');
  if (concatenation.length > 1) {
    const parts = concatenation.map(part => evaluate(part, seen));
    // No interpretar aritmética como concatenación de texto.
    return parts.some(part => part.type === 'numeric') ? unknown() : combine(parts);
  }
  if (/^(?:java\.util\.)?UUID\.randomUUID\(\)(?:\.toString\(\))?$/.test(expr)) {
    return { value: null, min: 36, max: 36, safe: true, generated: true, type: 'string' };
  }
  if (/^\d+[lL]?$/.test(expr)) return literal(expr.replace(/[lL]$/, ''), 'numeric');
  if ((expr[0] === '"' || expr[0] === "'") && expr.at(-1) === expr[0]) {
    let body = expr.slice(1, -1);
    // No se interpretan cadenas triples ni escapes no reconocidos.
    if (body.includes(expr[0] + expr[0]) || /\\(?![\\'"nrtbf$u]|u[\da-f]{4})/i.test(body)) return unknown();
    const parts = [];
    let start = 0;
    const decode = text => text.replace(/\\u([\da-f]{4})|\\([\\'"nrtbf$])/gi, (_, hex, escaped) => hex
      ? String.fromCharCode(Number.parseInt(hex, 16))
      : ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[escaped] ?? escaped);
    for (const match of body.matchAll(/(?<!\\)\$\{([^{}]+)\}|(?<!\\)\$([A-Za-z_]\w*)/g)) {
      parts.push(literal(decode(body.slice(start, match.index))));
      parts.push(evaluate(match[1] || match[2], seen));
      start = match.index + match[0].length;
    }
    parts.push(literal(decode(body.slice(start))));
    return combine(parts);
  }
  const resource = expr.match(/^@string\/([\w]+)$/) || expr.match(/^(?:getString|resources\.getString)\(R\.string\.([\w]+)\)$/);
  if (resource) return resolveName(resources, resource[1], seen);
  const property = expr.match(/^(?:(?:project\.)?(?:findProperty|property)|providers\.gradleProperty)\(["']([\w.-]+)["']\)(?:\.get\(\)|\s+as\s+String|\.toString\(\))?$/);
  if (property) return resolveName(properties, property[1], seen);
  const field = expr.match(/^BuildConfig\.([\w]+)$/);
  if (field) {
    const value = resolveName(buildFields, field[1], seen);
    return value.value !== null && /^"[^"]*"$/.test(value.value) ? literal(value.value.slice(1, -1)) : unknown();
  }
  const stringified = expr.match(/^String\.valueOf\(([\s\S]+)\)$/) || expr.match(/^([\s\S]+)\.toString\(\)$/);
  if (stringified) return { ...evaluate(stringified[1], seen), type: 'string' };
  if (/^[A-Za-z_]\w*$/.test(expr)) {
    for (const map of [placeholders, variables, properties]) {
      const kind = [properties, variables, placeholders, resources, buildFields].indexOf(map);
      if (map.has(expr) && !seen.has(`${kind}:${expr}`)) return resolveName(map, expr, seen);
    }
  }
  return unknown();
}

const metadata = [...manifestSource.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<meta-data\b[^>]*>/g)]
  .map(match => attributes(match[0]));
const clientIds = metadata.filter(item => item['android:name'] === 'com.mercadolibre.android.sdk.CLIENT_ID');
function manifestValue(raw) {
  if (!raw) return unknown();
  if (raw.startsWith('@string/')) return evaluate(raw);
  const parts = [];
  let start = 0;
  for (const match of raw.matchAll(/\$\{([\w.-]+)\}/g)) {
    parts.push(literal(raw.slice(start, match.index)));
    parts.push(resolveName(placeholders, match[1], new Set()));
    start = match.index + match[0].length;
  }
  parts.push(literal(raw.slice(start)));
  return combine(parts);
}
const clientIdCheck = { scope: 'source_values', manifest: 'unverified', initialization: 'unverified', coherence: 'unverified' };
const resolvedManifestIds = new Set();
if (!clientIds.length) failures.push('AndroidManifest debe declarar la metadata exacta CLIENT_ID de SmartApps');
for (const metadataItem of clientIds) {
  const raw = metadataItem['android:value'];
  if (!raw) { failures.push('La metadata CLIENT_ID debe declarar android:value'); continue; }
  const result = manifestValue(raw);
  if (result.value === null) {
    warnings.add('No se pudo resolver CLIENT_ID desde los archivos fuente; revisar el manifiesto combinado de la variante antes de compilar o entregar.');
  } else if (!/^\d+L$/.test(result.value) || /^(?:123456789|0)L$/.test(result.value)) {
    failures.push('El CLIENT_ID resuelto del manifiesto debe ser numérico y terminar en una sola L, sin valores de ejemplo.');
  } else resolvedManifestIds.add(result.value.slice(0, -1));
}
if (clientIds.length && resolvedManifestIds.size === 1) {
  const allResolved = clientIds.every(item => /^\d+L$/.test(manifestValue(item['android:value']).value || ''));
  if (allResolved) clientIdCheck.manifest = 'verified';
}
if (resolvedManifestIds.size > 1) warnings.add('Hay CLIENT_ID distintos en los manifiestos fuente; seleccionar y revisar la variante antes de comparar su inicialización.');
const initializedIds = new Set();
const configurations = calls(cleanCode, 'MPConfigBuilder');
for (const args of configurations) {
  const result = evaluate((args[1] || '').replace(/^clientId\s*=\s*/, ''));
  if (result.value === null) continue;
  if (!/^\d+$/.test(result.value)) failures.push('El String de Client ID enviado a MPConfigBuilder debe contener solo dígitos; la L pertenece a la metadata del manifiesto.');
  else initializedIds.add(result.value);
}
if (initializedIds.size === 1 && configurations.length === 1) clientIdCheck.initialization = 'verified';
if (clientIdCheck.manifest === 'verified' && clientIdCheck.initialization === 'verified') {
  if ([...resolvedManifestIds][0] !== [...initializedIds][0]) failures.push('El CLIENT_ID resuelto del manifiesto no coincide con el usado por MPConfigBuilder.');
  else clientIdCheck.coherence = 'verified';
} else if (clientIds.length) warnings.add('No se pudo comprobar una única correspondencia entre CLIENT_ID e inicialización; requiere revisión de la variante y sus valores resueltos.');

const referenceExpressions = [];
for (const args of calls(cleanCode, 'PaymentTransactionMetadata')) {
  const named = args.find(argument => /^externalReference\s*=/.test(argument));
  if (named) referenceExpressions.push(named.replace(/^externalReference\s*=\s*/, ''));
  // SDK 7.0.0: (flowId, externalReference, cartData, posSaleId, tipAmount, congratsUrl).
  else if (args[1] && args.every(argument => !/^\w+\s*=/.test(argument))) referenceExpressions.push(args[1]);
}
const referenceChecks = [...new Set(referenceExpressions)].map(expression => {
  const result = evaluate(expression);
  const invalid = result.safe === false || result.max === 0 || (result.min !== null && result.min > 64);
  const verified = !invalid && result.safe === true && result.min !== null && result.min > 0 && result.max <= 64;
  if (invalid) failures.push('externalReference debe contener entre 1 y 64 caracteres: solo letras ASCII, números, guiones y guiones bajos.');
  else if (!verified) warnings.add('No se pudo comprobar el formato de externalReference: validar el valor generado antes de iniciar el pago.');
  if (!result.generated) warnings.add('No se pudo comprobar un generador de referencias por transacción; revisar la unicidad y persistencia del intento.');
  return { format: invalid ? 'invalid' : verified ? 'verified' : 'unverified', generation: result.generated ? 'generator_detected' : 'unverified' };
});
if (!referenceChecks.length) warnings.add('No se pudo vincular una expresión de externalReference con el pago; revisar su formato y generación por transacción.');

const declaredSdkVersions = [...new Set([...cleanGradle.matchAll(/nativesdk-(\d+\.\d+\.\d+)\.aar/g)].map(match => match[1]))];
if (declaredSdkVersions.length === 1 && declaredSdkVersions[0] === '7.0.0' && /\b(?:PaymentRequestData|PaymentFlowCallback|getPaymentMethodsList)\b/.test(cleanCode)) {
  failures.push('El código usa APIs posteriores a la versión 7.0.0 declarada; utiliza PaymentFlowRequestData, getPaymentMethods y el callback MPResponse.');
}
if (declaredSdkVersions.length !== 1 || declaredSdkVersions[0] !== '7.0.0') warnings.add('No se comprobó una declaración única de nativesdk 7.0.0; confirmar la Release oficial y el artefacto elegido sin actualizarlo automáticamente.');

if (fs.existsSync(path.join(appRoot, '.mp-integrate-progress.md'))) {
  failures.push('.mp-integrate-progress.md debe eliminarse después de generar correctamente los archivos');
}

if (!manifests.length) failures.push('Se requiere AndroidManifest.xml; una SmartApp necesita un proyecto Android');
if (!gradleSource) failures.push('Se requiere un módulo Android con Gradle');
if (!codeSource) failures.push('Se requiere código de aplicación en Kotlin o Java');

requirePattern(gradleSource, /\bminSdk(?:Version)?\s*(?:=|\s)\s*[^\s}]+/, 'Se debe declarar minSdk para el dispositivo Point Smart seleccionado');
const packageCandidates = [
  ...gradleSource.matchAll(/\b(?:namespace|applicationId)\s*(?:=\s*)?["']([^"']+)["']/g),
  ...manifestSource.matchAll(/<manifest\b[^>]*\bpackage=["']([^"']+)["']/g),
].map(match => match[1]);
if (!packageCandidates.length) {
  failures.push('Se debe declarar namespace/applicationId de Android');
} else {
  for (const packageName of packageCandidates) {
    if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){2,}$/.test(packageName)) {
      failures.push(`Nombre de paquete SmartApps inválido: ${packageName}`);
    }
    if (/mercado(?:pago|livre)/i.test(packageName)) {
      failures.push('El nombre de paquete no debe usar los nombres Mercado Pago o Mercado Libre');
    }
  }
}

requirePattern(
  gradleSource,
  /implementation\s*(?:\(|\s)\s*(?:files|fileTree)\s*\([^\n)]*(?:nativesdk|smartapps)[^\n)]*\.aar|implementation\s+files\s*\([^\n)]*(?:nativesdk|smartapps)[^\n)]*\.aar/i,
  'Gradle debe declarar el AAR SmartApps (nativesdk) de la Release oficial del SDK',
);
forbidPattern(
  gradleSource,
  /com\.mercadopago:(?:sdk|sdk-android)|github\.com\/mercadopago\/sdk/i,
  'Un SDK backend/web de Mercado Pago no debe reemplazar el AAR SmartApps',
);
forbidPattern(
  gradleSource,
  /com\.google\.android\.gms|com\.google\.firebase|firebase-(?:core|analytics|messaging|auth)/i,
  'Point Smart usa Android AOSP; esta integración genérica no admite Google Play Services/Firebase',
);

const hasHomeCategory = /<category\b[^>]*android:name=["']android\.intent\.category\.HOME["'][^>]*>/i.test(manifestSource);
if (appKind === 'main' && !hasHomeCategory) failures.push('Una SmartApp main debe declarar android.intent.category.HOME');
if (appKind === 'mini' && hasHomeCategory) failures.push('Una SmartApp mini no debe declarar android.intent.category.HOME');
requirePattern(manifestSource, /<action\b[^>]*android:name=["']android\.intent\.action\.MAIN["'][^>]*>/i, 'La actividad de inicio debe declarar android.intent.action.MAIN');
requirePattern(manifestSource, /<category\b[^>]*android:name=["']android\.intent\.category\.LAUNCHER["'][^>]*>/i, 'La actividad de inicio debe declarar android.intent.category.LAUNCHER');
if (appKind === 'main') {
  requirePattern(manifestSource, /<category\b[^>]*android:name=["']android\.intent\.category\.DEFAULT["'][^>]*>/i, 'Una SmartApp main debe declarar android.intent.category.DEFAULT');
}

const oauthMetadata = metadata.find(item => item['android:name'] === 'com.mercadolibre.android.sdk.OAUTH_ENABLED');
const oauthEnabled = oauthMetadata?.['android:value'] === 'true';
if (ownership === 'third-party' && !oauthEnabled) failures.push('Una SmartApp para terceros debe declarar OAUTH_ENABLED=true');
if (ownership === 'own' && oauthEnabled) failures.push('Una SmartApp para terminales propias no debe habilitar OAuth de terceros');

forbidPattern(manifestSource, /android:(?:debuggable|testOnly)=["']true["']/i, 'No se admiten las opciones debug/test-only en el manifiesto de entrega');
forbidPattern(manifestSource, /android:allowBackup=["']true["']/i, 'No se admite android:allowBackup=true');
forbidPattern(manifestSource, /android:usesCleartextTraffic=["']true["']|cleartextTrafficPermitted=["']true["']/i, 'No se admite tráfico en texto claro');

const forbiddenPermissions = [
  'BLUETOOTH', 'BLUETOOTH_ADMIN', 'BLUETOOTH_ADVERTISE', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN',
  'CAMERA', 'NFC', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
  'MANAGE_EXTERNAL_STORAGE', 'QUERY_ALL_PACKAGES', 'REQUEST_INSTALL_PACKAGES', 'SYSTEM_ALERT_WINDOW',
  'USB_PERMISSION', 'USB_SET', 'USE_BIOMETRIC', 'USE_FINGERPRINT', 'ACCESS_WIFI_STATE',
];
for (const permission of forbiddenPermissions) {
  const pattern = new RegExp(`android:name=["']android\\.permission\\.${permission}["']`, 'i');
  if (pattern.test(manifestSource)) failures.push(`No se admite el permiso Android directo ${permission}; utiliza la capacidad del SDK de Mercado Pago`);
}

forbidPattern(
  joined,
  /br\.com\.uol\.pagseguro|cielo\.lio\.permission|com\.getnet|com\.pax|com\.sunmi/i,
  'No se admiten librerías o permisos de terminales de pago de terceros',
);
forbidPattern(
  joined,
  /(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}|client[_-]?secret\s*[=:]\s*["'][^"']+["']/i,
  'La SmartApp no debe incluir credenciales ni client secrets',
);
forbidPattern(
  codeSource,
  /api\.mercadopago\.com|\/v1\/(?:payments|orders)|\/checkout\/preferences/i,
  'El cobro en la terminal debe utilizar el SDK SmartApps, sin llamadas directas a las API de pagos',
);

requirePattern(codeSource, /class\s+\w+\s*:\s*Application\s*\(|extends\s+Application\b/, 'El SDK debe inicializarse en una clase Application de Android');
requirePattern(codeSource, /MPConfigBuilder\s*\(/, 'La SmartApp debe configurar el SDK con MPConfigBuilder');
requirePattern(codeSource, /MPManager(?:\.INSTANCE)?\.initialize\s*\(/, 'La SmartApp debe inicializar MPManager');
requirePattern(codeSource, /paymentMethodsTools[\s\S]{0,200}?getPaymentMethods(?:List)?\s*(?:\(|\{)/i, 'Los medios de pago deben obtenerse mediante getPaymentMethods del SDK 7.0.0');
requirePattern(codeSource, /launchPaymentFlow\s*\(/, 'Los pagos deben iniciarse mediante el flujo del SDK SmartApps');
requirePattern(codeSource, /doIfSuccess\s*(?:\(|\{)|onSuccess\s*\(/, 'El flujo de pago debe manejar las respuestas de éxito');
requirePattern(codeSource, /doIfError\s*(?:\(|\{)|onError\s*\(/, 'El flujo de pago debe manejar los errores con mensajes accionables');
requirePattern(cleanCode, /external_reference|externalReference|PaymentTransactionMetadata\s*\(/, 'Cada transacción debe incluir una referencia externa de conciliación');

if (failures.length) {
  console.error(`Falló la validación SmartApps para ${appRoot}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: warnings.size ? 'review_required' : 'passed',
  root: appRoot,
  appKind,
  ownership,
  filesScanned: files.length,
  manifests: manifests.length,
  sdkOnlyPaymentFlow: true,
  staticOnly: true,
  clientId: clientIdCheck,
  externalReferences: referenceChecks,
  sdkVersionDeclaration: declaredSdkVersions,
  warnings: [...warnings],
  limitations: [
    'Se revisan archivos fuente; no se inspecciona el manifiesto combinado ni el APK.',
    'La declaración del AAR no verifica su presencia, autenticidad ni versión binaria.',
    'Detectar un generador no demuestra unicidad por intento ni conciliación del pago.',
  ],
}, null, 2));
