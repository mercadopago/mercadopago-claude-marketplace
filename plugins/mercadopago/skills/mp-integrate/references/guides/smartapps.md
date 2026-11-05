# Guía: Asesor de SmartApps
# Actualizado: 2026-11-05 | Línea base oficial confirmada: nativesdk 7.0.0
# Fuentes: Release/tag 7.0.0 y su kit, API pública del AAR y documentación
#          oficial de SmartApps consultada por país. No tomar master como baseline.
#          https://github.com/mercadopago/point-smartapp-demo-android/releases/tag/7.0.0

Esta guía permite asesorar y generar la integración solicitada con SmartApps.
Las fuentes del SDK, su desglose interno o un POM no son requisitos para avanzar.
El AAR es una biblioteca binaria del proveedor: úsala sin modificar su contenido.

## Reglas del asesor

- Mantén el idioma de la conversación en preguntas, opciones, diagnósticos y
  conclusiones; por defecto, español. Conserva los identificadores de APIs,
  rutas y errores originales citados sin traducirlos.
- Reutiliza las decisiones y autorizaciones ya confirmadas para el mismo alcance.
  Pregunta solo lo faltante o ambiguo, una decisión a la vez.
- Genera únicamente las capacidades elegidas. No agregues cámara, Bluetooth o
  impresión personalizada por si acaso.
- Comprueba que el contrato de cada API corresponde a 7.0.0. Un snippet del MCP
  o de otra versión no es suficiente si contradice el AAR elegido.
- Entrega la implementación autorizada y resuelve los fallos alcanzables. No
  sustituyas el trabajo solicitado por una lista de tareas para el desarrollador.
- Distingue código escrito, compilación verificada, APK generada y pruebas
  ejecutadas. No declares un resultado sin la evidencia correspondiente.
- Una capacidad no confirmada queda pendiente; continúa con las partes
  verificadas. No conviertas diagnósticos opcionales en nuevos gates generales.

## Paso 1 — Resolver el contexto y los requisitos de cada etapa

1. **Acuerdo comercial.** Antes de escribir una integración, confirma el acuerdo
   SmartApps activo con Mercado Pago si aún no consta en la conversación. Si
   falta, explica qué debe resolver el desarrollador; puedes continuar la
   orientación, pero no iniciar el scaffold de la integración.
2. **Destino Android.** Esta guía cubre Android nativo en Point Smart AOSP.
   Conserva Java o Kotlin y Gradle/Groovy o Kotlin DSL del proyecto existente.
   No adaptes un backend o aplicación web como SmartApp. Si se necesita una app
   o módulo Android nuevo, presenta esa ampliación y obtén autorización.
3. **País y opciones.** Resuelve el país antes de recomendar capacidades. Si ya
   está confirmado, no vuelvas a preguntarlo. Usa su `siteId` y el idioma
   documental resuelto (`lang`) en las consultas; mantén la respuesta en el
   idioma de la conversación.
4. **Tipo de app.** Resuelve `main` o `mini`. Main es launcher y declara HOME;
   Mini se distribuye desde el marketplace y no declara HOME.
5. **Propiedad.** Resuelve `own` o `third-party`. Terceros requiere
   `OAUTH_ENABLED=true`; terminales propias no deben habilitarlo.
6. **Fuentes bajo demanda.** Usa este contrato verificado y los artefactos de
   la versión elegida. Consulta el MCP cuando se necesiten opciones vigentes por
   país, aclaraciones o una capacidad no cubierta. No autentiques como preflight
   ni bloquees el scaffold local porque el MCP no esté disponible cuando el
   contrato necesario ya está verificado. Si falta evidencia para una capacidad,
   informa exactamente cuál y continúa el trabajo independiente.
7. **Ambiente.** Identifica las herramientas de compilación y, para las pruebas
   físicas, una terminal de desarrollo con SmartPOS Sandbox. Su ausencia no
   impide generar código ni comprobar lo que sea posible localmente. El AAR real
   y las dependencias resueltas son necesarios para acreditar la compilación;
   la terminal es necesaria para acreditar pagos y hardware en dispositivo.

## Paso 2 — Asesor de capacidades

