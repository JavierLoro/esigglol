# Issues propuestas a partir de la auditoría Luna

Estas issues siguen el formato observado en el repositorio: `Problema`, `Reproducción`, `Resultado esperado`, `Criterios de cierre` y `Archivos afectados` para bugs; `Problema`, `Solución propuesta` y `Archivos afectados` para mejoras UX.

## 1. Upper/Lower genera solo Upper Bracket y no crea el cuadro de perdedores

Etiquetas: `alta`, `bug`

### Problema

Al generar una fase de tipo Upper/Lower con cuatro equipos, la aplicación crea únicamente las dos semifinales del Upper Bracket. No aparecen partidos del Lower Bracket en administración ni en la vista pública, por lo que el formato queda detenido y no puede aplicar su regla principal de doble eliminación.

### Reproducción

1. Crear la fase `QA UpperLower Luna` con formato Upper/Lower y cuatro equipos.
2. Generar y confirmar el cuadro.
3. Abrir `/admin/partidos` y `/fases`.

### Resultado esperado

Generar la estructura inicial de Upper y Lower según las reglas del formato, y crear las siguientes rondas al guardar resultados.

### Criterios de cierre

- Se generan y administran los primeros partidos del Lower Bracket.
- Una derrota desciende al equipo al cuadro inferior y una segunda derrota lo elimina.
- Administración, página pública y overlay muestran la misma estructura.
- Se cubre la progresión con pruebas automatizadas y un recorrido E2E.

### Archivos afectados

`lib/bracket.ts`, `app/api/admin/fases/generate/route.ts`, componentes de brackets y vistas públicas de fases.

## 2. Final Four no crea la final ni el partido por el tercer puesto

Etiquetas: `alta`, `bug`

### Problema

Una fase Final Four configurada con partido por el tercer puesto se queda en `2/2 completados` después de resolver las dos semifinales. No se crean partidos administrables para la final ni para el tercer puesto; la página pública solo muestra una tarjeta de final sin partido asociado.

### Reproducción

1. Crear `QA FinalFour Luna` con cuatro equipos y activar `Incluir partido por 3er/4to puesto`.
2. Generar y confirmar el cuadro.
3. Guardar un resultado `1–0` en cada semifinal.
4. Recargar `/admin/partidos` y `/fases`.

### Resultado esperado

Al completarse ambas semifinales, crear la final y el partido por el tercer puesto, con equipos, marcador y estado editables desde administración y visibles en las vistas públicas.

### Criterios de cierre

- Se crean ambos partidos una sola vez y sobreviven a una recarga.
- Los ganadores de semifinales ocupan la final y los perdedores el tercer puesto.
- Los resultados actualizan campeón y clasificación pública.
- El flujo queda cubierto por pruebas de bracket y E2E.

### Archivos afectados

`lib/bracket.ts`, generación/avance de fases Final Four y componentes de brackets y partidos.

## 3. Un alta fallida deja persistente un equipo vacío `Nuevo equipo`

Etiquetas: `alta`, `bug`

### Problema

Si se inicia un alta de equipo y la operación falla por nombre duplicado, la aplicación deja persistido un registro auxiliar `Nuevo equipo` sin jugadores. El contador del dashboard aumenta y el equipo vacío aparece en las opciones públicas, contaminando los datos del torneo.

### Reproducción

1. Abrir `/admin/equipos` y crear un equipo válido, por ejemplo `QA Luna & Co`.
2. Iniciar otro alta, escribir el nombre existente `Freakpay` y guardar.
3. Recargar `/admin/equipos` y `/admin`.

### Resultado esperado

La creación debe ser atómica: una validación fallida no debe persistir ningún equipo parcial ni cambiar contadores o selectores.

### Criterios de cierre

- El alta fallida no crea registros en la base de datos.
- El dashboard, ranking, comparador y selectores mantienen los contadores previos.
- Una recarga no descubre entidades auxiliares.
- Se añade una prueba de regresión para errores de unicidad.

### Archivos afectados

`app/admin/equipos/page.tsx`, `app/api/admin/equipos/route.ts` y capa de persistencia de equipos.

## 4. El nombre vacío de un equipo se muestra como guardado

Etiquetas: `media`, `bug`

### Problema

Al editar un equipo y borrar completamente su nombre, el formulario vuelve a mostrar el nombre anterior y muestra el mensaje genérico `Guardado`. El usuario no recibe una validación del campo ni sabe que su entrada fue descartada.

### Reproducción

1. Abrir un equipo existente en `/admin/equipos`.
2. Borrar el contenido del nombre.
3. Pulsar `Guardar`.

### Resultado esperado

Mostrar una validación específica de campo obligatorio, conservar el formulario en estado de error y no mostrar un éxito si no se guardó la entrada solicitada.

### Criterios de cierre

- El nombre vacío se rechaza antes de persistir.
- El mensaje identifica el campo y explica cómo corregirlo.
- El estado de éxito solo aparece después de una respuesta guardada.
- Se cubren espacios, nombres largos y caracteres Unicode.

### Archivos afectados

`app/admin/equipos/page.tsx`, esquemas y validación de equipos.

## 5. Un nombre duplicado deja una tarjeta optimista hasta recargar

Etiquetas: `media`, `bug`

### Problema

Cuando el servidor rechaza un equipo duplicado, la interfaz muestra temporalmente una segunda tarjeta con el mismo nombre y mantiene el formulario con el valor rechazado. La tarjeta desaparece solo después de recargar.

### Reproducción

1. Abrir `Añadir equipo` en `/admin/equipos`.
2. Escribir el nombre existente `Freakpay`.
3. Pulsar `Guardar` y observar la lista antes de recargar.

