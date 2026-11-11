# Guía: Feedback de problemas no resueltos en SmartApps
# Actualizado: 2026-11-05
#
# La usa el asesor de SmartApps (`guides/smartapps.md`) solo después de que el
# MCP y `guides/smartapps-resources.md` no lograron resolver un problema.
# Registra el problema en un archivo local y, con confirmación explícita del
# desarrollador, lo prepara para el buzón de feedback de los mantenedores.

---

## Cuándo usarla

Usa este flujo solo si se cumple al menos una de estas condiciones:

- Ninguna fuente de `guides/smartapps-resources.md` responde la pregunta con
  evidencia verificable.
- El SDK se comporta distinto a la línea base del SDK de `guides/smartapps.md`.
- Una versión nueva del SDK cambió o eliminó una API y ninguna documentación de
  la release lo explica.
- El desarrollador informa que una recomendación verificada no funcionó en la
  terminal de desarrollo.

Nunca la uses para saltarte el acuerdo comercial, el destino Android autorizado
ni la autorización de un cambio del SDK. Registrar una duda, carecer de fuentes
o de un desglose del AAR no bloquea la asesoría ni el trabajo independiente.
Si la consulta no resuelve una capacidad, conserva su estado pendiente sin
inventar un contrato ni declarar completada su validación.

## Paso 1 — Escribir el archivo de feedback

Escribe o agrega al final de `${CLAUDE_PROJECT_DIR}/.mp-smartapps-feedback.md`.
Antes de escribir, confirma que Git ignora el archivo. Si no lo ignora,
pregunta al desarrollador antes de agregarlo al `.gitignore` del proyecto.

Cada entrada usa esta estructura:

```markdown
## {AAAA-MM-DD} — {título corto del problema}

- Versión del plugin: {versión del plugin}
- Versión del SDK: {versión de nativesdk en el proyecto, o "desconocida"}
- Tipo de app / propiedad: {main|mini} / {own|third-party}
- Capacidades elegidas: {smartapp-capabilities}
- País: {país o "no informado"}
- Etapa de integración: {número y nombre de la etapa oficial}

### Qué intentaba hacer el desarrollador

{un párrafo}

### Qué ocurrió

{comportamiento observado y tipo/mensaje exacto del error del SDK, redactado}

### Fuentes consultadas

- {nombre del MCP, herramienta, site, idioma, fecha, documento y resumen del resultado}
- {recursos consultados de smartapps-resources.md}

### Por qué el asesor no pudo resolverlo

{documentación faltante, fuentes contradictorias, capacidad no soportada, etc.}
```

### Reglas de redacción (obligatorias)

Nunca incluyas access tokens, client secrets, public keys, valores de
`CLIENT_ID`, `INTEGRATOR_ID` o `PLATFORM_ID`, IDs de usuario o vendedor,
correos, teléfonos, números de serie de terminales, IDs de pago, referencias
externas, datos de tarjeta, rutas absolutas personales ni archivos de código
completos. Reemplaza cada uno por `[REDACTED]`. Muestra la entrada final al
desarrollador antes de guardarla.

## Paso 2 — Resolver el destinatario del feedback

El destinatario se configura con la variable de entorno
`MP_SMARTAPPS_FEEDBACK_EMAIL`, documentada en
`${CLAUDE_PLUGIN_ROOT}/PLUGIN_SETTINGS.md`.

- Lee solo el valor de la variable (por ejemplo,
  `printenv MP_SMARTAPPS_FEEDBACK_EMAIL`). Nunca leas un archivo `.env`
  directamente; el hook de credenciales del plugin lo bloquea.
- Si la variable está vacía o no existe, informa
  `Pendiente: destinatario de feedback no configurado (MP_SMARTAPPS_FEEDBACK_EMAIL)`,
  conserva el archivo y detén solo su envío; continúa la implementación
  verificada que no dependa de esa respuesta. El desarrollador puede definir la
  variable en su `.env` local (cargado en el entorno) o en la configuración
  `env` de Claude Code.

## Paso 3 — Enviar solo con confirmación explícita

1. Muestra el destinatario, el asunto
   `[Asesor SmartApps] {título corto del problema}` y la entrada redactada
   exacta.
2. Pregunta al desarrollador si quiere enviarlo. Sin un sí explícito, no lo
   envíes.
3. Si la sesión tiene una herramienta de correo, crea un borrador con ese
   contenido y envíalo solo después de la confirmación. Si no la tiene, muestra
   el destinatario, el asunto y la ruta del archivo de feedback para que el
   desarrollador lo envíe manualmente.
4. Nunca pongas el contenido del feedback en una URL (por ejemplo, el cuerpo de
   un `mailto:`) y nunca lo envíes a otro destinatario.
5. Anota en la entrada si se envió, quedó como borrador o sigue pendiente.
