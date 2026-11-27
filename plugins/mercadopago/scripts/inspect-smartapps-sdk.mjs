#!/usr/bin/env node

// Diagnóstico opcional de bibliotecas binarias. No ejecuta ni modifica el SDK.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const LIMITS = Object.freeze({
  archiveBytes: 64 * 1024 * 1024,
  entryBytes: 16 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  entries: 6000,
  classes: 2500,
  members: 20000,
  constantPoolEntries: 250000,
  outputBytes: 4 * 1024 * 1024,
});
const utf8 = new TextDecoder('utf-8', { fatal: true });
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function bounds(bytes, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) {
    fail('Archivo binario truncado o con límites inválidos.');
  }
}

// Se leen los miembros en memoria: nunca se extraen rutas al sistema de archivos.
function readZip(bytes, budget) {
  if (bytes.length > LIMITS.archiveBytes) fail('El archivo supera el límite de 64 MiB.');
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0) fail('El archivo no es un ZIP válido o está truncado.');
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) fail('No se admiten archivos ZIP divididos.');
  const count = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  const start = bytes.readUInt32LE(end + 16);
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) fail('ZIP64 no está admitido por este diagnóstico.');
  if (count !== bytes.readUInt16LE(end + 8) || start + size !== end) fail('Directorio ZIP incoherente.');
  budget.entries += count;
  if (budget.entries > LIMITS.entries) fail('Se superó el límite global de entradas ZIP.');
  const entries = new Map();
  let offset = start;
  for (let index = 0; index < count; index++) {
    bounds(bytes, offset, 46);
    if (bytes.readUInt32LE(offset) !== 0x02014b50) fail('Entrada del directorio ZIP inválida.');
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const expanded = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > start + size) fail('Una entrada excede el directorio ZIP.');
    const name = utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!name || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..')) {
      fail('El ZIP contiene una ruta insegura.');
    }
    if (entries.has(name)) fail('El ZIP contiene nombres de entrada duplicados.');
    if (flags & 1) fail('No se admiten entradas ZIP cifradas.');
    if (![0, 8].includes(method)) fail('El ZIP utiliza una compresión no admitida.');
    if (((bytes.readUInt32LE(offset + 38) >>> 16) & 0xf000) === 0xa000) fail('No se admiten enlaces simbólicos en el archivo.');
    if (expanded > LIMITS.entryBytes || compressed === 0xffffffff || localOffset === 0xffffffff) fail('Una entrada excede los límites de inspección.');
    budget.expanded += expanded;
    if (budget.expanded > LIMITS.expandedBytes) fail('Se superó el límite global de expansión ZIP.');
    entries.set(name, { name, flags, method, compressed, expanded, localOffset, crc: bytes.readUInt32LE(offset + 16) });
    offset = next;
  }
  if (offset !== start + size) fail('El tamaño del directorio ZIP no coincide con sus entradas.');
  return {
    names: [...entries.keys()],
    read(name) {
      const entry = entries.get(name);
      if (!entry) return null;
      const offset = entry.localOffset;
      bounds(bytes, offset, 30);
      if (bytes.readUInt32LE(offset) !== 0x04034b50) fail('Cabecera local ZIP inválida.');
      if (bytes.readUInt16LE(offset + 6) !== entry.flags || bytes.readUInt16LE(offset + 8) !== entry.method) fail('Las cabeceras ZIP no coinciden.');
      const nameLength = bytes.readUInt16LE(offset + 26);
      const extraLength = bytes.readUInt16LE(offset + 28);
      const dataOffset = offset + 30 + nameLength + extraLength;
      bounds(bytes, offset + 30, nameLength + extraLength);
      if (utf8.decode(bytes.subarray(offset + 30, offset + 30 + nameLength)) !== name) fail('El nombre local ZIP no coincide.');
      bounds(bytes, dataOffset, entry.compressed);
      if (dataOffset + entry.compressed > start) fail('Una entrada invade el directorio ZIP.');
      const packed = bytes.subarray(dataOffset, dataOffset + entry.compressed);
      let result;
      try { result = entry.method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: LIMITS.entryBytes }); }
      catch { fail('Una entrada ZIP tiene datos comprimidos inválidos o excede el límite de expansión.'); }
      if (result.length !== entry.expanded || crc32(result) !== entry.crc) fail('Una entrada ZIP tiene tamaño o CRC incorrectos.');
      return result;
    },
  };
}

