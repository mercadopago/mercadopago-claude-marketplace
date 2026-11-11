# Especificación funcional propuesta: preparación y homologación de SmartApps MainApp

Estado: borrador para aprobación. Idioma del contenido: español. Se conservan los encabezados estructurales del validador del Meli SDD Kit.

## Problem Statement

El asesor distingue compilación y prueba en terminal, pero todavía no declara ni valida el contrato de dependencias de ejecución del AAR, no tiene una etapa formal de prueba en emulador y no inspecciona el APK compilado con el checklist aportado. Por ello puede faltar una biblioteca en runtime o atribuir al binario propiedades que solo se observaron en archivos fuente.

La revisión del commit base también reprodujo un falso aprobado: una aplicación sin inicialización ni flujo de pago pasa el validador de fuentes cuando contiene otro proyecto integrado en una subcarpeta. El alcance de cada comprobación debe pertenecer a la aplicación evaluada.

La fuente del checklist es `checklist_homolog-MainAPP.pdf`, 2 páginas, SHA-256 `dea38e2df04c3b63f85f5635268bca145491db6dd29a9a1cd0ab7b46704110b2`. El inventario verificable está en [Requisitos de homologación de MainApp](../plugins/mercadopago/skills/mp-integrate/references/guides/smartapps-homologation-requirements.md).

## Objectives

1. Registrar los 20 requisitos del PDF, conservando 11 obligatorios y 9 recomendados, su página y su evidencia requerida.
2. Cubrir las 3 familias de dependencias solicitadas: `androidx.core`, `kotlinx-coroutines` y `gson`, con versiones y responsabilidades respaldadas para el SDK utilizado.
3. Incorporar 1 etapa explícita de emulador entre la compilación y la prueba en terminal, con evidencia de la instalación probada.
4. Entregar 1 prechequeo del APK que distinga comprobaciones binarias, documentales y de ejecución, sin aprobar requisitos cuya evidencia falte.
5. Evitar falsos aprobados por 1 proyecto ajeno anidado o por metadatos de una variante o APK diferente.

## Scope

### In Scope

- Archivo de requisitos incluido en las referencias del asesor, con trazabilidad de las 20 filas del PDF y de las 3 mejoras propuestas por el usuario.
- Guía de dependencias de ejecución del SDK y validación de la variante seleccionada, admitiendo bibliotecas directas o transitivas realmente resueltas.
- Guía y criterios de prueba en emulador para instalación, arranque, navegación, versión visible y fallos controlados cuando el entorno de la terminal no está disponible.
- Nuevo prechequeo del APK compilado que informe los 20 requisitos, automatice únicamente lo demostrable y registre la evidencia manual pendiente.
- Separación de obligatoriedad original, aplicabilidad, resultado y evidencia. Los requisitos obligatorios pendientes o incumplidos impiden declarar completo el checklist.
- Aislamiento de aplicación, módulo, variante y artefacto como condición de fiabilidad de los controles.
- Registro de confirmaciones que corresponden a SDK y DevConsole, manteniendo el trabajo del plugin que pueda avanzar con la evidencia disponible.
- Conservación del idioma de conversación, la ruta Android y la arquitectura actual de cuatro skills.

### Out of Scope

- Publicar el SDK o su POM desde este repositorio; es una entrega del equipo proveedor que se registra como dependencia externa.
- Declarar equivalencia completa con DevConsole sin su lista versionada y confirmada de reglas.
- Acreditar pagos aprobados/rechazados o capacidades físicas mediante una prueba en emulador.
- Homologar una aplicación, subir APK a DevConsole o procesar pagos como parte de implementar las herramientas del plugin.
- Aplicar el perfil MainApp a MiniApp, cambiar de versión del SDK automáticamente o ampliar el scaffold a backend OAuth sin un alcance autorizado.
- Modificar integraciones de otros productos o publicar esta rama, un PR o una release durante la fase de especificación.

## User Stories

### US-1: Preparar las dependencias de ejecución

**As a** desarrollador de una SmartApp,
**I want** conocer y comprobar las dependencias que el AAR no incorpora,
**So that** una compilación no oculte una ausencia de bibliotecas en el entorno de ejecución.

**Priority**: Alta.

**Acceptance Criteria**

- El asesor informa la versión del SDK y la fuente del contrato de dependencias, incluidas las tres familias solicitadas.
- Una dependencia transitiva o declarada mediante un alias válido se reconoce por su resolución; no se exige duplicarla como dependencia directa.
- Una biblioteca ausente o incompatible según el contrato se informa con evidencia de la variante evaluada.
- Si faltan versiones respaldadas, se declara pendiente la compatibilidad; las referencias de clases del AAR no se convierten en mínimos inventados.
- La publicación con POM se identifica como responsabilidad del proveedor y no se afirma completada por modificar la guía.

