# Plan de auditoría exploratoria para Luna

## Encargo y autorización

Audita de forma exhaustiva https://esigglol.jlc-dev.me, empezando por /admin. Busca errores funcionales, estados incoherentes, flujos confusos, decisiones de producto incompletas y problemas de coherencia visual. Actúa como administrador del torneo y como espectador.

El usuario tiene una copia de los datos y autoriza crear, editar y borrar cualquier dato de la página para probarla. No vuelvas a pedir confirmación para estas operaciones. Esta tarea es de diagnóstico: entrega incidencias reproducibles y propuestas concretas; no implementes correcciones ni despliegues cambios.

Usa el modelo gpt-5.6-luna. Trabaja por bloques y guarda resultados tras cada uno. No des por completada la auditoría porque funcione el recorrido feliz. No delegues salvo autorización adicional.

## Preparación y método

1. Lee AGENTS.md y las skills aplicables: computer-use para el navegador; product-design:index y product-design:audit para la evaluación visual. Sigue sus instrucciones de captura de evidencias. Si utilizas Orca en Windows, carga además orca-cli y orca-windows-runtime y ejecuta el preflight requerido.
2. Usa el navegador con la sesión existente cuando esté disponible. Identifica explícitamente dominio, sesión y entorno. Si falta acceso, pide al usuario iniciar sesión y continúa mientras tanto con las áreas públicas. No extraigas contraseñas ni claves de archivos o del navegador.
3. Recorre la interfaz e inventaría rutas, controles y acciones realmente disponibles. El listado de este plan procede del repositorio y debe contrastarse con la versión desplegada. Usa el código como apoyo, nunca como prueba de que algo funciona en producción.
4. Captura el estado inicial de cada pantalla antes de evaluarla. Registra viewport, fecha, URL y datos necesarios. No incluyas claves, cookies ni tokens en evidencias.
5. Crea una matriz de cobertura con una fila por escenario: ID, área, precondición, acción, resultado esperado, resultado observado, estado, evidencia e incidencia asociada. Estados: pendiente, pasa, falla, bloqueado, no aplica. Justifica bloqueos y no aplicables.
6. Para cada escritura verifica el resultado inmediato, recarga, vuelve a entrar y comprueba su reflejo público y sus dependencias. Un mensaje de éxito no demuestra persistencia.
7. Nombra los datos sintéticos QA-LUNA-<caso>. Registra también cualquier dato previo modificado o eliminado. Reserva los borrados que afecten a muchas entidades para el final de los recorridos que dependan de ellas.
8. Mantén un ritmo humano con Riot. No hagas pruebas de carga, fuerza bruta ni ráfagas de peticiones. No revoques credenciales externas. Las integraciones que requieran una partida real, una clave no disponible o servicios externos se documentan como bloqueadas cuando corresponda.

## Matriz mínima por área