function parseClass(bytes, budget) {
  let offset = 0;
  const u1 = () => { bounds(bytes, offset, 1); return bytes[offset++]; };
  const u2 = () => { bounds(bytes, offset, 2); const value = bytes.readUInt16BE(offset); offset += 2; return value; };
  const u4 = () => { bounds(bytes, offset, 4); const value = bytes.readUInt32BE(offset); offset += 4; return value; };
  const skip = count => { bounds(bytes, offset, count); offset += count; };
  if (u4() !== 0xcafebabe) fail('Se encontró una clase JVM inválida.');
  const minor = u2(), major = u2();
  const count = u2();
  budget.constantPoolEntries += count;
  if (budget.constantPoolEntries > LIMITS.constantPoolEntries) fail('Se superó el límite global del constant pool JVM.');
  const pool = new Array(count);
  for (let index = 1; index < count; index++) {
    const tag = u1();
    if (tag === 1) {
      const length = u2(); bounds(bytes, offset, length);
      pool[index] = { tag, value: bytes.toString('utf8', offset, offset + length) }; offset += length;
    } else if ([7, 8, 16, 19, 20].includes(tag)) pool[index] = { tag, index: u2() };
    else if ([9, 10, 11, 12, 17, 18].includes(tag)) pool[index] = { tag, first: u2(), second: u2() };
    else if ([3, 4].includes(tag)) { pool[index] = { tag }; skip(4); }
    else if ([5, 6].includes(tag)) { pool[index] = { tag }; skip(8); index++; }
    else if (tag === 15) pool[index] = { tag, kind: u1(), index: u2() };
    else fail(`Etiqueta JVM no admitida: ${tag}.`);
  }
  const string = index => {
    if (pool[index]?.tag !== 1) fail('Referencia UTF-8 inválida en una clase JVM.');
    return pool[index].value;
  };
  const className = index => {
    if (pool[index]?.tag !== 7) fail('Referencia Class inválida en una clase JVM.');
    return string(pool[index].index);
  };
  const references = new Set();
  const descriptors = new Set();
  const addDescriptor = value => {
    if (descriptors.has(value)) return;
    descriptors.add(value);
    for (const match of value.matchAll(/L([A-Za-z0-9_$\/.]+)(?=[;<])/g)) references.add(match[1]);
  };
  for (const item of pool) {
    if (item?.tag === 7) {
      const value = string(item.index);
      if (value.startsWith('[')) addDescriptor(value); else references.add(value);
    } else if (item?.tag === 12) addDescriptor(string(item.second));
    else if (item?.tag === 16) addDescriptor(string(item.index));
  }
  const access = u2(), name = className(u2());
  const superIndex = u2(), superName = superIndex ? className(superIndex) : null;
  const interfaces = Array.from({ length: u2() }, () => className(u2()));
  function attributes() {
    const result = {};
    const count = u2();
    for (let index = 0; index < count; index++) {
      const name = string(u2()), length = u4(), end = offset + length;
      bounds(bytes, offset, length);
      if (name === 'Signature') {
        if (length !== 2) fail('Atributo Signature inválido.');
        result.genericSignature = string(u2()); addDescriptor(result.genericSignature);
      } else if (name === 'ConstantValue') {
        if (length !== 2) fail('Atributo ConstantValue inválido.');
        const item = pool[u2()];
        if (item?.tag === 8) result.stringConstant = string(item.index);
      } else if (name === 'Exceptions') {
        result.exceptions = Array.from({ length: u2() }, () => className(u2())).sort();
      }
      if (offset > end) fail('Atributo JVM truncado.');
      offset = end;
    }
    return result;
  }
  function members() {
    const result = [];
    const count = u2();
    budget.members += count;
    if (budget.members > LIMITS.members) fail('Se superó el límite global de miembros JVM.');
    for (let index = 0; index < count; index++) {
      const access = u2(), name = string(u2()), descriptor = string(u2());
      addDescriptor(descriptor);
      result.push({ name, descriptor, access, ...attributes() });
    }
    return result;
  }
  const fields = members(), methods = members(), classAttributes = attributes();
  if (offset !== bytes.length) fail('La clase JVM contiene datos adicionales inesperados.');
  return { name, access, major, minor, superName, interfaces, fields, methods, references, ...classAttributes };
}