Pregunta qué necesita el negocio, en este orden, explicando cada opción. Antes
de ofrecer una capacidad condicional por país, consulta su disponibilidad con
fuentes verificables; los medios concretos se descubren en ejecución mediante
el SDK, no mediante una lista escrita a mano.

| # | Opción | Qué habilita | API de 7.0.0 | Configuración adicional |
|---|---|---|---|---|
| 1 | Cobrar | Medios que devuelva la terminal para su país y habilitación | `paymentMethodsTools.getPaymentMethods`, `paymentFlow`, `paymentStatus` | Ninguna para el flujo básico |
| 2 | QR | Leer códigos con la cámara o pagar con QR; son necesidades distintas | `cameraScanner` o un medio disponible en `paymentFlow` | `withCameraScanner()` solo para lectura |
| 3 | Imprimir | Comprobante del pago o tickets personalizados | `PaymentFlowRequestData.printOnTerminal`, `bitmapPrinter` | `withBitmapPrinterConfig()` solo para impresión personalizada |
| 4 | Bluetooth y extras | Periféricos compatibles e información de la terminal | `bluetooth`, `bluetoothUiSettings`, `smartInformationTools` | `withBluetoothConfig()`, `withBluetoothUIConfig()` según el caso |

Si se elige QR, aclara si se quiere **leer un ticket/producto** con
`cameraScanner.launchScanner(ScanType, ...)` o **cobrar con QR** mediante un
medio devuelto por `getPaymentMethods`. No proceses pagos con el escáner.

Si se elige impresión, distingue **comprobante de pago**, que usa
`printOnTerminal=true` en la solicitud, de **ticket personalizado**, que usa
`bitmapPrinter.print(Bitmap, callback)`. Para otras sobrecargas, verifica el
significado de sus parámetros antes de generarlas.

Si solo se eligieron capacidades distintas de cobrar, aclara el flujo de pago
que necesita esa SmartApp antes de continuar. Registra únicamente las capacidades
acordadas en `.mp-integrate-progress.md`:
`smartapp-capabilities=payments,qr-camera,qr-payment,print-receipt,print-custom,bluetooth,terminal-info`.

## Paso 3 — Obtener la versión oficial y sus artefactos

La fuente de distribución es
`https://github.com/mercadopago/point-smartapp-demo-android`.
La referencia oficial confirmada de esta guía es **Release/tag `7.0.0`**,
commit `f421f20`, no una rama llamada 7.0.0. Consulta el código del mismo tag:
`https://github.com/mercadopago/point-smartapp-demo-android/tree/7.0.0`.

- Release: `https://github.com/mercadopago/point-smartapp-demo-android/releases/tag/7.0.0`.
- Kit: `https://github.com/mercadopago/point-smartapp-demo-android/releases/download/7.0.0/Third-Apps-integration-kit-7.0.0.zip`.
- SHA-256 del ZIP: `f851223d4135c377921a15ef960818bd45e454dbb17cbdebf350503fe8955636`.
- SHA-256 del AAR: `d0c1cf4d26a5ac168cb1d4eef943fbb3158ca62ab5587e776a2f5c5089cc649e`.

Los APK se encuentran **dentro del kit**, no en una URL de APK inventada:

```text
Third-Apps-integration-kit-7.0.0/
  demo-mainapp-7.0.0.apk
  demo-miniapp-7.0.0.apk
  nativesdk-7.0.0.aar
  documentation-mainapp-SDK-7.0.0.zip
```

El ZIP de documentación contiene una carpeta interna rotulada `5.2.2`. Ese
rótulo no demuestra que toda la documentación sea inválida: contrasta las firmas
con el AAR 7.0.0 antes de usar un ejemplo.

No selecciones automáticamente una prerelease, el semver más alto o el AAR de
`master/app/libs`. Si otra fuente difiere, muestra la discrepancia y conserva la
versión oficial confirmada hasta que el equipo responsable confirme un cambio.
Antes de descargar, copiar o reemplazar un artefacto, muestra versión actual,
versión propuesta, origen y archivos afectados; obtén autorización explícita,
reutilizando la ya otorgada cuando corresponda al mismo cambio. Con autorización,
obtén el kit y completa el trabajo alcanzable; no impongas una descarga manual.