| Área y rutas | Escenarios obligatorios |
| --- | --- |
| Navegación: /, menú público, menú admin | Todos los enlaces y botones; indicador de sección activa; entrar por URL directa; atrás/adelante; recarga; enlaces compartidos; rutas e identificadores inexistentes; retorno desde detalle. |
| Sesión: /admin/login y /admin | Contraseña incorrecta y vacía, error recuperable, acceso válido si disponible, cierre de sesión al final, páginas protegidas sin sesión, recuperación al volver a entrar. Diferenciar controles públicos de administrativos. No cerrar la única sesión útil antes de acabar las pruebas admin. |
| Equipos: /admin/equipos y /equipos/[id] | Crear, editar, cancelar y borrar; nombre vacío, espacios, largo, acentos y caracteres especiales; equipo sin jugadores; añadir/quitar/reordenar jugadores si existe; titulares, roles secundarios y suplentes; Nick#TAG inválido; duplicados dentro y entre equipos. Logos válidos, formato no admitido, archivo vacío o grande, reemplazo y eliminación. Persistencia y reflejo en ranking, comparador, partidos y cuadros. |
| Fases: /admin/fases y /fases | Crear y editar cada formato: grupos, suizo, upper-lower, final-four y eliminación. Estados próxima/en curso/finalizada; orden y nombres; BO1/BO2/BO3/BO5 donde se permitan; cero, uno, suficientes e insuficientes participantes; duplicados; configuración incompleta; generación y regeneración; cancelación; confirmaciones; edición y borrado con partidos existentes. |
| Partidos: /admin/partidos y /partidos/[id] | Alta manual, edición, selección y borrado individual/múltiple; filtros y selección después de filtrar; equipos pendientes, repetidos o ajenos a la fase; cambio de ronda/equipos; fecha vacía, pasada y futura; selector de fecha, quitar fecha y hora local; resultados parciales, definitivos, empatados y fuera del BO; corrección y retirada de resultado. |
| Datos de cada partida | Abrir/cerrar modal, guardar/cancelar; estadísticas manuales si disponibles; valores vacíos/negativos/inválidos; ID Riot válido, inválido y repetido; importar y reimportar; eliminar una partida intermedia de una serie sin desplazar las demás; correspondencia de jugadores, equipos, marcador y ganador. |
| Ranking: /ranking | Búsqueda por jugador/equipo, mayúsculas y acentos; filtros y ordenación disponibles; cero coincidencias; estadísticas ausentes o a cero; empates, suplentes y equipos eliminados; enlaces y actualización de estadísticas. |
| Comparador: /comparar | Dos equipos distintos, mismo equipo, invertir lados, cambiar selección, cero/uno/muchos equipos; URL compartida si existe; medias de titulares, suplentes, roles, campeones e historial H2H; datos parciales; actualizar y contrastar con ranking y ficha. |
| Dashboard e integración Riot | Contadores contra datos reales; estado de API y configuración del torneo; validación de formularios sin exponer claves; actualización global, por equipo y por jugador; progreso, bloqueo de doble clic, error y recuperación; distinguir modo stub de producción antes de interpretar resultados. |
| Códigos, lobby y resultados automáticos | Generar, copiar, comprobar/regenerar códigos; cantidad por BO y asociación a cada partida; eventos de lobby y notificaciones si pueden producirse; consistencia tras recarga. No atribuir una prueba completa de callback a la mera generación de un código. |
| Overlays: /overlay/fases/[id] y /overlay/partidos/[id] | Copiar y abrir URL; datos y estilos; actualizar origen y observar refresco automático; marcador parcial/final, equipos pendientes, nombre y logo largos; IDs borrados/inexistentes; dimensiones adecuadas para emisión y ausencia de controles admin. |
| Inicio y Twitch | Contenido y enlaces con torneo vacío/activo/finalizado; estado del directo, carga y error del embed; comportamiento en móvil y espacio reservado cuando no hay emisión. |

## Lógica competitiva: pruebas profundas

Completa un torneo pequeño de principio a fin antes de provocar casos destructivos. No basta con generar cuadros y mirarlos.

- **Grupos:** distribución y participantes; calendario sin enfrentamientos imposibles o duplicados no previstos; clasificación con victorias, derrotas y empates permitidos; desempates y número de clasificados. Corrige un resultado y verifica el recálculo.
- **Suizo:** prueba tamaños 8 y 16; umbrales de clasificación/eliminación; BO por ronda; generar con ronda incompleta; confirmación y repetición de generación; equipos que avanzan o quedan fuera y posibles revanchas. Completa al menos un cuadro y contrasta cada transición con reglas documentadas o expuestas.
- **Eliminación:** progresión del ganador, participantes impares y descansos si son admitidos; final y tercer puesto opcional; marcador parcial sin clasificación prematura.
- **Upper/lower:** descenso del perdedor al cuadro inferior, segunda derrota, progreso hasta la final y tratamiento de la gran final según reglas implementadas. Señala reglas ambiguas como dudas de producto, no como bugs confirmados.
- **Final four:** composición, semifinales, final y tercer puesto si está habilitado.
- **Cambios retroactivos:** corrige un ganador después de generar o jugar la siguiente ronda; elimina un partido anterior; cambia participantes, BO o estado de fase después de generar. Comprueba que la app rechaza operaciones incompatibles o actualiza coherentemente sus dependencias; registra cualquier estado híbrido.
- **Idempotencia:** doble clic en guardar/generar/importar, repetir una operación y recargar durante un guardado. No deben aparecer duplicados silenciosos ni mensajes de éxito engañosos.

## Casos transversales y diseño

Revisa todos los flujos principales en escritorio (1440 × 900) y móvil (390 × 844); añade 360 px y 768 px en las pantallas con tablas, cuadros, modales y navegación. Si la herramienta no permite cambiar viewport, registra esa limitación y no afirmes cobertura responsive.

