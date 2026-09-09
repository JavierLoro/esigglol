# Matriz de cobertura

| Área | Estado | Evidencia / notas |
|---|---|---|
| Dashboard admin | Pasado inicial | `/admin` cargado con métricas y configuración; contadores finales contrastados |
| Login / sesión | Pasado inicial | `/admin/login` presentó campo enmascarado y acceso correcto |
| Equipos CRUD | Parcial | Alta/edición, roles, persistencia y unicidad probadas; borrado bloqueado por confirmación de Computer Use |
| Fases y formatos | Parcial | Suizo, grupos, eliminación, Upper/Lower y Final Four configurados; progresión Upper/Lower/Final Four falla |
| Partidos y resultados | Parcial | Resultado manual y propagación pública probados; CRUD/borrado sin completar |
| Datos por partida | Parcial | Botón Datos observado; sin datos avanzados en pendiente |
| Overlays / selección masiva | Pasado inicial | Copia de URLs confirmada en fases y partidos; seleccionar/deseleccionar todo probado sin borrar |
| Inicio público | Parcial | Home cargada; Twitch rotula En directo con iframe offline |
| Fases públicas | Pasado inicial | Fases QA visibles, grupos y bracket renderizados |
| Ranking | Parcial | Tabla, búsqueda, roles, suplentes y estado de API comprobados |
| Comparador | Parcial | Selector, métricas y mismo equipo validado |
| Detalle de equipos | Pasado inicial | Freakpay y estados sin datos observados |
| Detalle de partidos | Pasado inicial | Partido QA con marcador manual y “Sin datos” |
| Riot / Tournament API | Bloqueado | Dashboard indica STUB; falta la Tournament API key de producción necesaria para probar torneos reales |
| Responsive móvil | Bloqueado | El browser runtime seleccionado no expone capability de viewport; escritorio capturado |
| Accesibilidad observable | Parcial | AX tree; botones iconográficos sin nombre accesible |
| Persistencia / propagación | Parcial | Equipos/fases/resultados propagan; error de alta deja `Nuevo equipo`; errores optimistas y códigos rechazados requieren recarga |
| Errores / estados vacíos | Parcial | Unicidad, comparación idéntica, API STUB y Twitch offline observados |