Comprueba el hash del ZIP y luego el del AAR extraído por separado. No confundas
el nombre de un archivo con evidencia de versión o autenticidad. Nunca uses un
AAR placeholder como compilación exitosa ni sustituyas este SDK por uno web,
backend o una coordenada Maven inventada. Gradle carga el archivo local:

```gradle
implementation(files("libs/nativesdk-7.0.0.aar"))
```

Si falta el AAR, puedes generar el código del contrato verificado; explica dónde
se incorpora y qué falta para compilar. La falta de fuentes, POM o desglose
interno de la biblioteca no bloquea ese trabajo.

### Inspección opcional y comparación de versiones

Para diagnosticar una discrepancia o evaluar una actualización, inspecciona sin
alterar el binario: hash, manifiesto, clases públicas, firmas y referencias
externas. Usa la herramienta incluida cuando esté disponible:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inspect-smartapps-sdk.mjs" /ruta/nativesdk-7.0.0.aar
node "${CLAUDE_PLUGIN_ROOT}/scripts/inspect-smartapps-sdk.mjs" /ruta/nativesdk-7.0.0.aar --compare /ruta/otra-version.aar
```

La herramienta es diagnóstica, no un gate de acceso al asesor. Si falta una
herramienta local necesaria para inspeccionar, conserva el contrato verificado
y continúa lo independiente. Las referencias de bytecode no prueban por sí
solas versiones mínimas de dependencias ni su resolución en Gradle. No declares
una incompatibilidad por la mera eliminación de una clase interna.

Ante un cambio autorizado, lee las notas de la Release elegida, compara con
7.0.0 e informa APIs agregadas, modificadas o eliminadas. Confirma el contrato
que afecte a las capacidades solicitadas antes de generar esas llamadas. No
recompiles, parches ni publiques el AAR: sus cambios corresponden al proveedor.

### Línea base de API verificada: nativesdk 7.0.0

| Área | API pública |
|---|---|
| Inicialización | `MPConfigBuilder(Application, String)`, opciones `withBitmapPrinterConfig`, `withCameraScanner`, `withBluetoothConfig`, `withBluetoothUIConfig`, `withAdditionalMetadata`, `build`; `MPManager.initialize` |
| Medios de pago | `paymentMethodsTools.getPaymentMethods(callback)` devuelve `MPResponse<List<PaymentMethod>>` |
| Cuotas | `paymentInstallmentTools.getInstallmentsAmount(callback, String amount)`; disponibilidad condicionada al país y habilitación |
| Pago | `PaymentFlowRequestData(Double, description, PaymentMethod, installments, printOnTerminal, taxes, subMerchantData, paymentTransactionMetadata)` y `paymentFlow.launchPaymentFlow(request, callback)` |
| Conciliación | `PaymentTransactionMetadata(externalReference = ...)`; también `flowId`, `cartData`, `posSaleId`, `tipAmount`, `congratsUrl` |
| Respuesta | `MPResponse<PaymentResponse>` y extensiones `doIfSuccess` / `doIfError`; el error es `Exception` |
| Estado | `paymentStatus.getPaymentStatus(paymentReference, callback)` y `getDetailedPaymentData(externalReference, callback)`; ver la aclaración de identificadores |
| Cámara | `cameraScanner.launchScanner(ScanType[, ScannerFlowRequestData], callback)` |
| Impresora | `bitmapPrinter.print(Bitmap, callback)`; otras sobrecargas requieren verificar parámetros |
| Bluetooth e información | `bluetooth`, `bluetoothUiSettings.launch(context)`, `smartInformationTools.getInformation(callback)` |
| Compatibilidad Android del SDK | API 23; confirma además los requisitos del modelo de terminal elegido |

`PaymentRequestData`, `PaymentFlowCallback` y `getPaymentMethodsList` no están
en el AAR 7.0.0. No generes esos contratos de versiones posteriores para esta
línea base. En particular, no copies el nombre Java `PaymentFlowData` si un
snippet documental lo muestra: la clase verificada es `PaymentFlowRequestData`.

## Paso 4 — Contrato de aceptación de la implementación

### Manifiesto y configuración

- `com.mercadolibre.android.sdk.CLIENT_ID` debe resolver en el manifiesto final
  a los dígitos de la aplicación con una sola `L` final. El String que recibe
  `MPConfigBuilder` contiene los dígitos sin ese sufijo. No confundas esto con
  la sintaxis de un literal `long` de Java/Kotlin.
- Un placeholder puede resolver al valor completo o recibir el sufijo desde el
  manifiesto. Revisa el resultado combinado de la variante, incluyendo recursos;
  no exijas una única expresión textual ni declares inválido lo no resuelto.
- Compara los Client ID normalizados del manifiesto y de inicialización cuando
  ambos se puedan resolver. Nunca copies identificadores de la demo.
- Usa `PLATFORM_ID` o `INTEGRATOR_ID` solo con valores y contratos emitidos por
  Mercado Pago para la versión seleccionada; no los inventes ni los conviertas
  en requisitos genéricos por una mención de otra versión.
- Main declara HOME; Mini no lo declara. Terceros requiere OAuth; propias no lo
  habilita. Conserva las categorías exigidas al tipo de aplicación.
- No solicites acceso Android directo a cámara, Bluetooth, NFC, almacenamiento
  o hardware similar para reemplazar las capacidades del SDK.
- La variante entregada no debe habilitar `debuggable`, `testOnly`,
  `allowBackup=true` ni tráfico claro. Un build debug local no equivale al
  artefacto destinado a revisión oficial.

### Flujo de pago y reglas por país

- Inicializa una sola vez en `Application.onCreate()`, habilitando solo las
  capacidades elegidas.
- Obtén los medios de pago desde el SDK y presenta los que devuelva. Conserva
  las decisiones del usuario; no elijas automáticamente el primer medio.
- Crea y persiste una referencia única por intento antes de lanzar el pago.
  Conserva la misma referencia al recuperar ese intento; no generes otra para
  volver a cobrar cuando el resultado sea incierto.
- Para Chile, la documentación exige descripción única por transacción y
  `externalReference` de 1 a 64 caracteres alfanuméricos, `-` o `_`, sin espacios.
  Valida los valores generados en ejecución. Una regex sobre fuentes no prueba
  unicidad ni permite resolver cualquier expresión dinámica.
- Para Chile, documenta las opciones de IVA `PAYMENT_TAXABLE_IVA` y
  `PAYMENT_EXEMPT_IVA`. Confirma la condición del negocio antes de elegirla.
  `FEEDING_VOUCHER_LIST` requiere habilitación comercial; no la des por activa.
- Cuotas: el método existe en 7.0.0, pero consulta las condiciones vigentes del
  país antes de recomendarlo. La guía MCP consultada documenta esta capacidad
  para Brasil; eso no acredita ni prohíbe su habilitación en Chile. Si queda
  pendiente, continúa el flujo básico verificado sin cuotas impuestas.
  Cuando corresponda, el monto de consulta es String y las cuotas elegidas se
  asignan con `setInstallmentsForCreditCard(int)` en 7.0.0.
- Impresión DTE: consulta los tipos y condiciones vigentes del país únicamente
  si el desarrollador eligió esa necesidad. No confundas un ticket interno o un
  comprobante de pago con la emisión fiscal del negocio.
- Lanza pagos mediante el SDK, no mediante llamadas directas a Payments/Orders
  desde la terminal. No incluyas credenciales ni secretos en el código o APK.

### Ejemplos compatibles con 7.0.0

Estas funciones presuponen SDK inicializado, monto validado según el negocio,
medio elegido de la lista del SDK y referencia ya persistida. Son fragmentos de
integración, no una app completa ni una prueba de pago aprobado. El callback de
éxito debe conciliar la respuesta con el intento antes de cerrar la venta.

```kotlin
import com.mercadolibre.android.point_integration_sdk.nativesdk.MPManager
import com.mercadolibre.android.point_integration_sdk.nativesdk.message.utils.doIfError
import com.mercadolibre.android.point_integration_sdk.nativesdk.message.utils.doIfSuccess
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentFlowRequestData
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentMethod
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentResponse
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentTransactionMetadata

fun lanzarPago(
    monto: Double,
    medioElegido: PaymentMethod,
    referenciaPersistida: String,
    imprimirComprobante: Boolean,
    conciliar: (PaymentResponse) -> Unit,
    informarError: (Exception) -> Unit
) {
    require(monto.isFinite() && monto > 0) { "El monto debe ser positivo" }
    require(referenciaPersistida.matches(Regex("^[A-Za-z0-9_-]{1,64}$"))) {
        "La referencia debe tener entre 1 y 64 caracteres permitidos"
    }
    val solicitud = PaymentFlowRequestData(
        amount = monto,
        description = referenciaPersistida,
        paymentMethod = medioElegido,
        printOnTerminal = imprimirComprobante,
        paymentTransactionMetadata = PaymentTransactionMetadata(
            externalReference = referenciaPersistida
        )
    )
    MPManager.paymentFlow.launchPaymentFlow(solicitud) { respuesta ->
        respuesta.doIfSuccess(conciliar).doIfError(informarError)
    }
}
```

Equivalente Java con el constructor público del AAR y callbacks Kotlin:

```java
import com.mercadolibre.android.point_integration_sdk.nativesdk.MPManager;
import com.mercadolibre.android.point_integration_sdk.nativesdk.message.utils.MPResponseKt;
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentFlowRequestData;
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentMethod;
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentResponse;
import com.mercadolibre.android.point_integration_sdk.nativesdk.payment.data.PaymentTransactionMetadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;

