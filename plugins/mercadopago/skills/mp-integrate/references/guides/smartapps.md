# Guide: SmartApps
# Updated: 2026-08-21 | Source: official Mercado Pago SmartApps documentation
#
# This is an orchestration and acceptance contract. SmartApps SDK artifacts,
# exact integration snippets, device capabilities, and current restrictions
# must be resolved from the authenticated MCP and the commercial integration kit.

---

## Mandatory gates

1. Confirm that the developer has an active SmartApps agreement with the
   Mercado Pago business/integration team. Without that confirmation, stop with
   `BLOCKED: active SmartApps agreement required` and do not write files.
2. Query the authenticated Mercado Pago MCP for the current SmartApps guide.
   Public documentation is useful context but does not replace this query.
3. Confirm that the target is an Android application. Never retrofit a web,
   backend, desktop, or iOS project as a SmartApp. If the current repository has
   no Android application, explain that SmartApps needs a separate Android
   application/module and ask before expanding the project scope.
4. Resolve whether the application is a `main` app or a `mini` app and whether
   it operates on the merchant's own terminals or on behalf of third parties.

## SDK acquisition and updates

- The SmartApps SDK is supplied in the private Mercado Pago integration kit as
  an Android AAR. Do not install the public backend/mobile Mercado Pago SDK as a
  substitute and do not invent a Maven coordinate or download URL.
- Before copying or replacing the AAR, show its current version, the latest
  version supplied by the integration team, and the Gradle files that will
  change. Ask for explicit authorization, then use only that latest artifact.
- If the latest version cannot be verified, stop with
  `BLOCKED: latest SmartApps SDK artifact must be confirmed by Mercado Pago`.

## Scaffold acceptance contract

- Configure the exact `CLIENT_ID` metadata expected by the SmartApps SDK.
- A `main` app owns the terminal home/launcher intent. A `mini` app must not
  claim the Android HOME category.
- Enable the SDK OAuth mode for third-party terminals. Do not enable it merely
  to represent an own-terminal integration.
- Initialize the Mercado Pago manager once from the Android `Application`
  lifecycle.
- Discover supported payment methods through the SDK before launching the
  payment flow; never assume one fixed method for every country.
- Launch payments only through the SmartApps SDK, with success and actionable
  error handling. Use a unique reconciliation reference for each transaction.
- Do not call Payments/Orders APIs directly from the terminal application to
  replace the SDK payment flow.
- Invoke printer, scanner/camera, and Bluetooth capabilities only through the
  Mercado Pago SDK. Do not request their direct Android permissions.
- Do not embed access tokens, client secrets, certificates, or real-looking
  credentials in the APK or source tree.
- Point terminals use Android AOSP. Do not add dependencies that require Google
  Play Services or Firebase unless the current authenticated guide explicitly
  confirms support for the selected device.

## Validation layers

1. **Static, no device:** run the deterministic validator below.
2. **Build, no payment:** compile with the latest real AAR from the integration
   kit. A placeholder or missing AAR cannot count as a passing build.
3. **Development terminal:** install the sandbox-flavor kit and exercise the
   payment mock activity for approved and rejected/error scenarios.
4. **Homologation:** validate on the Mercado Pago development terminal and
   submit the APK through the commercial integration process.
5. **Production:** only after Mercado Pago approval and distribution to the
   intended Point Smart terminals.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-smartapps-integration.mjs" . "{main|mini}" "{own|third-party}"
```

The static validator does not prove that the private SDK, terminal firmware,
payment flow, printing, scanner, Bluetooth, or production distribution works.