### Resultado esperado

Ante un error de unicidad, limpiar o revertir el estado optimista y mantener el formulario en modo edición con el error visible, sin mostrar una entidad inexistente.

### Criterios de cierre

- No aparece una tarjeta duplicada después de un 4xx.
- La respuesta de error se asocia al formulario y permite corregirlo.
- El comportamiento es igual tras doble clic y después de recargar.

### Archivos afectados

`app/admin/equipos/page.tsx` y manejo de errores de `app/api/admin/equipos/route.ts`.

## 6. La portada muestra `En directo` cuando Twitch está sin conexión

Etiquetas: `media`, `bug`

### Problema

La portada etiqueta el bloque de streaming como `En directo` aunque el iframe de Twitch muestra `Sin conexión` y el canal está offline. El estado visible comunica una disponibilidad que no coincide con la fuente.

### Reproducción

1. Abrir `/` con el canal configurado pero sin emisión activa.
2. Comparar la etiqueta de la tarjeta con el estado mostrado por el embed de Twitch.

### Resultado esperado

Mostrar un estado offline coherente, o diferenciar claramente `Canal configurado` de `Emisión en directo` mientras no haya confirmación del estado real.

### Criterios de cierre

- El estado de la tarjeta coincide con el del canal.
- Existe un fallback claro si el embed no carga o está bloqueado.
- Se verifica el comportamiento en canal online, offline y sin configuración.

### Archivos afectados

`app/page.tsx`, `components/TwitchEmbed.tsx` y la fuente de configuración del canal.

## 7. Un código de partida inválido se descarta sin feedback

Etiquetas: `media`, `bug`

### Problema

El campo de código de partida acepta un valor inválido como `BADCODE` y no muestra error. Después de recargar, el valor desaparece, dejando al operador sin saber si se rechazó, se ignoró o se procesó.

### Reproducción

1. Abrir un partido pendiente en `/admin/partidos`.
2. Introducir `BADCODE` en el campo de código `EUW1_...`.
3. Guardar y recargar.

### Resultado esperado

Validar el formato antes de guardar o mostrar un error de Riot explícito, manteniendo el valor y el estado de error hasta que el operador lo corrija.

### Criterios de cierre

- El formato inválido se rechaza con un mensaje accionable.
- Los errores de la integración se distinguen de un guardado correcto.
- Los códigos válidos sobreviven a recarga y se muestran asociados al partido correcto.

### Archivos afectados

`app/admin/partidos/page.tsx`, rutas de códigos de partida y validación de Tournament API.

## 8. Los controles iconográficos de equipos no tienen nombre accesible

Etiquetas: `media`, `bug`

### Problema

Las acciones iconográficas de las tarjetas de equipo aparecen como botones sin texto, `aria-label` ni `title` en el árbol accesible. Un usuario de teclado o lector de pantalla no puede distinguir editar, guardar, cancelar o borrar.

### Reproducción

1. Abrir `/admin/equipos`.
2. Inspeccionar el árbol accesible de las tarjetas y sus botones.
3. Navegar con Tab por las acciones.

### Resultado esperado

Cada acción debe tener un nombre accesible estable, foco visible y un orden de teclado lógico.

### Criterios de cierre

- Todos los botones tienen nombre accesible en el árbol AX.
- El nombre refleja la acción y el equipo afectado cuando sea necesario.
- Se comprueba teclado, lector de pantalla y foco en modales de confirmación.

### Archivos afectados

`app/admin/equipos/page.tsx` y componentes reutilizables de botones iconográficos.

## 9. Obtener y configurar la Tournament API key de producción

Etiquetas: `alta`

### Necesidad operativa

El despliegue permanece en modo `stub` porque todavía no dispone de una Tournament API key de producción autorizada para organizar torneos reales.

### Trabajo necesario

1. Obtener acceso de producción a Tournament API conforme a las políticas de Riot.
2. Guardar la clave en el gestor de secretos del entorno.
3. Configurar el proveedor de producción y verificar registro, códigos y callback.

### Criterios de cierre

- Existe una clave de producción válida y autorizada.
- La clave se almacena fuera del repositorio y no aparece en logs o issues.
- El despliegue usa el proveedor de producción y registra correctamente el torneo.
- Se verifica la creación de códigos y la recepción del callback.

### Archivos afectados

Configuración del despliegue, gestor de secretos y documentación operativa de Tournament API.

## 10. El comparador permite seleccionar el mismo equipo antes de mostrar el aviso

Etiquetas: `baja`, `enhancement`

### Problema

En `/comparar` se puede seleccionar el mismo equipo en ambos desplegables. Solo después de completar la combinación inválida se muestra `Selecciona dos equipos diferentes para comparar`, lo que añade un paso que la interfaz podría prevenir.

### Solución propuesta

- Deshabilitar en cada selector el equipo elegido en el otro lado, o impedir la selección duplicada.
- Mantener el aviso como fallback para URLs compartidas o estado antiguo.
- Conservar la selección válida y actualizar las métricas sin parpadeos.

### Archivos afectados

`app/comparar/page.tsx` y componentes de selección del comparador.

## Registro en GitHub

| Hallazgo | Destino |
|---|---|
| QA-LUNA-001, QA-LUNA-002 | Issue #86 reabierta con evidencia de regresión |
| QA-LUNA-003 | Issue #102 actualizada |
| QA-LUNA-004 | Issue #109 |
| QA-LUNA-005 | Issue #111 |
| QA-LUNA-006 | Issue #101 actualizada |
| QA-LUNA-007 | Issue #110 |
| QA-LUNA-008 | Issue #106 |
| QA-LUNA-009 | Issue #107 |
| QA-LUNA-010 | Issue #108 |
