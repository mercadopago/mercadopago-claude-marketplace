# Requisitos de homologación de MainApp

## Fuente y alcance

- Fuente entregada por el usuario: `checklist_homolog-MainAPP.pdf`, título visible `CheckList Homologator`, 2 páginas.
- SHA-256 del documento: `dea38e2df04c3b63f85f5635268bca145491db6dd29a9a1cd0ab7b46704110b2`.
- Fecha de incorporación: 2026-11-10. El PDF no declara número de versión ni fecha de vigencia de sus reglas.
- Perfil: MainApp de SmartApps. No aplicar la categoría HOME a una MiniApp por extensión de este documento.
- Inventario completo: 20 requisitos, 11 con `Obrigatório = Verdadeiro` y 9 con `Obrigatório = Falso`.
- Los nombres originales identifican cada fila; las descripciones siguientes son una adaptación al español. La columna `Recurso` contiene un guion en todas las filas y no aporta enlaces.

Este archivo registra los requisitos y la evidencia necesaria. Su existencia no acredita que el validador ya los compruebe ni que una aplicación esté homologada. El PDF es la fuente del checklist; la forma de comprobar cada requisito es una propuesta del plugin y se identifica como tal.

## Checklist completo

| ID | Nombre original | Página | Obligatorio en el PDF | Requisito | Evidencia propuesta y límite |
| --- | --- | --- | --- | --- | --- |
| MAIN-01 | Método código QR | 1 | No | Permitir la integración de pagos mediante QR cuando se incluya esa capacidad. | Prueba funcional del pago QR en terminal. Detectar llamadas o recursos no demuestra un pago exitoso. |
| MAIN-02 | Versão do APP | 1 | Sí | Incluir un código de versión incremental en el manifiesto, conforme al historial. | Leer el código del APK y compararlo con una versión anterior o historial suministrado. Sin referencia anterior, la incrementalidad queda pendiente. |
| MAIN-03 | Nome do pacote no manifest | 1 | Sí | Hacer corresponder el `package_name` del manifiesto con el nombre del APK; evitar nombres relacionados con MercadoPago. | Extraer la identidad del paquete del APK y contrastarla con la identidad esperada. La frase sobre el nombre del archivo requiere aclaración de DevConsole antes de imponer un patrón de renombrado. |
| MAIN-04 | Launcher | 1 | Sí | Incluir DEFAULT, LAUNCHER, HOME y MAIN en el `intent-filter` del manifiesto de la MainApp. | En Android, MAIN se comprueba como acción y DEFAULT/LAUNCHER/HOME como categorías del filtro de la actividad de inicio. Inspeccionar el manifiesto compilado; conservar la formulación original del PDF como referencia. |
| MAIN-05 | Nome de sua aplicação | 1 | No | Usar un nombre descriptivo y fácil de identificar, sin nombres relacionados con MercadoPago. | Resolver el nombre visible y revisarlo. Que exista un label no prueba que sea descriptivo ni que cumpla una política de marca. |
| MAIN-06 | Android version | 1 | Sí | Configurar `minSdkVersion` igual o superior a 23, Android 6.0. | Extraer el valor del APK compilado. Este umbral no sustituye los requisitos del modelo de terminal ni del SDK utilizado. |
| MAIN-07 | Version | 1 | Sí | Mostrar en la experiencia del usuario la versión instalada de la aplicación para facilitar el soporte. | Evidencia visual de la pantalla y de la versión de la instalación probada, en emulador o terminal. Una cadena dentro del APK no demuestra que sea visible. |
| MAIN-08 | Changelog | 1 | Sí | Mantener actualizado el changelog de la integración. | Documento aportado y correspondencia con la versión evaluada. Su presencia no puede deducirse del manifiesto. |
| MAIN-09 | Idioma do APK | 1 | No | Disponer del idioma oficial del país de operación. | Revisar recursos y recorrido visible con el país e idioma resueltos. La existencia de un locale no acredita la traducción completa. |
| MAIN-10 | Tamanho do APK | 1 | No | Mantener el tamaño de la SmartApp menor o igual a 50 MB. | Medir los bytes del APK e informar el criterio de conversión. El PDF no aclara MB decimal frente a MiB; registrar esa ambigüedad antes de afirmar equivalencia con DevConsole. |
| MAIN-11 | Pagamento aprovado | 1 | Sí | Probar el flujo completo de pago aprobado, recibir el retorno en pantalla y procesar la aprobación. | Evidencia de una operación aprobada y su retorno en terminal de desarrollo. El código, la compilación y el emulador no acreditan este flujo completo. |
| MAIN-12 | Pagamento rejeitado | 1 | Sí | Probar el flujo completo de pago rechazado, recibir el retorno en pantalla y procesar el rechazo. | Evidencia de una operación rechazada y su retorno en terminal de desarrollo. La presencia de un callback no equivale a ejecutar la prueba. |
| MAIN-13 | Manual de implentação | 1 | No | Documentar el proceso de implementación de la solución dentro de un seller. | Manual aportado y revisado para el proceso real de despliegue e integración. Se conserva el nombre de la fila tal como aparece en el PDF. |
| MAIN-14 | Uso de Logs | 1 | No | Contar con logs que permitan diagnosticar fallos de la integración. | Evidencia de un error controlado y su diagnóstico, con datos redactados. No registrar tokens ni información personal para satisfacer esta recomendación. |
| MAIN-15 | Manual Operativo | 1 | No | Documentar cómo operar la solución de acuerdo con su usabilidad. | Manual operativo aportado y revisión del recorrido de uso. |
| MAIN-16 | Información sensible en descripción | 1 | Sí | Evitar información sensible, incluida información de identificación personal, en `description`. | Revisar la construcción y procedencia de `description` y ejemplos redactados. Una expresión dinámica que no se puede inspeccionar conserva revisión pendiente; el análisis de cadenas no prueba ausencia de PII. |
| MAIN-17 | Renovação de Tokens OAuth | 1 | Sí | Renovar automáticamente los access tokens antes de su expiración para evitar revinculaciones manuales. | Cuando el flujo OAuth aplique, documentar quién administra el ciclo de vida y aportar evidencia de renovación. El PDF no explicita la condición de esta fila; justificar aplicabilidad con el modo de uso y el contrato oficial del SDK. |
| MAIN-18 | Notificações Oauth | 2 | No | Suscribirse al tópico de webhooks `mp-connect` para novedades de vinculaciones y desvinculaciones OAuth. | Si aplica OAuth, evidencia de la suscripción y del tratamiento del evento en el componente responsable. El checklist no obliga a alojar un receptor dentro de Android. |
| MAIN-19 | Uso do parâmetro State | 2 | No | Usar `state` en la URL de autorización para reconocer el intento de vinculación OAuth. | Si aplica una autorización OAuth administrada por la solución, revisar la correlación del intento. Si el SDK administra el flujo, confirmar el contrato de esa versión. |
| MAIN-20 | Implementação de OAuth | 2 | Sí | Implementar OAuth para obtener y gestionar los access tokens de las cuentas administradas; el PDF lo exige para operar con múltiples cuentas. | Resolver uso propio frente a terceros/múltiples cuentas y contrastarlo con el contrato oficial del SDK. La obligación original se conserva; un resultado no aplicable requiere una justificación documentada. |