### US-2: Probar antes de la terminal

**As a** desarrollador de una MainApp,
**I want** ejecutar una etapa de emulador después de compilar,
**So that** pueda detectar problemas de instalación, arranque, interfaz y manejo de errores antes de probar en hardware.

**Priority**: Alta.

**Acceptance Criteria**

- El recorrido diferencia compilación/APK, emulador, prechequeo del APK, terminal de desarrollo y homologación.
- La evidencia identifica APK, versión e imagen/API del emulador y cubre instalación, arranque, navegación y versión visible.
- La ausencia esperada del entorno SmartPOS se gestiona con un resultado controlado y explícito; un fallo por dependencia ausente conserva su diagnóstico.
- Sin emulador o evidencia de ejecución, la etapa queda pendiente y se continúa con comprobaciones independientes.
- El emulador no se presenta como prueba completa de pago, impresión, QR o periféricos de una terminal.

### US-3: Inspeccionar el APK compilado

**As a** desarrollador que prepara una entrega de MainApp,
**I want** revisar el APK exacto que voy a entregar,
**So that** el resultado describa sus propiedades reales y las evidencias que todavía necesito para homologación.

**Priority**: Alta.

**Acceptance Criteria**

- La evaluación identifica el artefacto por su huella e identidad e informa el perfil MainApp utilizado.
- Se comprueban desde el artefacto los valores observables, como código de versión, paquete, filtro de inicio, minSdk y tamaño; la incrementalidad requiere una referencia anterior.
- MAIN se interpreta como acción de Android y DEFAULT/LAUNCHER/HOME como categorías del filtro de inicio, conservando la redacción original de la fuente.
- El tamaño de 50 MB conserva el nivel recomendado del PDF y hace explícita la unidad utilizada.
- Un manifiesto fuente correcto no permite aprobar un APK distinto o desactualizado.
- Si el APK no puede inspeccionarse o falta una herramienta requerida, el informe explica la comprobación pendiente y no emite un aprobado.
- El resultado se denomina prechequeo basado en el PDF hasta confirmar la cobertura con DevConsole.

### US-4: Completar el checklist con evidencia

**As a** responsable de preparar la homologación,
**I want** ver los requisitos automáticos y manuales con sus evidencias,
**So that** pueda completar la entrega sin confundir una revisión parcial con homologación.

**Priority**: Alta.

**Acceptance Criteria**

- Se presentan exactamente los 20 IDs MAIN-01 a MAIN-20 con su obligatoriedad original y página.
- Cada requisito conserva aplicabilidad y uno de estos resultados: cumplido, incumplido, pendiente de evidencia, no aplicable con justificación o no evaluado.
- Pago aprobado y rechazado requieren evidencia de retorno en pantalla y procesamiento en terminal; un callback detectado no acredita la prueba.
- Versión visible, changelog, manuales, idioma, logs y ausencia de información sensible en `description` se evalúan con su evidencia pertinente, sin deducir cumplimiento de una mera cadena del APK.
- OAuth conserva las marcas del PDF y resuelve el contexto de múltiples cuentas; su no aplicabilidad se justifica con el modo de uso y el contrato oficial.
- Las recomendaciones pendientes se informan sin convertirse en errores obligatorios por una política inventada.
- Si un obligatorio aplicable está incumplido o pendiente, el estado global del checklist no es completo, aunque las comprobaciones automáticas hayan terminado.

### US-5: Aislar el objetivo evaluado

**As a** desarrollador con varios módulos o proyectos,
**I want** que la evaluación utilice solo el objetivo seleccionado,
**So that** otra copia de la integración no produzca un resultado engañoso.

**Priority**: Alta.

**Acceptance Criteria**

- Agregar otro proyecto integrado en una subcarpeta no convierte en aprobada una aplicación sin integración.
- Ante varios módulos, variantes o APK sin selección suficiente, se solicita resolver el objetivo antes de emitir un resultado de cumplimiento.
- El contrato, las dependencias, el manifiesto compilado y la evidencia de ejecución se asocian al mismo objetivo; un cambio de artefacto exige una evaluación distinta.

## User Experience

### Main Flow

1. Resolver proyecto Android, MainApp/MiniApp, uso propio/terceros, país y versión del SDK desde el contexto vigente; preguntar solo lo que falte.
2. Para MainApp, mostrar el checklist de la fuente PDF y las dependencias de ejecución respaldadas o pendientes de confirmación.
3. Seleccionar módulo y variante y comprobar sus dependencias; compilar y registrar la APK generada cuando estén disponibles los recursos necesarios.
4. Ejecutar o guiar la etapa de emulador y conservar evidencia vinculada a esa instalación.
5. Prechequear la APK exacta y presentar sus resultados junto a las comprobaciones documentales y de ejecución pendientes.
6. Guiar las pruebas de terminal para pago aprobado/rechazado y las capacidades seleccionadas; conservar sus resultados separados de los del emulador.
7. Entregar un informe del checklist con evidencias, pendientes del desarrollador y confirmaciones de SDK/DevConsole. La decisión de homologación sigue correspondiendo al proceso oficial.

