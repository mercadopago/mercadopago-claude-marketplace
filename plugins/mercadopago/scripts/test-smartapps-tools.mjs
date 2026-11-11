#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, 'validate-smartapps-integration.mjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-smartapps-tools-'));

const gradle = `
  plugins { id("com.android.application") }
  android {
    namespace = "com.example.inventory"
    defaultConfig { applicationId = "com.example.inventory"; minSdk = 23 }
  }
  dependencies { implementation(files("libs/nativesdk-7.0.0.aar")) }
`;

const applicationCode = `
  class MainApplication : Application() {
    override fun onCreate() {
      super.onCreate()
      val clientId = "987654321012345"
      val config = MPConfigBuilder(this, clientId).build()
      MPManager.initialize(this, config)
    }
  }
`;

const paymentCode = `
  fun startPayment(amount: Double) {
    MPManager.paymentMethodsTools.getPaymentMethods { methodsResponse ->
      methodsResponse.doIfSuccess { methods ->
        val uniquePaymentReference = UUID.randomUUID().toString()
        val request = PaymentFlowRequestData(
          amount = amount,
          description = uniquePaymentReference,
          paymentMethod = methods.first(),
          paymentTransactionMetadata = PaymentTransactionMetadata(externalReference = uniquePaymentReference)
        )
        MPManager.paymentFlow.launchPaymentFlow(request) { paymentResponse ->
          paymentResponse.doIfSuccess { showApproved(it.paymentReference) }
          paymentResponse.doIfError { showActionableError(it.message) }
        }
      }
      methodsResponse.doIfError { showActionableError(it.message) }
    }
  }
`;

const builderPaymentCode = `
  fun startPayment(amount: BigDecimal) {
    MPManager.paymentMethodsTools.getPaymentMethodsList { methodsResponse ->
      methodsResponse.doIfSuccess { methods ->
        val request = PaymentRequestData.builder(amount)
          .setPaymentMethod(methods.first())
          .setPaymentTransactionMetadata(
            PaymentTransactionMetadata(externalReference = UUID.randomUUID().toString())
          )
          .build()
        MPManager.paymentFlow.launchPaymentFlow(request, object : PaymentFlowCallback {
          override fun onProgress() {}
          override fun onSuccess(data: PaymentResponseData) { showApproved(data.paymentReference) }
          override fun onError(error: SDKException) { showActionableError(error.message) }
        })
      }
    }
  }
`;

function manifest({ main = true, oauth = false, extra = '', clientId = '987654321012345L' } = {}) {
  return `
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
      <application android:name=".MainApplication" android:allowBackup="false">
        <meta-data android:name="com.mercadolibre.android.sdk.CLIENT_ID" android:value="${clientId}" />
        ${oauth ? '<meta-data android:name="com.mercadolibre.android.sdk.OAUTH_ENABLED" android:value="true" />' : ''}
        <activity android:name=".MainActivity" android:exported="true">
          <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
            ${main ? '<category android:name="android.intent.category.DEFAULT" />' : ''}
            ${main ? '<category android:name="android.intent.category.HOME" />' : ''}
          </intent-filter>
        </activity>
        ${extra}
      </application>
    </manifest>
  `;
}