function publicMember(member) {
  const result = { name: member.name, descriptor: member.descriptor, access: member.access };
  if (member.genericSignature) result.genericSignature = member.genericSignature;
  if (member.exceptions) result.exceptions = member.exceptions;
  return result;
}
function inspect(file) {
  const absolute = path.resolve(file);
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > LIMITS.archiveBytes) fail('Se requiere un archivo AAR regular de hasta 64 MiB.');
  const bytes = fs.readFileSync(absolute);
  const budget = { entries: 0, expanded: 0, members: 0, constantPoolEntries: 0 };
  const aar = readZip(bytes, budget);
  const warnings = [];
  let reportBytes = 0;
  const account = value => {
    reportBytes += Buffer.byteLength(JSON.stringify(value));
    if (reportBytes > LIMITS.outputBytes) fail('La API excede el límite de salida del diagnóstico.');
    return value;
  };
  const manifestBytes = aar.read('AndroidManifest.xml');
  let manifest = { status: 'not_found' };
  if (!manifestBytes) warnings.push('El AAR no contiene AndroidManifest.xml.');
  else {
    const xml = manifestBytes.toString('utf8');
    if (/^\s*(?:<\?xml[^>]*>\s*)?<manifest\b/.test(xml) && manifestBytes.length <= 65536) manifest = { status: 'text', xml };
    else {
      manifest = { status: 'manual_review', sha256: sha256(manifestBytes), bytes: manifestBytes.length };
      warnings.push('El manifiesto es binario o supera 64 KiB; su lectura requiere una herramienta Android.');
    }
  }
  const jarNames = aar.names.filter(name => name === 'classes.jar' || /^libs\/[^/]+\.jar$/.test(name)).sort();
  account(jarNames);
  if (!jarNames.includes('classes.jar')) fail('El AAR no contiene classes.jar.');
  const classes = new Map();
  for (const jarName of jarNames) {
    const jar = readZip(aar.read(jarName), budget);
    for (const name of jar.names.filter(name => name.endsWith('.class')).sort()) {
      if (classes.size >= LIMITS.classes) fail('Se superó el límite global de 2500 clases.');
      const parsed = parseClass(jar.read(name), budget);
      if (`${parsed.name}.class` !== name) fail('El nombre de una clase no coincide con su entrada JAR.');
      if (classes.has(parsed.name)) fail('Se encontraron clases duplicadas entre los JAR del AAR.');
      classes.set(parsed.name, parsed);
    }
  }
  const names = [...classes.keys()].sort();
  const references = new Set();
  for (const item of classes.values()) for (const reference of item.references) if (!classes.has(reference)) references.add(reference);
  const externalClasses = [...references].sort();
  for (const reference of externalClasses) account(reference);
  const platformClasses = externalClasses.filter(name => /^(?:java|javax|android)\//.test(name));
  const libraryClasses = externalClasses.filter(name => !/^(?:java|javax|android)\//.test(name));
  const publicApi = names.filter(name => classes.get(name).access & 1).map(name => {
    const item = classes.get(name);
    account({ name, interfaces: item.interfaces, superName: item.superName, genericSignature: item.genericSignature });
    return {
      name, access: item.access, superName: item.superName, interfaces: item.interfaces,
      ...(item.genericSignature ? { genericSignature: item.genericSignature } : {}),
      fields: item.fields.filter(member => member.access & 5).map(member => account(publicMember(member))),
      methods: item.methods.filter(member => member.access & 5).map(member => account(publicMember(member))),
    };
  });
  const version = classes.get('com/mercadolibre/android/point_integration_sdk/nativesdk/BuildConfig')?.fields.find(field => field.name === 'VERSION_NAME' && field.descriptor === 'Ljava/lang/String;')?.stringConstant;
  return {
    status: warnings.length ? 'partial' : 'inspected',
    artifactName: path.basename(absolute), bytes: bytes.length, sha256: sha256(bytes),
    sdkVersion: version ? { status: 'exact_constant', value: version, source: 'nativesdk.BuildConfig.VERSION_NAME' } : { status: 'not_determined' },
    manifest, jarNames, classCount: classes.size, publicClassCount: publicApi.length,
    publicApi,
    externalReferences: { inferredLibraryClasses: libraryClasses, platformClasses },
    warnings,
  };
}
const difference = (left, right) => { const values = new Set(right); return left.filter(value => !values.has(value)); };
function compare(base, candidate) {
  const left = new Map(base.publicApi.map(item => [item.name, item]));
  const right = new Map(candidate.publicApi.map(item => [item.name, item]));
  const leftNames = [...left.keys()], rightNames = [...right.keys()];
  const key = value => JSON.stringify(value);
  const changedPublicClasses = [];
  for (const name of leftNames.filter(name => right.has(name))) {
    const before = left.get(name), after = right.get(name);
    const fieldsBefore = before.fields.map(key), fieldsAfter = after.fields.map(key);
    const methodsBefore = before.methods.map(key), methodsAfter = after.methods.map(key);
    const details = {
      name,
      declarationChanged: key({ ...before, fields: [], methods: [] }) !== key({ ...after, fields: [], methods: [] }),
      addedFields: difference(fieldsAfter, fieldsBefore).map(JSON.parse),
      removedFields: difference(fieldsBefore, fieldsAfter).map(JSON.parse),
      addedMethods: difference(methodsAfter, methodsBefore).map(JSON.parse),
      removedMethods: difference(methodsBefore, methodsAfter).map(JSON.parse),
    };
    if (details.declarationChanged || details.addedFields.length || details.removedFields.length || details.addedMethods.length || details.removedMethods.length) changedPublicClasses.push(details);
  }
  return {
    baseSha256: base.sha256, candidateSha256: candidate.sha256,
    addedPublicClasses: difference(rightNames, leftNames), removedPublicClasses: difference(leftNames, rightNames), changedPublicClasses,
    addedInferredLibraryClasses: difference(candidate.externalReferences.inferredLibraryClasses, base.externalReferences.inferredLibraryClasses),
    removedInferredLibraryClasses: difference(base.externalReferences.inferredLibraryClasses, candidate.externalReferences.inferredLibraryClasses),
    manifestChanged: JSON.stringify(base.manifest) !== JSON.stringify(candidate.manifest),
    decision: 'manual_review',
  };
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Uso: node inspect-smartapps-sdk.mjs <archivo.aar> [--compare <otro.aar>]\nDiagnóstico opcional y de solo lectura; no requiere fuentes del SDK.');
    return;
  }
  if (!(args.length === 1 || (args.length === 3 && args[1] === '--compare')) || args[0]?.startsWith('-')) {
    fail('Uso: node inspect-smartapps-sdk.mjs <archivo.aar> [--compare <otro.aar>]');
  }
  const artifact = inspect(args[0]);
  const candidate = args.length === 3 ? inspect(args[2]) : null;
  const report = {
    schemaVersion: 'smartapps-sdk-inspection.v1', optionalDiagnostic: true, readOnly: true,
    artifact, ...(candidate ? { comparedArtifact: candidate, comparison: compare(artifact, candidate) } : {}),
    limitations: [
      'La API mostrada es pública/protegida en el bytecode JVM; no acredita que cada clase sea parte del contrato oficial soportado.',
      'Las referencias externas son inferidas: no prueban versiones mínimas, dependencias resueltas ni clases utilizadas mediante reflexión.',
      'El hash identifica estos bytes; no acredita por sí solo su procedencia oficial ni una versión si no existe evidencia exacta.',
      'No se ejecuta el SDK ni se comprueba compilación, arranque, pagos, hardware o homologación.',
      'Las diferencias requieren revisión; no son bloqueos automáticos del asesor.',
    ],
  };
  const output = JSON.stringify(report, null, 2);
  if (Buffer.byteLength(output) > LIMITS.outputBytes) fail('El reporte supera el límite de 4 MiB; la inspección no se pudo completar.');
  console.log(output);
}
try { main(process.argv.slice(2)); }
catch (error) {
  console.error(`No se pudo inspeccionar el AAR: ${error.code === 'ENOENT' ? 'archivo no encontrado.' : error.message}`);
  process.exitCode = 1;
}