public static void lanzarPago(
        double monto,
        PaymentMethod medioElegido,
        String referenciaPersistida,
        boolean imprimirComprobante,
        Function1<PaymentResponse, Unit> conciliar,
        Function1<Exception, Unit> informarError) {
    if (Double.isNaN(monto) || Double.isInfinite(monto) || monto <= 0
            || referenciaPersistida == null
            || !referenciaPersistida.matches("^[A-Za-z0-9_-]{1,64}$")) {
        throw new IllegalArgumentException("Monto o referencia inválidos");
    }
    PaymentTransactionMetadata metadata = new PaymentTransactionMetadata(
            null, referenciaPersistida, null, null, null, null);
    PaymentFlowRequestData solicitud = new PaymentFlowRequestData(
            monto, referenciaPersistida, medioElegido, null,
            imprimirComprobante, null, null, metadata);
    MPManager.INSTANCE.getPaymentFlow().launchPaymentFlow(solicitud, respuesta -> {
        MPResponseKt.doIfSuccess(respuesta, conciliar);
        MPResponseKt.doIfError(respuesta, informarError);
        return Unit.INSTANCE;
    });
}
```

### Aclaración de identificadores y recuperación

Conserva por separado descripción, referencia externa e identificador devuelto
por el pago. El MCP consultado describe la descripción como base de consulta;
el AAR 7.0.0 y el demo usan `paymentReference` para `getPaymentStatus`, y el AAR
usa `externalReference` para `getDetailedPaymentData`. No inventes equivalencias
ni cambies de identificador a ciegas para obtener una aprobación. Ante esa
contradicción, informa las fuentes y solicita el contrato al equipo responsable.
Mientras no haya un resultado conciliable, conserva el intento incierto y evita
un nuevo cobro del mismo intento. Esta aclaración no bloquea generar el resto
de la implementación verificada.

## Paso 4.5 — Presentar el bundle, autorizar y ejecutar

1. **Presenta el bundle completo en el chat antes de escribir:** objetivo del
   negocio, país, tipo de app y propiedad, capacidades acordadas, versión y
   origen del SDK, contrato de manifiesto/inicialización/pago, archivos con su
   contenido propuesto y comandos de build/validación. Identifica las etapas
   pendientes. No sustituyas esa presentación por una referencia a mensajes
   ausentes ni por una lista genérica de recomendaciones.
2. **Resuelve la autorización de escritura para ese alcance.** Si falta,
   pregunta en el idioma de conversación: “¿Quieres que escriba estos archivos
   en tu proyecto?”, con opciones “Sí, escribir los archivos” y “No, solo
   mostrar el código”. Si el usuario ya ordenó implementar ese bundle o dio una
   autorización vigente para los mismos archivos y alcance, continúa sin pedir
   una confirmación duplicada. Una autorización de escritura no permite cambiar
   silenciosamente el SDK o ampliar las capacidades.
3. **Ejecuta lo autorizado.** Escribe o edita los archivos Android manteniendo
   el negocio y las convenciones existentes. Incorpora el AAR y los cambios
   Gradle cuando estén autorizados, resuelve los errores alcanzables y completa
   la compilación si fue solicitada y dispone de sus insumos. No generes un
   servidor ni archivos `.env` del flujo web como sustituto de la integración.
4. **Comprueba y entrega.** Ejecuta los controles locales aplicables, corrige
   fallos demostrables y verifica los artefactos solicitados antes del cierre.
   Si falta un recurso, explica la etapa afectada y completa el resto posible.
   No cierres con “implementado” cuando solo mostraste una propuesta; tampoco
   declares compilación, APK o pruebas de terminal que no ejecutaste.

## Paso 5 — Validar, informar y acompañar las etapas oficiales

La ausencia de una comprobación afecta a esa etapa, no convierte en inexistente
el código ya generado ni detiene toda la asesoría:

| Etapa | Evidencia necesaria para declararla completa |
|---|---|
| Implementación escrita | Archivos solicitados realmente escritos, con el contrato de la versión elegida |
| Validación estática | Resultado del validador de fuentes y revisión de lo que no pueda resolver |
| Compilación | AAR 7.0.0 real, dependencias resueltas y salida exitosa del build |
| APK generada | Archivo existente del build elegido, identificado por ruta y hash |
| Pruebas en terminal | Ejecución en Point de desarrollo con SmartPOS Sandbox y evidencia de los escenarios solicitados |
| Homologación y producción | Aprobación oficial de Mercado Pago y distribución mediante el proceso correspondiente |

Al completar la escritura autorizada, conserva en el resumen las decisiones y
etapas pendientes y elimina únicamente `.mp-integrate-progress.md` antes del
control estático final: ese checkpoint no forma parte del scaffold entregado.
Conserva su contenido en el contexto mientras ejecutas el control. Si el control
falla o la tarea solicitada sigue incompleta, restaura el checkpoint y continúa
la corrección; una cancelación no autoriza borrarlo. Durante una implementación
en curso, su presencia no es una falla de la integración: el validador final
no debe presentarse como un control intermedio aprobado.

Ejecuta el validador local antes de declarar aprobado el scaffold estático:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-smartapps-integration.mjs" . "{main|mini}" "{own|third-party}"
```