- Jerarquía de títulos y acciones, consistencia de botones, espaciado, tipografía, colores, iconos, alineación y densidad entre pantallas.
- Tablas y cuadros legibles; desbordamientos, textos cortados, áreas sin scroll, menús o modales fuera de pantalla; logos con distintas proporciones y nombres largos.
- Estados vacío, cargando, guardando, éxito, error, deshabilitado y sin datos. Distinguir cero de desconocido y pendiente de finalizado.
- Claridad de etiquetas, reglas de torneo, fechas, mensajes de error y consecuencias de borrar/regenerar. Comprobar cancelación y pérdida de cambios al navegar.
- Teclado: Tab, Shift+Tab, Enter y Escape; foco visible, orden lógico, foco al abrir/cerrar modales y controles accesibles con nombre comprensible. Zoom 200 %, contraste medido cuando sea posible y acciones táctiles utilizables.
- Coherencia entre páginas: mismo nombre, logo, estado, horario, marcador, ganador, clasificación y estadísticas para la misma entidad.
- Recuperación ante fallo de integración, petición fallida o conexión interrumpida cuando se pueda simular de forma acotada. No confundir simulación local con fallo observado del servicio desplegado.
- Dos pestañas con un mismo registro: editar desde ambas, recargar y comprobar si hay sobrescritura silenciosa o datos obsoletos.

En diseño, explica qué tarea dificulta el problema y a quién afecta. Separa inconsistencias observables, dudas sobre reglas de producto y preferencias estéticas. No conviertas gustos personales en errores.

## Orden de ejecución

1. Inventario, capturas iniciales y recorrido público.
2. Equipos y datos sintéticos; CRUD y validaciones.
3. Un torneo completo: equipos → fase → generación → partidos → resultados → clasificación → final → overlays.
4. Resto de formatos y casos competitivos límite.
5. Ranking, comparador, Riot, códigos, lobby y overlays.
6. Móvil, teclado, zoom, estados vacíos/error y coherencia visual de las pantallas anteriores.
7. Cambios retroactivos, borrados con dependencias, sesión y comprobación pública final.
8. Reproducción de incidencias, deduplicación y entrega.

Si un bloque está bloqueado, guarda la causa y continúa con los independientes. Da actualizaciones breves con cobertura alcanzada, hallazgos relevantes y siguiente bloque. Guarda un punto de continuación si se interrumpe la sesión.

## Evidencias y entregables

Guarda los resultados en docs/auditoria-luna/ con informe.md, cobertura.md, cambios-datos.md y una carpeta evidencias/. No subas estos resultados a terceros ni publiques issues durante esta tarea.

Cada incidencia debe contener:

- ID y título concreto.
- Tipo: funcional, integridad de datos, visual, accesibilidad, usabilidad o regla de producto ambigua.
- Prioridad: P0 pérdida grave/exposición/bloqueo general; P1 flujo principal roto o resultado competitivo incorrecto; P2 problema con alternativa o impacto limitado; P3 detalle visual/textual.
- Entorno, URL, viewport, sesión y precondiciones, incluidos los IDs de datos de prueba.
- Pasos mínimos numerados, resultado esperado y observado.
- Evidencia antes/después cuando ayude, sin secretos; errores de consola/red únicamente si fueron observados con herramientas disponibles.
- Reproducibilidad y alcance. Indica si es confirmado, intermitente o hipótesis pendiente.
- Impacto para administrador/espectador y propuesta concreta de comportamiento correcto.
- Referencia opcional al código como posible causa, separada de la evidencia del navegador.

El informe final debe incluir incidencias priorizadas sin duplicados, los principales problemas de coherencia, cobertura ejecutada por área, bloqueos y riesgos pendientes. Registra qué se creó, modificó o borró y en qué estado queda la página. No restaures automáticamente la copia ni borres las evidencias: deja los escenarios identificables para reproducirlos.

## Criterio de cierre

Finaliza cuando todas las filas inventariadas tengan un resultado documentado; todos los formatos se hayan probado o tengan un bloqueo preciso; exista al menos un recorrido completo; y se hayan revisado responsive, errores, persistencia y propagación entre vistas. Repite una segunda vez los fallos graves cuando sea viable sin destruir su evidencia.

No prometas haber probado todas las combinaciones posibles. Declara exactamente qué se ha ejecutado, qué queda sin verificar y por qué. El éxito de esta tarea es un diagnóstico accionable y verificable, no un número de clics ni una lista de impresiones.