### UI/UX References

La interfaz es la conversación y el informe del asesor actual. Ejemplo de lectura: `MAIN-06: cumplido, minSdk 23 extraído de la APK`; `MAIN-11: pendiente de evidencia de pago aprobado en terminal`. El informe identifica la fuente y diferencia el estado de la inspección automática del estado del checklist completo.

## Success Metrics

- Cobertura documental: baseline: 0 filas trazadas desde este PDF; target: 20 requisitos, con 11 obligatorios y 9 recomendados.
- Evidencia honesta: baseline: no existe informe del APK basado en este PDF; target: 0 requisitos manuales aprobados únicamente por inspección estática.
- Aislamiento: baseline: el caso anidado reproducido devuelve aprobado; target: 0 aprobados al incorporar un proyecto integrado ajeno dentro del objetivo incompleto.
- Preparación: baseline: las 3 recomendaciones altas están diferidas; target: 3 capacidades del plugin con contrato y límites explícitos, conservando pendientes las entregas externas que no estén disponibles.

## Dependencies and Open Decisions

| Dependencia | Decisión o evidencia pendiente | Comportamiento mientras falta |
| --- | --- | --- |
| Equipo del SDK | Dependencias, coordenadas y versiones compatibles con el AAR; publicación con POM. | Informar lo comprobable y mantener pendiente la compatibilidad no respaldada. |
| Equipo DevConsole | Lista/versionado de reglas, semántica del nombre de APK/paquete y unidad de 50 MB. | Aplicar el PDF con límites explícitos y conservar revisión en puntos ambiguos; no afirmar equivalencia total. |
| Contrato oficial de OAuth | Responsabilidad de renovación, eventos y state según SDK y uso de múltiples cuentas. | Conservar obligatoriedad original y evaluar aplicabilidad sin agregar un flujo backend por suposición. |
| Desarrollador de la app | APK, historial de versiones, documentos y pruebas de emulador/terminal. | Solicitar cada evidencia al evaluar su requisito y mantener pendientes las etapas sin recursos. |

## Critical E2E Test Scenarios

Las pruebas de extremo a extremo se refieren al recorrido local del plugin. El repositorio distribuye un plugin de Claude Code y no despliega un servicio Fury; no requiere pruebas LTP de servicios.

### E2E-1: Objetivo incompleto con proyecto integrado anidado

Prioridad: 🔴 Critical. Una app sin inicialización ni pago conserva sus fallos al agregar otra app completa dentro de la raíz. No puede tomar de ella dependencias, manifiesto o callbacks como evidencia propia.

### E2E-2: Fuentes correctas y APK desactualizado

Prioridad: 🔴 Critical. La APK que carece del filtro HOME o tiene minSdk inferior a 23 se informa incumplida aunque los archivos fuente actuales ya estén corregidos.

### E2E-3: Dependencias y recursos de ejecución ausentes

Prioridad: 🔴 Critical. Una variante con biblioteca ausente según contrato informa el problema; una dependencia transitiva válida se acepta. La falta de emulador o contrato del proveedor produce un pendiente específico, no una prueba exitosa.

### E2E-4: Inspección binaria completa y pagos pendientes

Prioridad: 🔴 Critical. Una APK con metadatos correctos termina la inspección automática, pero MAIN-11/12 permanecen pendientes hasta recibir evidencia de pruebas en terminal; el checklist global no queda completo.

### E2E-5: Recomendaciones y OAuth contextualizado

Prioridad: Alta. QR no seleccionado y documentación recomendada ausente mantienen su nivel original. Uso propio y múltiples cuentas se evalúan por separado para justificar aplicabilidad de OAuth, sin alterar las marcas de la fuente.

### E2E Test Summary

| Escenario | Resultado exigido |
| --- | --- |
| E2E-1 | Sin falso aprobado por otro proyecto. |
| E2E-2 | Evidencia obtenida del APK seleccionado. |
| E2E-3 | Ausencias y compatibilidad no verificada explícitas. |
| E2E-4 | Inspección automática separada de pruebas y homologación. |
| E2E-5 | Obligatoriedad original y aplicabilidad justificadas. |

## Approval

Pendiente de aprobación funcional. Después corresponde `/meli.spec technical`; la implementación requiere completar las aprobaciones de especificaciones y plan indicadas en las instrucciones del usuario.