Si el resultado es `review_required`, informa las comprobaciones pendientes;
no lo presentes como un aprobado. Resuelve los errores demostrables antes de
declarar completo el control correspondiente. Este control no prueba que SDK,
firmware, pagos, impresora, cámara o Bluetooth funcionen. Si se solicita una APK final, completa la compilación y comprueba el
artefacto cuando los insumos y permisos estén disponibles; no la declares lista
por pasar un análisis textual. No afirmes homologación por un mock exitoso.

Acompaña las etapas oficiales: crear la aplicación en Tus integraciones,
preparar la terminal y el kit, instalar la SmartApp, integrar el pago, probar en
Sandbox, configurar sucursales/cajas cuando corresponda, enviar APK e información
para homologación, esperar aprobación y acompañar la distribución. Explica qué
está completado y qué necesita una acción del desarrollador o de Mercado Pago.

## Cuando el asesor necesita información vigente

1. Consulta el MCP de Mercado Pago `search_documentation` con `siteId` e idioma
   documental (`lang`) resueltos y el tema específico. Usa inicialmente `limit=3`, hasta tres
   consultas focalizadas; si una respuesta es genérica, refina una vez dentro
   de ese total. No mezcles todas las capacidades en una consulta amplia.
2. Selecciona la sección correspondiente al país: un resultado puede incluir
   varios sites. Un único resultado puede ser largo; extrae las secciones útiles
   conservando su fuente, sin omitir condiciones esenciales.
3. En la respuesta identifica **MCP de Mercado Pago**, herramienta
   `search_documentation`, site, idioma, fecha y enlace del documento. Separa
   esa evidencia de lo verificado en el AAR o la Release.
4. Si no alcanza o no está disponible, usa `guides/smartapps-resources.md`.
   Registra lo que siga incierto con `guides/smartapps-feedback.md`, sin bloquear
   el trabajo independiente ni presentar una suposición como solución.
