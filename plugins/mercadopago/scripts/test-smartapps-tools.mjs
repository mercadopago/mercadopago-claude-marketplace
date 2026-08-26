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
  dependencies { implementation(files("libs/nativesdk-current.aar")) }
`;

const applicationCode = `
  class MainApplication : Application() {
    override fun onCreate() {
      super.onCreate()
      val config = MPConfigBuilder(this, BuildConfig.MP_SMARTAPPS_CLIENT_ID).build()
      MPManager.initialize(this, config)
    }
  }
`;

const paymentCode = `
  fun startPayment(amount: String) {
    MPManager.paymentMethodsTools.getPaymentMethods { methodsResponse ->
      methodsResponse.doIfSuccess { methods ->
        val uniquePaymentReference = UUID.randomUUID().toString()
        val request = PaymentFlowRequestData(
          amount = amount,
          description = uniquePaymentReference,
          paymentMethod = methods.first().name,
          paymentTransactionMetadata = mapOf("external_reference" to uniquePaymentReference)
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

function manifest({ main = true, oauth = false, extra = '' } = {}) {
  return `
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
      <application android:name=".MainApplication" android:allowBackup="false">
        <meta-data android:name="com.mercadolibre.android.sdk.CLIENT_ID" android:value="\${MP_SMARTAPPS_CLIENT_ID}" />
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
  fs.writeFileSync(path.join(mainRoot, 'java/example/MainApplication.kt'), options.applicationCode || applicationCode);
  fs.writeFileSync(path.join(mainRoot, 'java/example/PaymentController.kt'), options.paymentCode || paymentCode);
  return root;
}

function validate(name, projectOptions, appKind, ownership, expectedStatus, expectedMessage = '') {
  const root = writeProject(name, projectOptions);
  const result = spawnSync(process.execPath, [validator, root, appKind, ownership], { encoding: 'utf8' });
  if (result.status !== expectedStatus) {
    throw new Error(`${name}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}${result.stderr}`);
  }
  if (expectedMessage && !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name}: missing expected diagnostic ${expectedMessage}\n${result.stderr}`);
  }
  console.log(`PASS ${name}: ${expectedStatus === 0 ? 'accepted' : 'rejected'}`);
}

try {
  validate('valid-main-own', {}, 'main', 'own', 0);
  validate('valid-mini-third-party', { main: false, oauth: true }, 'mini', 'third-party', 0);
  validate('web-project', { manifest: '<html></html>' }, 'main', 'own', 1, 'AndroidManifest must declare');
  validate('main-without-home', { main: false }, 'main', 'own', 1, 'must declare android.intent.category.HOME');
  validate('mini-claims-home', { main: true }, 'mini', 'own', 1, 'must not claim android.intent.category.HOME');
  validate('third-party-without-oauth', {}, 'main', 'third-party', 1, 'must set OAUTH_ENABLED=true');
  validate('own-with-oauth', { oauth: true }, 'main', 'own', 1, 'must not enable third-party OAuth mode');
  validate('direct-bluetooth', {
    extra: '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  }, 'main', 'own', 1, 'BLUETOOTH_CONNECT');
  validate('google-services', {
    gradle: `${gradle}\nimplementation("com.google.android.gms:play-services-base:18.0.0")`,
  }, 'main', 'own', 1, 'Google Play Services');
  validate('direct-payment-api', {
    paymentCode: `${paymentCode}\nval endpoint = "https://api.mercadopago.com/v1/payments"`,
  }, 'main', 'own', 1, 'must use the SmartApps SDK');
  validate('missing-method-discovery', {
    paymentCode: paymentCode.replace('MPManager.paymentMethodsTools.getPaymentMethods', 'loadConfiguredPaymentMethods'),
  }, 'main', 'own', 1, 'getPaymentMethods');
  validate('missing-aar', {
    gradle: gradle.replace('implementation(files("libs/nativesdk-current.aar"))', ''),
  }, 'main', 'own', 1, 'SmartApps AAR');
  validate('invalid-package-name', {
    gradle: gradle.replaceAll('com.example.inventory', 'com.mercadopago.demo-app'),
  }, 'main', 'own', 1, 'invalid SmartApps package name');
  validate('debuggable-app', {
    manifest: manifest().replace('android:allowBackup="false"', 'android:allowBackup="false" android:debuggable="true"'),
  }, 'main', 'own', 1, 'debug/test-only');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
