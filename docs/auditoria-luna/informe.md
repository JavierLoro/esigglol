# Auditoría exploratoria Luna — ESIgg.lol desplegado

- URL auditada: https://esigglol.jlc-dev.me
- Fecha: 2026-09-09 (Europe/Madrid)
- Navegador/sesión: Chrome existente del usuario, pestaña administrativa autenticada
- Viewport observado: escritorio aproximado 1916×908
- Alcance: recorrido funcional, coherencia entre administración y vistas públicas, errores, estados, responsive y diseño.
- Método: acciones visibles sobre la interfaz; ritmo humano; sin extracción de secretos. Las capturas aceptadas se muestran durante la sesión de auditoría y se referencian por bloque/URL cuando el runtime no permite persistir directamente los bytes de imagen.

## Estado

Auditoría completada. Los hallazgos confirmados están identificados con IDs `QA-LUNA-*` y prioridad P0–P3.

## Hallazgos

### QA-LUNA-001 — El formulario de equipo muestra “Guardado” tras nombre vacío (P2, reproducible)

- URL: `/admin/equipos`
- Precondición: sesión admin; abrir un equipo existente para editarlo.
- Pasos: abrir `QA Luna & Co`; borrar por completo el nombre; pulsar `Guardar`.
- Esperado: validación visible del campo vacío o rechazo explícito, conservando el formulario en estado de error.
- Observado: el campo vuelve a mostrar `QA Luna & Co` y aparece el mensaje genérico `Guardado`; no hay validación específica visible.
- Evidencia: AX/DOM capturado en el bloque de equipos, antes y después del guardado.
- Estado: confirmado en una ejecución; conviene repetir con un equipo nuevo antes de corregir.
- Impacto: el usuario no sabe que la entrada vacía fue descartada y puede interpretar que se guardó lo introducido.

### QA-LUNA-002 — Error de nombre duplicado deja tarjeta optimista hasta recargar (P2, reproducible)

- URL: `/admin/equipos`
- Precondición: existe `Freakpay`.
- Pasos: `Añadir equipo` → escribir `Freakpay` → `Guardar`.
- Esperado: error de unicidad sin añadir una tarjeta persistente falsa.
- Observado: aparece `Error de validación: 9.name: El nombre del equipo debe ser único`, pero también se muestra temporalmente una segunda tarjeta `Freakpay · 0 jugadores` y el formulario permanece con ese valor. Tras recargar, la tarjeta duplicada desaparece.
- Evidencia: DOM posterior al submit y DOM posterior a recarga.
- Estado: confirmado.
- Impacto: estado visual incoherente y riesgo de acciones sobre una entidad que nunca se guardó.

### QA-LUNA-003 — La home rotula “En directo” aunque Twitch está sin conexión (P2, reproducible)

- URL: `/`
- Esperado: el estado del bloque de streaming debe coincidir con el estado real del canal.
- Observado: la portada muestra `En directo`, mientras el iframe de Twitch muestra `Sin conexión` y `ESIUCLM está sin conexión`.
- Evidencia: DOM y captura de la portada durante el bloque público.
- Impacto: comunica disponibilidad de emisión cuando el canal está offline.

### QA-LUNA-004 — Código de partida inválido se pierde al recargar sin feedback (P2, reproducible)

- URL: `/admin/partidos`
- Pasos: en un partido pendiente QA, introducir `BADCODE` en `EUW1_...`; pulsar `Guardar`; recargar.
- Esperado: validación del formato o error de Riot visible y persistente en la interfaz.
- Observado: el campo acepta el texto sin error visible, pero tras recargar el valor no persiste.
- Evidencia: DOM antes y después de recarga.
- Impacto: el operador no sabe si el código fue rechazado, ignorado o procesado.

### QA-LUNA-005 — Comparador permite seleccionar el mismo equipo y sólo muestra el aviso después (P3, reproducible)

- URL: `/comparar`
- Pasos: seleccionar `Freakpay` en ambos desplegables.
- Esperado: impedir la combinación inválida o deshabilitar el segundo selector.
- Observado: ambos quedan seleccionados y el contenido se sustituye por `Selecciona dos equipos diferentes para comparar.`
- Evidencia: DOM posterior a selección.
- Impacto: fricción menor; el estado inválido se descubre después de la acción.

### QA-LUNA-006 — Los controles iconográficos de equipos carecen de nombre accesible (P2, reproducible)

- URL: `/admin/equipos`
- Observado: las diez acciones iconográficas de las tarjetas (incluidas las de borrado) aparecen como `button` sin texto, `aria-label` ni `title` en el DOM accesible.
- Evidencia: AX/DOM y evaluación de botones durante el bloque de equipos.
- Impacto: usuarios de teclado/lector de pantalla no pueden saber qué acción ejecuta cada botón.
- Nota: las eliminaciones no se ejecutaron porque el runtime exige confirmación inmediata para borrar.

