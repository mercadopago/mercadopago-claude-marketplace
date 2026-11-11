#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const inspector = path.join(path.dirname(fileURLToPath(import.meta.url)), 'inspect-smartapps-sdk.mjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-sdk-inspector-'));
// Fixtures propias, no pertenecen al SDK. Compiladas con javac 17 --release 8 -g:none.
// Api(base): public String greet(String name) { return androidx.core.os.BundleKt.value() + name; }
// Api(candidate): public int greet(int value) { return value + 1; }
//                 public String extra() { return com.google.gson.Gson.value(); }
// Ambas: constructor público, protected void hook(), private void hidden().
// Helper es package-private; RemovedApi/NewApi son públicas. BuildConfig contiene VERSION_NAME.
// Las clases externas stub se usaron solo para compilar: NO se incluyen en los JAR.
const CLASS_BYTES = {
  "old_Api": "yv66vgAAADQAIwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAXamF2YS9sYW5nL1N0cmluZ0J1aWxkZXIKAAcAAwoACwAMBwANDAAOAA8BABlhbmRyb2lkeC9jb3JlL29zL0J1bmRsZUt0AQAFdmFsdWUBABQoKUxqYXZhL2xhbmcvU3RyaW5nOwoABwARDAASABMBAAZhcHBlbmQBAC0oTGphdmEvbGFuZy9TdHJpbmc7KUxqYXZhL2xhbmcvU3RyaW5nQnVpbGRlcjsKAAcAFQwAFgAPAQAIdG9TdHJpbmcHABgBABNjb20vZXhhbXBsZS9zZGsvQXBpAQAFTEFCRUwBABJMamF2YS9sYW5nL1N0cmluZzsBAA1Db25zdGFudFZhbHVlCAAdAQAEYmFzZQEABENvZGUBAAVncmVldAEAJihMamF2YS9sYW5nL1N0cmluZzspTGphdmEvbGFuZy9TdHJpbmc7AQAEaG9vawEABmhpZGRlbgAhABcAAgAAAAEAGQAZABoAAQAbAAAAAgAcAAQAAQAFAAYAAQAeAAAAEQABAAEAAAAFKrcAAbEAAAAAAAEAHwAgAAEAHgAAACEAAgACAAAAFbsAB1m3AAm4AAq2ABArtgAQtgAUsAAAAAAABAAhAAYAAQAeAAAADQAAAAEAAAABsQAAAAAAAgAiAAYAAQAeAAAADQAAAAEAAAABsQAAAAAAAA==",
  "new_Api": "yv66vgAAADQAGgoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWCgAIAAkHAAoMAAsADAEAFGNvbS9nb29nbGUvZ3Nvbi9Hc29uAQAFdmFsdWUBABQoKUxqYXZhL2xhbmcvU3RyaW5nOwcADgEAE2NvbS9leGFtcGxlL3Nkay9BcGkBAAVMQUJFTAEAEkxqYXZhL2xhbmcvU3RyaW5nOwEADUNvbnN0YW50VmFsdWUIABMBAAljYW5kaWRhdGUBAARDb2RlAQAFZ3JlZXQBAAQoSSlJAQAFZXh0cmEBAARob29rAQAGaGlkZGVuACEADQACAAAAAQAZAA8AEAABABEAAAACABIABQABAAUABgABABQAAAARAAEAAQAAAAUqtwABsQAAAAAAAQAVABYAAQAUAAAAEAACAAIAAAAEGwRgrAAAAAAAAQAXAAwAAQAUAAAAEAABAAEAAAAEuAAHsAAAAAAABAAYAAYAAQAUAAAADQAAAAEAAAABsQAAAAAAAgAZAAYAAQAUAAAADQAAAAEAAAABsQAAAAAAAA==",
  "old_Helper": "yv66vgAAADQACwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAWY29tL2V4YW1wbGUvc2RrL0hlbHBlcgEABENvZGUBAAhpbnRlcm5hbAAgAAcAAgAAAAAAAgAAAAUABgABAAkAAAARAAEAAQAAAAUqtwABsQAAAAAAAQAKAAYAAQAJAAAADQAAAAEAAAABsQAAAAAAAA==",
  "old_RemovedApi": "yv66vgAAADQACwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAaY29tL2V4YW1wbGUvc2RrL1JlbW92ZWRBcGkBAARDb2RlAQAHcmVtb3ZlZAAhAAcAAgAAAAAAAgABAAUABgABAAkAAAARAAEAAQAAAAUqtwABsQAAAAAAAQAKAAYAAQAJAAAADQAAAAEAAAABsQAAAAAAAA==",
  "new_NewApi": "yv66vgAAADQACwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAWY29tL2V4YW1wbGUvc2RrL05ld0FwaQEABENvZGUBAAVhZGRlZAAhAAcAAgAAAAAAAgABAAUABgABAAkAAAARAAEAAQAAAAUqtwABsQAAAAAAAQAKAAYAAQAJAAAADQAAAAEAAAABsQAAAAAAAA==",
  "old_BuildConfig": "yv66vgAAADQADwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQBEY29tL21lcmNhZG9saWJyZS9hbmRyb2lkL3BvaW50X2ludGVncmF0aW9uX3Nkay9uYXRpdmVzZGsvQnVpbGRDb25maWcBAAxWRVJTSU9OX05BTUUBABJMamF2YS9sYW5nL1N0cmluZzsBAA1Db25zdGFudFZhbHVlCAANAQANOS45LjktZml4dHVyZQEABENvZGUAIQAHAAIAAAABABkACQAKAAEACwAAAAIADAABAAEABQAGAAEADgAAABEAAQABAAAABSq3AAGxAAAAAAAA",
  "new_BuildConfig": "yv66vgAAADQADwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQBEY29tL21lcmNhZG9saWJyZS9hbmRyb2lkL3BvaW50X2ludGVncmF0aW9uX3Nkay9uYXRpdmVzZGsvQnVpbGRDb25maWcBAAxWRVJTSU9OX05BTUUBABJMamF2YS9sYW5nL1N0cmluZzsBAA1Db25zdGFudFZhbHVlCAANAQAOMTAuMC4wLWZpeHR1cmUBAARDb2RlACEABwACAAAAAQAZAAkACgABAAsAAAACAAwAAQABAAUABgABAA4AAAARAAEAAQAAAAUqtwABsQAAAAAAAA==",
  "foreign_BuildConfig": "yv66vgAAADQADwoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAbY29tL2V4YW1wbGUvc2RrL0J1aWxkQ29uZmlnAQAMVkVSU0lPTl9OQU1FAQASTGphdmEvbGFuZy9TdHJpbmc7AQANQ29uc3RhbnRWYWx1ZQgADQEAC25vdC10aGUtc2RrAQAEQ29kZQAhAAcAAgAAAAEAGQAJAAoAAQALAAAAAgAMAAEAAQAFAAYAAQAOAAAAEQABAAEAAAAFKrcAAbEAAAAAAAA="
};
const checksum = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ -1) >>> 0;
}
function zip(entries) {
  const localParts = [], directory = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), bytes = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const method = entry.method ?? 8, flags = entry.flags ?? 0x800;
    const packed = method === 8 ? deflateRawSync(bytes) : bytes;
    const local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x314, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc32(bytes), 16); central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(entry.expandedOverride ?? bytes.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.externalAttributes ?? 0, 38); central.writeUInt32LE(offset, 42);
    localParts.push(local, name, packed); directory.push(central, name); offset += local.length + name.length + packed.length;
  }
  const body = Buffer.concat(localParts), catalog = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(catalog.length, 12); end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, catalog, end]);
}
function jarEntry(name, key) { return { name: `${name}.class`, data: Buffer.from(CLASS_BYTES[key], 'base64'), method: 0 }; }
const baseClasses = [jarEntry('com/example/sdk/Api', 'old_Api'), jarEntry('com/example/sdk/Helper', 'old_Helper'), jarEntry('com/example/sdk/RemovedApi', 'old_RemovedApi')];
const candidateClasses = [jarEntry('com/example/sdk/Api', 'new_Api'), jarEntry('com/example/sdk/NewApi', 'new_NewApi')];
const xml = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.sdk"><uses-permission android:name="android.permission.INTERNET" /></manifest>';
function aar(classes = baseClasses, manifest = xml) {
  return zip([{ name: 'AndroidManifest.xml', data: manifest }, { name: 'classes.jar', data: zip(classes) }]);
}
function write(name, bytes) { const file = path.join(temporary, name); fs.writeFileSync(file, bytes); return file; }
function run(...args) {
  return spawnSync(process.execPath, [inspector, ...args], { encoding: 'utf8', timeout: 15000, maxBuffer: 6 * 1024 * 1024 });
}
function report(...args) {
  const result = run(...args); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
try {
  const base = write('nativesdk-7.0.0.aar', aar());
  const before = checksum(fs.readFileSync(base));
  test('AAR sin fuentes: API pública y referencias Class reales', () => {
    const r = report(base);
    assert.equal(r.optionalDiagnostic, true); assert.equal(r.readOnly, true);
    assert.equal(r.artifact.status, 'inspected'); assert.equal(r.artifact.sha256, before);
    assert.equal(r.artifact.classCount, 3); assert.equal(r.artifact.publicClassCount, 2);
    assert.ok(r.artifact.externalReferences.inferredLibraryClasses.includes('androidx/core/os/BundleKt'));
    assert.equal(r.artifact.sdkVersion.status, 'not_determined'); // El nombre 7.0.0 no se acepta como versión.
    const api = r.artifact.publicApi.find(item => item.name === 'com/example/sdk/Api');
    assert.ok(api.methods.some(item => item.name === 'greet' && item.descriptor === '(Ljava/lang/String;)Ljava/lang/String;'));
    assert.ok(api.methods.some(item => item.name === 'hook'));
    assert.ok(!api.methods.some(item => item.name === 'hidden'));
    assert.ok(!r.artifact.publicApi.some(item => item.name.endsWith('/Helper')));
  });
  test('Comparación: cambios públicos, sin convertirlos en bloqueo', () => {
    const candidate = write('candidate.aar', aar(candidateClasses, xml.replace('INTERNET', 'CUSTOM')));
    const r = report(base, '--compare', candidate), delta = r.comparison;
    assert.deepEqual(delta.addedPublicClasses, ['com/example/sdk/NewApi']);
    assert.deepEqual(delta.removedPublicClasses, ['com/example/sdk/RemovedApi']);
    assert.ok(!JSON.stringify(delta).includes('Helper'));
    const api = delta.changedPublicClasses.find(item => item.name.endsWith('/Api'));
    assert.ok(api.removedMethods.some(item => item.name === 'greet' && item.descriptor.includes('String;')));
    assert.ok(api.addedMethods.some(item => item.name === 'greet' && item.descriptor === '(I)I'));
    assert.ok(delta.addedInferredLibraryClasses.includes('com/google/gson/Gson'));
    assert.equal(delta.manifestChanged, true); assert.equal(delta.decision, 'manual_review');
  });
  test('Versión solo desde clase y campo exactos, nunca BuildConfig ajeno', () => {
    const foreign = write('foreign.aar', aar([...baseClasses, jarEntry('com/example/sdk/BuildConfig', 'foreign_BuildConfig')]));
    assert.equal(report(foreign).artifact.sdkVersion.status, 'not_determined');
    const exact = write('renamed.aar', aar([...baseClasses, jarEntry('com/mercadolibre/android/point_integration_sdk/nativesdk/BuildConfig', 'old_BuildConfig')]));
    assert.equal(report(exact).artifact.sdkVersion.value, '9.9.9-fixture');
  });
  test('Manifiesto binario deja una revisión parcial explícita', () => {
    const binary = write('binary.aar', aar(baseClasses, Buffer.from([3, 0, 8, 0])));
    const r = report(binary); assert.equal(r.artifact.status, 'partial'); assert.equal(r.artifact.manifest.status, 'manual_review');
    assert.ok(r.artifact.warnings.length);
  });
  test('Conserva los bytes del AAR original', () => { report(base); assert.equal(checksum(fs.readFileSync(base)), before); });
  for (const [name, entries, expected] of [
    ['ruta insegura', [{ name: '../escape', data: 'x' }], 'ruta insegura'],
    ['nombres duplicados', [{ name: 'same', data: 'a' }, { name: 'same', data: 'b' }], 'duplicados'],
    ['entrada cifrada', [{ name: 'entry', data: 'x', flags: 0x801 }], 'cifradas'],
    ['expansión excesiva', [{ name: 'entry', data: 'x', expandedOverride: 0x1000001 }], 'límites'],
    ['enlace simbólico', [{ name: 'entry', data: 'target', externalAttributes: (0xa000 << 16) >>> 0 }], 'simbólicos'],
  ]) test(`Rechaza ${name}`, () => {
    const result = run(write(`unsafe-${passed}.aar`, zip(entries))); assert.equal(result.status, 1); assert.ok(result.stderr.includes(expected), result.stderr);
  });
  test('Rechaza clase JVM truncada', () => {
    const result = run(write('broken-class.aar', aar([{ name: 'Broken.class', data: Buffer.from([0xca, 0xfe]), method: 0 }])));
    assert.equal(result.status, 1); assert.match(result.stderr, /truncado/);
  });
  test('Rechaza CRC incorrecto', () => {
    const corrupted = zip([{ name: 'classes.jar', data: zip(baseClasses), method: 0 }]);
    corrupted[30 + Buffer.byteLength('classes.jar') + 5] ^= 1;
    const result = run(write('bad-crc.aar', corrupted)); assert.equal(result.status, 1); assert.match(result.stderr, /CRC/);
  });
  test('Errores y ayuda en español', () => {
    assert.match(run().stderr, /Uso:/); assert.equal(run('--help').status, 0);
    assert.match(run(path.join(temporary, 'absent.aar')).stderr, /archivo no encontrado/);
    assert.equal(run(base, '--bad', base).status, 1);
  });
  console.log(`${passed} pruebas del inspector completadas.`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
