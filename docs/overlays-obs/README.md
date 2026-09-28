# Overlays OBS por torneo — #130

La sección **Emisión / OBS** usa la edición activa de administración. Permite guardar un partido (también finalizado), quitarlo o fijar una fase y su grupo/ronda y página. **Seguir al partido** restaura el seguimiento automático; los cambios se aplican al pulsar **Guardar configuración**.

Cada torneo tiene tres fuentes permanentes:

- `/overlay/torneos/ID/marcador`: franja superior con fondo exterior transparente.
- `/overlay/torneos/ID/previa`: equipos, resultado de serie, fecha opcional y mapas/rondas de Valorant.
- `/overlay/torneos/ID/fase`: clasificación y partidos o cuadro, con páginas y contexto.

En OBS se añaden como fuentes **Navegador**, a **1920 × 1080**. También se ha comprobado 1280 × 720. La selección y los resultados se consultan cada 30 segundos mediante `router.refresh()`, conservando la URL y el documento del navegador.

Las tres fuentes tienen el lienzo transparente, incluidos los espacios entre componentes. Las tarjetas, cabeceras, clasificaciones y marcador conservan sus propios fondos para mantener la legibilidad. Coloca una imagen, vídeo o captura del juego debajo de la fuente en OBS para elegir el fondo del streaming.

La presentación actual integra la [propuesta neón aportada por el usuario](neon/README.md): paneles con diagonales y contornos luminosos. **Color de los overlays** permite elegir el acento por torneo para las tres fuentes; el valor inicial es rosa y **Restablecer rosa** lo recupera. Requiere guardar y se actualiza en las fuentes abiertas en un máximo de 30 segundos. Los bordes de recorrido conservan sus colores cian/ámbar. El marcador ocupa ahora el 88 % del ancho del lienzo y 7,4 cqw de alto; revisar los recortes existentes de esa fuente en OBS.

Las rutas antiguas `/overlay/partidos/ID` y `/overlay/fases/ID` siguen disponibles como vistas fijas que heredan las preferencias visuales del torneo. La de fase admite `section=group:A` o `section=round:1` y `page=2`; sin parámetros muestra su primera sección y página.

## Qué mostrar

Cada fuente tiene casillas independientes por torneo. **Solo lo esencial** muestra nombres, logos y resultados y desactiva los demás detalles; **Mostrar todos los detalles** activa las opciones aplicables. Ambos botones requieren guardar. Nombres y resultados permanecen visibles, igual que las conexiones de cuadros y las etiquetas de clasificación. Los logos se pueden ocultar con su casilla.

| Fuente | Detalles opcionales |
| --- | --- |
| Marcador | Logos, nombre del torneo y BO |
| Previa | Logos, torneo, rótulo de juego/vista, marca ESIgg, fase/ronda, BO, fecha, mapas de Valorant, estado del resultado, pie y aviso sin contenido |
| Resumen | Logos, torneo, rótulo de juego/vista, marca ESIgg, fase/grupo/ronda, títulos de columnas, página, BO y estado de encuentros, pie y aviso sin contenido |

Las opciones omitidas están desactivadas salvo los logos, que se muestran por defecto, también en configuraciones anteriores. Una preferencia explícita de ocultar logos se conserva; «Solo lo esencial» vuelve a activarlos. Ocultar un detalle reserva su espacio sin dibujarlo y no desplaza los otros componentes. No hay editor de posición ni tamaño.

En grupos y suizo se puede elegir **Según la fase**, **Ambos**, **Solo clasificación** o **Solo partidos**. Inicialmente se usa **Según la fase**: grupos muestra clasificación y partidos; suizo muestra todos los partidos de todas las rondas publicadas en una sola vista. Las elecciones explícitas se conservan. Las columnas conservan su posición y se paginan únicamente los bloques elegidos. Con partidos visibles, el seguimiento automático abre su página; con solo clasificación, abre la del primer equipo del encuentro (segundo equipo o primera página si falta). Cambiar esta elección desde administración restablece la página manual a 1. La elección no afecta a cuadros de eliminación, Final Four o Upper/Lower.

## Recorrido de los dos equipos

El suizo reutiliza `SwissView`, la misma vista de `/fases`: rondas con grupos por balance (0–0, 1–0, 0–1…), conexiones y bloques de clasificados/eliminados. Conserva todos los encuentros publicados, sin separar ni filtrar el historial de cada equipo. Las rondas aún no publicadas muestran únicamente las previsiones del cuadro público, nunca sus emparejamientos privados. Solo las series finalizadas cuentan para avanzar o eliminar equipos. El cuadro se ajusta al lienzo mediante un `viewBox`, sin esperar a JavaScript para aparecer. La presentación completa se ha comprobado con 16 equipos y cinco rondas en 1920×1080 y 1280×720.