### QA-LUNA-007 — Tournament API permanece en STUB por falta de credencial de producción (operativo)

- URL: `/admin`
- Pasos: introducir `QA Luna Tournament` en `Nombre del torneo` y pulsar `Registrar`.
- Contexto confirmado: todavía no se dispone de la Tournament API key de producción necesaria para operar torneos reales.
- Observado: aparece `Error de conexión`; el dashboard conserva `stub · euw1 · Sin configurar`.
- Evidencia: DOM posterior al submit.
- Clasificación: carencia operativa de credenciales, no defecto confirmado del modo stub. El seguimiento se realiza en la issue #110.

### QA-LUNA-008 — Upper/Lower genera sólo dos semifinales y no expone lower bracket (P1, reproducible)

- URLs: `/admin/fases`, `/admin/partidos`, `/fases`
- Precondición: `QA UpperLower Luna`, 4 equipos seleccionados, bracket generado y confirmado.
- Esperado: estructura Upper/Lower coherente, con lower bracket o una explicación clara de cuándo se crea.
- Observado: `/admin/partidos` muestra `0/2 completados` y sólo dos partidos; `/fases` muestra el bloque `Upper Bracket` con dos enlaces, sin bloque `Lower Bracket`.
- Evidencia: DOM contrastado en administración y vista pública.
- Impacto: el formato seleccionado promete una ruta de perdedores que no existe en el bracket generado.

### QA-LUNA-009 — Final Four no progresa a final ni tercer puesto tras dos semifinales (P1, reproducible)

- URLs: `/admin/fases`, `/admin/partidos`, `/fases`
- Precondición: `QA FinalFour Luna`, 4 equipos, opción `Incluir partido por 3er/4to puesto` marcada, bracket generado y confirmado.
- Pasos: marcar resultado en las dos semifinales y guardar ambos marcadores (1–0).
- Esperado: creación de la final y del partido por 3er/4to puesto.
- Observado: la sección queda en `2/2 completados` y no aparecen partidos nuevos; la vista pública sólo conserva las semifinales.
- Evidencia: DOM posterior a ambos guardados y conteo de partidos.
- Impacto: el flujo competitivo se detiene después de la primera ronda aunque la configuración solicite continuar.
- Repetición: tras recargar administración y volver a `/fases`, el mismo estado se reprodujo; la final aparece sólo como tarjeta pública sin partido administrable y sigue sin tercer puesto.

### QA-LUNA-010 — Abrir y fallar un alta deja un equipo vacío “Nuevo equipo” persistente (P1, reproducible)

- URL: `/admin/equipos`
- Precondición: 8 equipos iniciales; usar `Añadir equipo`.
- Pasos: crear `QA Luna & Co`; después abrir otro alta, cambiar el nombre a un duplicado (`Freakpay`) y guardar; recargar.
- Esperado: la operación rechazada no debe dejar entidades auxiliares persistentes.
- Observado: tras recargar aparece `Nuevo equipo · 0 jugadores`; el dashboard pasa de 8 a 10 equipos (uno intencional y uno vacío no intencional). El duplicado `Freakpay` no queda, pero el registro por defecto sí.
- Evidencia: `/admin/equipos` y `/admin` antes/después de recarga.
- Impacto: contaminación de datos y opciones públicas con una entidad incompleta; requiere borrado manual para reparar.

## Límites

La contraseña/API key se observan sólo enmascaradas. Las integraciones externas Riot/Tournament y partidas reales quedan limitadas por el entorno desplegado. Las eliminaciones destructivas requieren confirmación inmediata según la política de Computer Use; se dejan como bloqueadas si no hay confirmación disponible en el momento de la acción.

## Cierre de esta ejecución

- Cobertura realizada: login/sesión, dashboard, equipos, grupos, suizo, eliminación, Upper/Lower, Final Four, partidos, resultados, códigos, overlays, home/Twitch, fases públicas, ranking, comparador, detalle de equipos, detalle de partidos, error de integración Tournament API y estados sin datos.
- Prioridad P1: `QA-LUNA-008`, `QA-LUNA-009`, `QA-LUNA-010`.
- Prioridad P2: `QA-LUNA-001`, `QA-LUNA-002`, `QA-LUNA-003`, `QA-LUNA-004`, `QA-LUNA-006`.
- Prioridad P3: `QA-LUNA-005`.
- Cambios finales de datos: 10 equipos (incluye `QA Luna & Co` y el vacío `Nuevo equipo`), 6 fases (incluye cuatro fases QA), 20 partidos y 16 jugados. La tabla de cambios conserva el detalle y los casos rechazados.
- Pendiente/bloqueado: borrados por confirmación inmediata del runtime; viewport móvil por capability no expuesta; carga real Riot/Tournament y callbacks externos; todos los datos avanzados de partida y partidas reales.
- Recomendación de reproducción: revisar primero P1 en un entorno restaurable y no borrar las entidades QA hasta conservar las evidencias.
