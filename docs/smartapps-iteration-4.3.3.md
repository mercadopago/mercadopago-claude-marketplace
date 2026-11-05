# SmartApps — Iteración 4.3.3

## Objetivo y base

La rama `feature/smartapps-publico` conserva el asesor funcional utilizado como pivote. Esta actualización incorpora las correcciones en esa misma rama y las presenta mediante un nuevo PR hacia `main`. Las siguientes iteraciones pueden incorporarse en ramas versionadas con alcance y verificación explícitos, según lo acordado con el equipo.

El alcance del plugin es asesorar y completar la integración autorizada. No exige el código fuente, POM o desglose interno del AAR para avanzar; la falta de un recurso afecta únicamente a la etapa que lo necesita. Código generado, compilación, APK y prueba de terminal son resultados distintos.

## Recomendaciones incorporadas

| Prioridad / punto | Resultado de esta iteración |
|---|---|
| Media 4 — versión | Release/tag oficial confirmada 7.0.0; no seleccionar una prerelease más alta ni el contenido de `master` automáticamente. |
| Media 5 — kit | Enlaces versionados y rutas reales de los APK/AAR dentro del kit. |
| Media 6 — inspección | Herramienta binaria opcional: hash, manifiesto, API pública JVM, comparación y referencias externas inferidas. No modifica ni ejecuta el SDK. |
| Media 7 — cuotas | Recomendación condicionada al país y habilitación; una mención para Brasil no confirma ni prohíbe Chile. |
| Media 8 — Chile | Descripción y referencias por intento, formato de referencia externa y opciones fiscales/comerciales contextualizadas. |
| Media 9 — Client ID | Validación conservadora del sufijo `L` y coherencia cuando los valores pueden resolverse; lo ambiguo queda para revisión. |
| Baja 10 — origen AAR | Distribución mediante el kit oficial; no confundir acceso público con control de la implementación. |
| Baja 11 — contexto MCP | Consultas pequeñas por capacidad/site, extracción de la sección pertinente y fuentes explícitas. |
| Baja 12 — idioma | Preguntas, opciones, diagnósticos y conclusiones en el idioma de conversación; español por defecto. |
| Baja 13 — ruta nativa | SmartApps sigue su guía Android y evita el flujo de servidor/credenciales web. La modularización global del archivo principal queda para otra iteración. |

## Fuentes y límites

- [Release oficial 7.0.0](https://github.com/mercadopago/point-smartapp-demo-android/releases/tag/7.0.0) y [kit versionado](https://github.com/mercadopago/point-smartapp-demo-android/releases/download/7.0.0/Third-Apps-integration-kit-7.0.0.zip).
- MCP de Mercado Pago, herramienta `search_documentation`, site `MLC`, idioma `es`, consultado el 5 de noviembre de 2026: [resumen](https://www.mercadopago.com/developers/es/docs/smartapps/overview), [ambiente](https://www.mercadopago.com/developers/es/docs/smartapps/development-environment) y [flujo de pago](https://www.mercadopago.com/developers/es/docs/smartapps/integrate-payment-flow).
- El AAR de esa versión define las firmas utilizadas; un ejemplo documental incompatible no se convierte directamente en código.
- El identificador de consulta por descripción frente a `paymentReference` requiere aclaración del proveedor. Conservar los identificadores por separado y no generar otro cobro para resolver un resultado incierto.
- La inspección no acredita dependencias resueltas, versiones mínimas, ejecución de hardware, homologación ni autenticidad sin una fuente independiente de comparación.

## Prioridades altas — revisión de alcance

Se revisarán **el viernes 6 de noviembre de 2026, por la tarde**, para aclarar el alcance del proyecto antes de implementarlas:

1. Contrato y validación de dependencias de ejecución del SDK, incluyendo resolución transitiva y versiones respaldadas.
2. Capa formal de prueba en emulador y su alcance frente a una terminal de desarrollo.
3. Prechequeo de APK compilada y reglas acordadas con los responsables de DevConsole.

Estas tres mejoras no están implementadas por este PR. El registro de esta revisión no equivale a una reunión agendada ni a una aprobación de esas capacidades.

## Verificación

Las suites están integradas en `scripts/validate_repository.sh`. La suite estática no acredita compilación; los ejemplos de la guía se contrastan por separado con el AAR oficial. Las comprobaciones de esta iteración no procesan pagos ni instalan aplicaciones en una terminal.