Las tarjetas de todos los formatos siguen el aspecto de `/fases`, con filas separadas, columna de resultado y marca del ganador. La clasificación de grupos destaca las posiciones de avance. Se conservan el fondo exterior transparente, los logos y las opciones de visibilidad.

Capturas del torneo de pruebas con resultados: [suizo como `/fases`, 1080p](recorridos/valorant-fases-swiss-1920.png) y [720p](recorridos/valorant-fases-swiss-1280.png).

**Resaltar recorrido de los dos equipos** distingue los partidos donde aparece cada equipo seleccionado:

- Primer equipo: borde cian continuo.
- Segundo equipo: borde ámbar discontinuo.
- Partido entre ambos: borde cian más una marca interior ámbar discontinua.
- Resto de partidos: borde neutro.

La leyenda conserva los nombres y logos de ambos equipos. El resaltado se aplica también a los partidos visibles de grupos, eliminación, Final Four y Upper/Lower, manteniendo sus clasificaciones, cuadros y paginación habituales. Desactivarlo solo cambia los bordes y la leyenda; conserva todos los encuentros y sus posiciones.

La preferencia se guarda como `visibility.fase.history`; está activada si se omite y se puede desactivar con `false`. Los presets de detalles no la modifican. Si no hay partido seleccionado en esa fase, o un equipo todavía está por determinar, no se inventa ningún recorrido.

## Configuración y privacidad

`GET` y `PUT /api/admin/overlay?tournament=ID` requieren sesión de administrador global y torneo explícito. La configuración se guarda en `tournament_config`, clave `ID:overlay`, sin migraciones:

```json
{
  "matchId": null,
  "accentColor": "#ff5f98",
  "summary": null,
  "visibility": {
    "marcador": { "logos": true, "bo": true },
    "previa": { "tournament": true, "date": true, "maps": true },
    "fase": { "content": "both", "page": true }
  }
}
```

Para fijar el resumen, `summary` contiene `{ "phaseId": "ID", "section": "group:A", "page": 1 }`. La página empieza en 1; las rondas negativas corresponden a Lower, 98 al tercer puesto y 99 a la gran final. Omitir `summary` o usar `null` sigue al partido.

`accentColor` es opcional y acepta exclusivamente un color hexadecimal de seis dígitos (`#RRGGBB`); omitirlo usa rosa `#ff5f98`. Se hereda también en las rutas fijas de partido y fase.

`visibility` es opcional. Cada vista admite únicamente sus booleanos declarados; `fase.content` acepta `both`, `standings` o `matches`. Omitirlo aplica el valor según la fase: `matches` para suizo y `both` para grupos. El PUT sustituye la configuración completa: enviar las preferencias que se quieran conservar. Los tipos o campos no admitidos se rechazan con 422.

Las escrituras validan torneo, publicación de la fase/ronda y existencia de la página. Los torneos archivados permiten consultar su configuración, pero no modificarla. Las URLs públicas devuelven 404 para torneos ocultos, archivados o inexistentes.

Sin selección, las fuentes quedan transparentes. En previa y resumen se puede activar «Mostrar aviso sin contenido» (`empty`) para mostrar «Sin contenido seleccionado». Una referencia eliminada o retirada de publicación deja de mostrarse en el siguiente refresco, sin sustituirla por otro partido. Un resumen fijado válido es independiente del partido. El refresco continúa para recuperar contenido válido posteriormente.

Las clasificaciones reutilizan los cálculos de grupos y suizo; el BO se resuelve por ronda. La vista completa del suizo muestra todas sus columnas y hasta ocho encuentros por ronda en el formato de 16 equipos. Las demás vistas mantienen como máximo tres columnas, doce filas de clasificación o cuatro encuentros por columna. Hasta doce equipos, la clasificación permanece completa en todas las páginas de encuentros; el alto de las filas se adapta sin reducir la tipografía. Las clasificaciones mayores se dividen en bloques de doce, que se repiten si hay más páginas de partidos para que la tabla no desaparezca.

## Validación en CT112

