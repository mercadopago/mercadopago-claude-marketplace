# Guía: Recursos externos de SmartApps
# Actualizado: 2026-11-05

Fuentes públicas para el asesor de `guides/smartapps.md`. No agregues recursos
internos, privados o propios de una empresa. No se necesita el código fuente
del SDK para usar el AAR ni para continuar con un contrato ya verificado.

## Elegir la fuente según la pregunta

Consulta solo lo necesario y detente cuando exista evidencia suficiente. Los
archivos locales y la línea base verificada permiten trabajo sin conexión;
no autentiques el MCP como preflight. Conserva el límite de un WebFetch por
interacción del plugin.

| Fuente | Úsala para | Referencia |
|---|---|---|
| Guía incluida y AAR elegido | Contrato de API de 7.0.0 y generación local | `guides/smartapps.md`; el binario es suficiente, las fuentes no son requisito |
| MCP de Mercado Pago `search_documentation` | Opciones vigentes por país, restricciones y vacíos documentales | Bajo demanda, con `siteId`, idioma y tema; `limit=3` inicial y hasta tres consultas focalizadas |
| `developers/llms.txt` oficial del país | Índice de páginas oficiales | Usa el dominio del país de la tabla de `SKILL.md`; Chile es `https://www.mercadopago.cl/developers/llms.txt` |
| Documentación oficial de SmartApps | Etapas, capacidades, restricciones y seguridad | Resuelve el dominio oficial del país; rutas `/developers/{lang}/docs/smartapps/overview`, `/development-environment`, `/integrate-payment-flow` y `/restrictions` |
| Release oficial confirmada | Kit, notas, nombres de APK/AAR y hashes | `https://github.com/mercadopago/point-smartapp-demo-android/releases/tag/7.0.0` |
| Kit de 7.0.0 | APK Main/Mini, AAR y documentación de esa distribución | `https://github.com/mercadopago/point-smartapp-demo-android/releases/download/7.0.0/Third-Apps-integration-kit-7.0.0.zip`; rutas internas en `smartapps.md` |
| Demo del mismo tag | Ejemplos, configuración Gradle y manifiesto | `https://github.com/mercadopago/point-smartapp-demo-android/tree/7.0.0`; no mezclar con `master/app/libs` |
| Documentación incluida en el kit | Métodos y clases a contrastar con el AAR | Léela localmente cuando esté disponible; un rótulo de carpeta no acredita su versión |
| Issues del demo | Problemas conocidos | `https://github.com/mercadopago/point-smartapp-demo-android/issues`; no sustituyen el contrato oficial |

## Reglas de uso y trazabilidad

- Para información obtenida del MCP indica su nombre, herramienta
  `search_documentation`, site, idioma, fecha y documento. Selecciona la sección
  del país aunque el resultado incluya varios sites.
- El límite de resultados no limita caracteres. Resume o extrae secciones con
  sus fuentes; no traslades reglas de Brasil a Chile por aparecer en el mismo
  documento.
- Para contratos del SDK cita Release/tag y versión del AAR inspeccionado.
  Distingue la documentación, las firmas observadas y el comportamiento probado.
- Si otra Release, una prerelease o la rama principal discrepa con la 7.0.0
  confirmada, muestra el conflicto. No selecciones por semver mayor ni actualices
  el proyecto automáticamente.
- Antes de descargar o reemplazar artefactos, presenta el origen, la versión y
  los archivos afectados; obtén autorización según `smartapps.md`. La inspección
  es de solo lectura y no modifica ni recompila la biblioteca del proveedor.
- No conviertas una herramienta de inspección, fuentes, POM, metadatos o un
  desglose de dependencias ausente en un requisito general para asesorar.
- No trates blogs, foros ni repositorios de terceros como evidencia oficial. Si
  falta verificar una capacidad, informa esa limitación y continúa lo
  independiente. Usa `guides/smartapps-feedback.md` para lo que siga sin resolver.

## Skills relacionados del plugin

| Necesidad | Skill |
|---|---|
| Webhooks o notificaciones del backend de conciliación | `mp-webhooks` |
| Usuarios, credenciales o tarjetas de prueba | `mp-test-setup` |
| Revisión de calidad de una integración existente | `mp-review` |

Una revisión local no replica el pipeline de DevConsole ni acredita homologación.