## Interpretación de resultados

Cada requisito debe conservar su ID, obligatoriedad original, aplicabilidad, método de comprobación, evidencia y resultado. Un resultado puede ser cumplido, incumplido, pendiente de evidencia, no aplicable con justificación o no evaluado.

- Un requisito obligatorio aplicable e incumplido impide declarar completado el checklist.
- Un requisito obligatorio cuya evidencia o aplicabilidad no se puede determinar mantiene el checklist pendiente; no se transforma en aprobado por omisión.
- Las recomendaciones se informan con el nivel del PDF. Si otra política las convierte en obligatorias, citar esa política por separado sin cambiar la fuente original.
- El estado de las comprobaciones automáticas se informa por separado del checklist completo. Puede completarse la inspección binaria mientras quedan pendientes documentación o pruebas de terminal.
- Un resultado no aplicable debe explicar el motivo y la fuente; no debe ocultar que el PDF marcaba el requisito como obligatorio.
- El informe debe asociarse al APK exacto evaluado, su identidad y su huella. El código de otra aplicación o una APK distinta no aporta evidencia a esta evaluación.

## Relación con las tres mejoras solicitadas

Las siguientes mejoras proceden de la solicitud del usuario, no de filas adicionales del PDF. Mantener las dos fuentes identificadas.

| ID | Prioridad | Resultado requerido | Responsabilidad y evidencia |
| --- | --- | --- | --- |
| ALTA-01 | Alta | Declarar y validar las dependencias de ejecución que el AAR no incorpora, incluidas las familias `androidx.core`, `kotlinx-coroutines` y `gson`. | El plugin explica el contrato respaldado para la versión del SDK y comprueba el grafo de dependencias de la variante. La publicación del SDK con POM corresponde al proveedor. Sin versiones respaldadas no se inventan mínimos ni se declara resuelto el runtime. |
| ALTA-02 | Alta | Incorporar una etapa de prueba en emulador entre la compilación y la terminal de desarrollo. | Verificar instalación, arranque, navegación, versión visible y errores controlados cuando falte el entorno SmartPOS. Registrar APK, imagen/API y evidencia. Pago, impresión, QR y periféricos de la terminal conservan sus pruebas en dispositivo. |
| ALTA-03 | Alta | Inspeccionar el APK compilado mediante un nuevo validador y presentar los 20 requisitos de este checklist con sus evidencias y límites. | El plugin automatiza las reglas observables en el artefacto y registra el resto para revisión. DevConsole debe confirmar la lista completa y versionada de sus reglas antes de afirmar que el prechequeo replica su pipeline. |

El error de aislamiento reproducido durante la revisión se considera una condición de fiabilidad de estas validaciones: seleccionar el módulo, variante y artefacto objetivo; no aprobarlos con código o metadatos de otro proyecto dentro de la raíz analizada.

## Confirmaciones externas y ambigüedades registradas

1. Proveedor del SDK: coordenadas, versiones compatibles y dependencias transitivas requeridas por el AAR de la versión utilizada, incluida la publicación con POM. Una referencia binaria a una clase no demuestra una versión mínima de biblioteca.
2. DevConsole: interpretación exacta del nombre del APK frente a su paquete, unidad para el umbral de 50 MB y reglas adicionales a este PDF. El documento no define firma, ofuscación ni otras revisiones que puedan existir en ese pipeline.
3. OAuth: responsabilidad sobre renovación, notificaciones y `state` en el contrato del SDK y modo de uso resuelto. No incorporar secretos o un flujo OAuth backend a la MainApp para satisfacer una interpretación no confirmada.
4. Evidencia: código de versión anterior, documentos y resultados de pruebas de pago se solicitan solo cuando esa comprobación se va a realizar. Su ausencia deja pendiente la etapa correspondiente y permite continuar con el resto verificable.