La [auditoría visual con tres subagentes](auditoria/README.md) recoge los hallazgos contrastados y las capturas de esta sesión. Se corrigieron la clasificación incompleta al cambiar de página, el VS duplicado en previas pendientes y la copia de URLs al acceder por HTTP en la red local. Esta última usa la alternativa nativa existente en otras pantallas cuando no está disponible la Clipboard API; la prueba comprueba la URL copiada y la restauración del foco.

- Rama: `overlaysOBS`. La prueba de visibilidad se ha ejecutado en el puerto 3102, con base `.tmp/obs-transparency.db` y salida `.tmp/obs-transparency-next`, separadas de la previsualización abierta en 3100. El lanzador habitual usa `.tmp/e2e/esigglol.db` y `.next-e2e` y recrea exclusivamente esos datos de prueba.
- `npm run lint` y `npx tsc --noEmit`: correctos.
- Suite completa `npm test -- --pool=threads`: 52 archivos, 291 pruebas correctas.
- `npx vitest run components/brackets/SwissView.test.tsx lib/__tests__/overlay.test.ts lib/__tests__/overlay-route.test.ts --pool=threads`: 3 archivos, 14 pruebas; cubren configuración, autorización, aislamiento, publicación, paginación, todas las rondas del suizo y la exclusión de resultados parciales de sus bloques de clasificación/eliminación.
- `next build`: correcto, con base `.tmp/obs-build.db`, salida `.tmp/obs-build` y credenciales efímeras generadas en memoria. Se ejecutó directamente la compilación para evitar las descargas de catálogos del script `prebuild`.
- `e2e/overlays.spec.ts`: prueba correcta con guardado explícito, tres URLs abiertas y refrescadas, cambio de partido, resultados, dos torneos independientes, resumen manual y automático, eliminación, retirada de publicación, recuperación y acceso anónimo a las fuentes. También verifica presets, casillas, persistencia tras recargar, herencia en una URL fija y coordenadas estables de equipos, resultados y columnas al ocultar detalles o bloques.
- Matriz visual: LoL y Valorant; grupos, suizo, eliminación, Final Four y Upper/Lower; pendiente/finalizado, BO por ronda, mapas, nombres largos, logos presentes/ausentes, equipos pendientes y paginación. Se comprueban el tamaño estable del marcador, la transparencia del fondo y la ausencia de desplazamiento de página a ambas resoluciones.
- La prueba `OBS: complete Swiss and distinct team borders across all phase formats` verifica un suizo completo de cinco rondas, todos sus encuentros, los bordes diferenciados de cada equipo y el doble marcado de sus cruces. Comprueba los cinco formatos en ambos juegos, el guardado de la casilla y que desactivar el resaltado conserve los mismos partidos. Deja [20 capturas](recorridos/) a ambas resoluciones: [suizo completo](recorridos/valorant-paths-swiss-1280.png), [grupos](recorridos/lol-paths-groups-1280.png), [tercer puesto](recorridos/lol-paths-final-four-1280.png), [Lower](recorridos/lol-paths-upper-lower-1280.png).
- La prueba `OBS: tournament color, explicit save, fixed sources and reset` comprueba el color en las tres fuentes y ambas rutas fijas, su persistencia, el aislamiento entre torneos, el retorno al rosa y la estabilidad de las medidas. La primera ejecución agotó el tiempo cargando el login; la repetición aislada pasó en 1,7 minutos. Las otras dos pruebas pasaron en la ejecución completa. [Capturas del color personalizado](neon/README.md).

Las 56 capturas están en [capturas](capturas/), incluidas vistas mínimas y completas de ambos juegos a ambas resoluciones. Los 54 PNG de fuentes conservan alfa 0 en el exterior y en un hueco entre componentes, y alfa 255 dentro de un panel visible; en las vistas mínimas también se verifica alfa 0 donde se oculta la cabecera o el centro del marcador. La prueba de navegador comprueba además que los contenedores no tengan color ni imagen de fondo y que los componentes conserven su fondo. Ejemplos: [panel](capturas/lol-admin.png), [marcador mínimo](capturas/lol-marcador-minimal-1920.png), [previa mínima](capturas/valorant-previa-minimal-1920.png), [previa completa](capturas/valorant-previa-final-1920.png), [Final Four](capturas/lol-final-four-1920.png) y [Upper/Lower](capturas/valorant-upper-lower-1280.png). Para regenerarlas con el Chrome instalado en CT112:

```sh
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/overlays.spec.ts
```

Playwright deja los PNG en `test-results/overlays-*/`. La validación usa Chromium como fuente de navegador; no se ha conectado una instancia real de OBS ni desplegado en CT114.