function writeProject(name, options = {}) {
  const root = path.join(temporaryDirectory, name);
  const mainRoot = path.join(root, 'app/src/main');
  fs.mkdirSync(path.join(mainRoot, 'java/example'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/build.gradle.kts'), options.gradle || gradle);
  fs.writeFileSync(path.join(mainRoot, 'AndroidManifest.xml'), options.manifest || manifest(options));
  fs.writeFileSync(path.join(mainRoot, `java/example/${options.applicationFile || 'MainApplication.kt'}`), options.applicationCode || applicationCode);
  fs.writeFileSync(path.join(mainRoot, 'java/example/PaymentController.kt'), options.paymentCode || paymentCode);
  for (const [relative, contents] of Object.entries(options.files || {})) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  return root;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const withReference = expression => paymentCode.replace('val uniquePaymentReference = UUID.randomUUID().toString()', `val uniquePaymentReference = ${expression}`);
const reviewClient = report => assert(report.clientId.manifest === 'unverified' || report.clientId.coherence === 'unverified', 'Un CLIENT_ID no resuelto no debe presentarse como verificado');
const reviewReference = report => assert(report.externalReferences.some(item => item.format === 'unverified' || item.generation === 'unverified'), 'Una referencia dinámica no debe presentarse como comprobada');

let caseCount = 0;
function validate(name, projectOptions, appKind, ownership, expectedStatus, expectedMessage = '', inspect = () => {}, expectedReview = false) {
  const root = writeProject(name, projectOptions);
  const result = spawnSync(process.execPath, [validator, root, appKind, ownership], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: se esperaba salida ${expectedStatus}, se obtuvo ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: falta el diagnóstico esperado ${expectedMessage}\n${result.stderr}`);
  }
  if (result.status === 0) {
    const report = JSON.parse(result.stdout);
    const expected = expectedReview ? 'review_required' : 'passed';
    if (report.status !== expected) throw new Error(`${name}: se esperaba estado ${expected}, se obtuvo ${report.status}\n${result.stdout}`);
    if (report.staticOnly !== true) throw new Error(`${name}: el resultado debe aclarar que la revisión es estática`);
    inspect(report);
  }
  caseCount++;
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'aceptado' : 'rechazado'}`);
}

try {
  validate('valid-main-own', {}, 'main', 'own', 0);
  validate('checkpoint-incomplete-kept', {
    files: { '.mp-integrate-progress.md': 'product=smartapps\n' },
  }, 'main', 'own', 1, '.mp-integrate-progress.md');
  const completedRoot = writeProject('checkpoint-completed-cleanup');
  const checkpoint = path.join(completedRoot, '.mp-integrate-progress.md');
  fs.writeFileSync(checkpoint, 'product=smartapps\n');
  fs.unlinkSync(checkpoint);
  const completedResult = spawnSync(process.execPath, [validator, completedRoot, 'main', 'own'], { encoding: 'utf8' });
  assert(completedResult.status === 0 && JSON.parse(completedResult.stdout).status === 'passed',
    'La limpieza del checkpoint al completar la escritura debe permitir el control final');
  caseCount++;
  console.log('PASS checkpoint-completed-cleanup: aceptado');

  validate('valid-mini-third-party', { main: false, oauth: true }, 'mini', 'third-party', 0);
  validate('sdk-7-rejects-newer-api', { paymentCode: builderPaymentCode }, 'main', 'own', 1, 'APIs posteriores');
  validate('web-project', { manifest: '<html></html>' }, 'main', 'own', 1, 'AndroidManifest debe declarar');
  validate('main-without-home', { main: false }, 'main', 'own', 1, 'debe declarar android.intent.category.HOME');
  validate('mini-claims-home', { main: true }, 'mini', 'own', 1, 'no debe declarar android.intent.category.HOME');
  validate('third-party-without-oauth', {}, 'main', 'third-party', 1, 'debe declarar OAUTH_ENABLED=true');
  validate('own-with-oauth', { oauth: true }, 'main', 'own', 1, 'no debe habilitar OAuth de terceros');
  validate('direct-bluetooth', {
    extra: '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  }, 'main', 'own', 1, 'BLUETOOTH_CONNECT');
  validate('google-services', {
    gradle: `${gradle}\nimplementation("com.google.android.gms:play-services-base:18.0.0")`,
  }, 'main', 'own', 1, 'Google Play Services');
  validate('direct-payment-api', {
    paymentCode: `${paymentCode}\nval endpoint = "https://api.mercadopago.com/v1/payments"`,
  }, 'main', 'own', 1, 'debe utilizar el SDK SmartApps');
  validate('missing-method-discovery', {
    paymentCode: paymentCode.replace('MPManager.paymentMethodsTools.getPaymentMethods', 'loadConfiguredPaymentMethods'),
  }, 'main', 'own', 1, 'getPaymentMethods');
  validate('missing-aar', {
    gradle: gradle.replace('implementation(files("libs/nativesdk-7.0.0.aar"))', ''),
  }, 'main', 'own', 1, 'AAR SmartApps');
  validate('invalid-package-name', {
    gradle: gradle.replaceAll('com.example.inventory', 'com.mercadopago.demo-app'),
  }, 'main', 'own', 1, 'Nombre de paquete SmartApps inválido');
  validate('debuggable-app', {
    manifest: manifest().replace('android:allowBackup="false"', 'android:allowBackup="false" android:debuggable="true"'),
  }, 'main', 'own', 1, 'debug/test-only');

  validate('client-id-attribute-order', {
    manifest: manifest().replace('android:name="com.mercadolibre.android.sdk.CLIENT_ID" android:value="987654321012345L"',
      'android:value="987654321012345L" android:name="com.mercadolibre.android.sdk.CLIENT_ID"'),
  }, 'main', 'own', 0);
  validate('client-id-without-L', { clientId: '987654321012345' }, 'main', 'own', 1, 'terminar en una sola L');
  validate('client-id-double-L', { clientId: '987654321012345LL' }, 'main', 'own', 1, 'terminar en una sola L');
  validate('client-id-documentation-value', { clientId: 'CLIENT_ID_VALUE' }, 'main', 'own', 1, 'sin valores de ejemplo');
  validate('client-id-code-string-with-L', {
    applicationCode: applicationCode.replace('"987654321012345"', '"987654321012345L"'),
  }, 'main', 'own', 1, 'String de Client ID');
  validate('client-id-code-mismatch', {
    applicationCode: applicationCode.replace('"987654321012345"', '"987654321012346"'),
  }, 'main', 'own', 1, 'no coincide');
  validate('client-id-placeholder-with-suffix', {
    clientId: '${mpClientId}L',
    gradle: `${gradle}\nmanifestPlaceholders["mpClientId"] = "987654321012345"`,
  }, 'main', 'own', 0);
  validate('client-id-placeholder-already-has-suffix', {
    clientId: '${mpClientId}',
    gradle: `${gradle}\nmanifestPlaceholders["mpClientId"] = "987654321012345L"`,
  }, 'main', 'own', 0);
  validate('client-id-gradle-properties-mapped', {
    clientId: '${mpClientId}L',
    gradle: `${gradle}\nmanifestPlaceholders += mapOf("mpClientId" to project.property("mpClientId"))`,
    files: { 'gradle.properties': 'mpClientId=987654321012345\n' },
  }, 'main', 'own', 0);
  validate('client-id-gradle-properties-not-automatically-placeholders', {
    clientId: '${mpClientId}L',
    files: { 'gradle.properties': 'mpClientId=987654321012345\n' },
  }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-build-config', {
    applicationCode: applicationCode.replace('"987654321012345"', 'BuildConfig.MP_CLIENT_ID'),
    gradle: gradle + String.raw`
buildConfigField("String", "MP_CLIENT_ID", "\"987654321012345\"")`,
  }, 'main', 'own', 0);
  validate('client-id-string-resource', {
    clientId: '@string/mp_client_id',
    files: { 'app/src/main/res/values/ids.xml': '<resources><string name="mp_client_id">987654321012345L</string></resources>' },
  }, 'main', 'own', 0);
  validate('client-id-resource-alias', {
    clientId: '@string/mp_client_id',
    files: { 'app/src/main/res/values/ids.xml': '<resources><string name="mp_client_id">@string/client_id_value</string><string name="client_id_value">987654321012345L</string></resources>' },
  }, 'main', 'own', 0);
  validate('client-id-resource-missing', { clientId: '@string/mp_client_id' }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-placeholder-ambiguous-variants', {
    clientId: '${mpClientId}L',
    gradle: `${gradle}\nmanifestPlaceholders["mpClientId"] = "987654321012345"\nmanifestPlaceholders["mpClientId"] = "987654321012346"`,
  }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-arithmetic-is-not-concatenated', {
    clientId: '${mpClientId}L',
    gradle: `${gradle}\nmanifestPlaceholders["mpClientId"] = 10 + 20`,
    applicationCode: applicationCode.replace('"987654321012345"', '"30"'),
  }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-distinct-manifest-variants', {
    files: { 'app/src/debug/AndroidManifest.xml': '<manifest><application><meta-data android:name="com.mercadolibre.android.sdk.CLIENT_ID" android:value="987654321012346L"/></application></manifest>' },
  }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-unresolved-build-config', {
    applicationCode: applicationCode.replace('"987654321012345"', 'BuildConfig.MP_CLIENT_ID'),
  }, 'main', 'own', 0, '', reviewClient, true);
  validate('client-id-java-long-to-string', {
    applicationFile: 'MainApplication.java',
    applicationCode: `class MainApplication extends Application {
      public void onCreate() {
        super.onCreate();
        final String clientId = String.valueOf(987654321012345L);
        MPManager.INSTANCE.initialize(this, new MPConfigBuilder(this, clientId).build());
      }
    }`,
  }, 'main', 'own', 0);
  validate('client-id-kotlin-long-to-string', {
    applicationCode: applicationCode.replace('val clientId = "987654321012345"', 'val numericClientId = 987654321012345L\n      val clientId = numericClientId.toString()'),
  }, 'main', 'own', 0);

  validate('reference-invalid-spaces', { paymentCode: withReference('"venta con espacios"') }, 'main', 'own', 1, 'externalReference debe contener');
  validate('reference-invalid-characters', { paymentCode: withReference('"venta@local"') }, 'main', 'own', 1, 'externalReference debe contener');
  validate('reference-empty', { paymentCode: withReference('""') }, 'main', 'own', 1, 'externalReference debe contener');
  validate('reference-valid-literal-requires-uniqueness-review', { paymentCode: withReference('"venta_123-ABC"') }, 'main', 'own', 0, '', reviewReference, true);
  validate('reference-prefix-and-uuid-at-limit', {
    paymentCode: withReference(`"${'a'.repeat(28)}" + UUID.randomUUID().toString()`),
  }, 'main', 'own', 0, '', report => assert(report.externalReferences.every(item => item.format === 'verified'), 'El prefijo de 28 más UUID tiene 64 caracteres'));
  validate('reference-prefix-and-uuid-too-long', {
    paymentCode: withReference(`"${'a'.repeat(29)}" + UUID.randomUUID().toString()`),
  }, 'main', 'own', 1, 'externalReference debe contener');
  validate('reference-kotlin-template', { paymentCode: withReference('"venta_${UUID.randomUUID().toString()}"') }, 'main', 'own', 0);
  validate('reference-invalid-prefix-constant', {
    paymentCode: 'const val referencePrefix = "venta "\n' + withReference('referencePrefix + UUID.randomUUID().toString()'),
  }, 'main', 'own', 1, 'externalReference debe contener');
  validate('reference-dynamic', { paymentCode: withReference('referenceFromServer()') }, 'main', 'own', 0, '', reviewReference, true);
  validate('unrelated-uuid-does-not-verify-reference', {
    paymentCode: withReference('referenceFromServer()') + '\nval unrelated = UUID.randomUUID().toString()',
  }, 'main', 'own', 0, '', reviewReference, true);
  validate('unused-reference-does-not-fail-payment', {
    paymentCode: 'val externalReference = "nota con espacios"\n' + paymentCode,
  }, 'main', 'own', 0);
  validate('metadata-positional-external-reference-second-argument', {
    paymentCode: paymentCode.replace('PaymentTransactionMetadata(externalReference = uniquePaymentReference)',
      'PaymentTransactionMetadata("flow id con espacios", uniquePaymentReference, null, null, null, null)'),
  }, 'main', 'own', 0);
  validate('metadata-positional-invalid-reference-with-null-flow-id', {
    paymentCode: paymentCode.replace('PaymentTransactionMetadata(externalReference = uniquePaymentReference)',
      'PaymentTransactionMetadata(null, "referencia inválida", null, null, null, null)'),
  }, 'main', 'own', 1, 'externalReference debe contener');
  validate('sdk-version-declaration-unresolved', {
    gradle: gradle.replace('nativesdk-7.0.0.aar', 'nativesdk-current.aar'),
  }, 'main', 'own', 0, '', report => assert(report.sdkVersionDeclaration.length === 0, 'No se debe inferir la versión binaria desde una ruta genérica'), true);
  validate('newer-api-is-not-official-7', {
    gradle: gradle.replace('nativesdk-7.0.0.aar', 'nativesdk-7.2.0.aar'),
    paymentCode: builderPaymentCode,
  }, 'main', 'own', 0, '', () => {}, true);
  console.log(`PASS ${caseCount} casos; las revisiones pendientes conservan salida 0 sin declararse verificadas.`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
