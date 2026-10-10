# Compatibilidad y decisión F0 (piloto D1)

Registro histórico de la PoC D1. La continuación de producto usa otra arquitectura: [aplicación con Durable Objects](application.md). El HOLD de D1 no se presenta como resuelto ni como el estado del despliegue actual.

Fecha de revisión: 2026-10-10. Base: `6a431db`. Alcance: primera PR incremental de #136.

**Decisión: HOLD / NO-GO para migración global y producción.** Hay una PoC local ejecutable y un camino de investigación con vinext, pero falta medir Workers Free y cerrar atomicidad y jobs. No se autoriza F1–F6 por un `build OK` ni por el porcentaje de `vinext check`.

## Matriz de trabajo

Responsables son roles de implementación, no asignaciones a personas. Las rutas concretas y sus dependencias se enumeran en [inventory.md](inventory.md); los grupos de esta matriz abarcan todas las familias de producto.

| Módulo / rutas | Clasificación actual | Responsable / fase | Adaptación o bloqueo | Prueba de salida |
|---|---|---|---|---|
| `lib/db.ts`, `lib/db-migrations.ts` | Bloqueo | Persistencia, F1/F2 | Addon nativo `better-sqlite3`; `getDb()` y migraciones durante import; WAL, pragma, migraciones JS síncronas | Contratos SQLite sin regresiones; esquema D1 versionado, migraciones idempotentes y recuperación |
| `lib/data.ts`, `lib/data-riot.ts` | Refactor / bloqueo de atomicidad | Persistencia, F1/F2 | SQL síncrono, transacciones anidadas, `.immediate()`, versiones CAS; no sustituir driver mecánicamente | Mutaciones atómicas, fallos intermedios, carreras, HTTP 409, invariantes de fases/partidos |
| `lib/competitions.ts`, `team-portal-data.ts`, `overlay-data.ts` | Refactor | Persistencia, F1/F2 | Escrituras multi-paso; accesos de equipo/versiones de sesión; configuración de overlay | Eliminación completa/rollback, revocación de sesión, consistencia de competiciones |
| Home, equipos/detalle, torneos/fases, partidos/detalle, comparar y ranking | Bloqueados por dependencias | Frontend + persistencia, F2/F4 | UI reutilizable, repositorios asíncronos en SSR y handlers; ranking programa `after()` | SSR y navegación reales, estados vacíos, filtros, rankings, brackets y publicación |
| `/admin/**`, `/api/admin/**` | Bloqueados por dependencias | Auth + persistencia, F2/F4 | Login, administración, apariencia, solicitudes, fases/partidos, ajustes y claves; limitador de intentos de login en memoria por isolate | Roles, validación, 400/401/403/404/409, rate limit entre isolates, concurrencia, errores sin pérdida de datos |
| `/equipo/**`, `/api/team/**` | Bloqueados por dependencias | Auth + persistencia, F2/F4 | Portal, solicitudes, roles de jugadores, cambios de horario/logo; cookie y versión DB | Login/desactivación, aislamiento equipo, aprobación/rechazo, calendario y logos |
| `upload-files.ts`, `logo-cleanup.ts`, upload-logo, uploads, apariencia y solicitudes de logo | Refactor / bloqueo FS persistente | Archivos, F3 | Disco local y nombres antiguos; limpieza de referencias bajo lock SQLite. R2 y D1 no comparten transacción | URL antigua, MIME/tamaño/nombre, reemplazo, referencias compartidas, compensación y huérfanos |
| `ddragon.ts`, profileicon, `valorant-assets.ts` | Refactor | Assets, F3 | Lecturas/escrituras y caché local; usar build/CDN/R2, no disco persistente del Worker | Assets reales, iconos, 404, cache-control y rutas de overlays |
| `scripts/sync-ddragon.ts`, `sync-valorant.ts`, `predev/prebuild` | Adaptación de build | Infra, F3/F5 | Herramientas Node válidas fuera del Worker. Valorant puede descargar un ZIP de ~1,5 GB y extrae solo catálogo/imágenes permitidas; comprobar límites de assets por fichero/cantidad | Build reproducible, política de actualización, tamaño final y disponibilidad sin fetch runtime a FS |
| `lib/env.ts`, `auth.ts`, `team-credentials.ts` | Refactor | Runtime/auth, F4 | Secretos en evaluación de módulo, fallback `.env.local`, crypto Node y dependencias dinámicas a DB | Bindings por request; JWT/cookies/crypto, secretos fuera del cliente, rotación/revocación |
| `proxy.ts`, `metrics.ts`, `logger.ts`, `/api/metrics` | Refactor | Runtime/observabilidad, F4 | Proxy real importa auth/env/DB indirectamente; métricas del proceso y transportes pino Node | Proxy real con CSP/cabeceras, navegación/redirects, logs sin secretos; métricas de Worker sin proceso Node |
| `competition-context.ts`, wrappers de competición | Adaptación a validar | Runtime, F4 | `AsyncLocalStorage` soportado con compatibilidad Node, pero comprobar propagación request/after | Requests simultáneos de distintos torneos, sin filtraciones entre contextos |
| `refresh.ts`, ranking, `/api/riot/refresh-stats{,/player}` | Bloqueo de jobs | Jobs, F4 (diseño en F0) | Map por isolate, retrasos de 30 s entre lotes, hasta 100 matches por jugador y llamadas adicionales. Responder + `after()` no garantiza durabilidad | Lease/checkpoint persistente, reintentos, rate limit, duplicados, reanudación tras terminar isolate; presupuesto por fragmento |
| `riot.ts`, `tournament.ts`, callback y Riot IDs | Adaptación + dependencias bloqueadas | Integraciones, F2/F4 | API keys, timeouts/reintentos, datos de callback y códigos/tokens en DB | APIs simuladas antes de reales; callbacks idempotentes y errores 429, expiración y resultados coherentes |
| `riot-events.ts`, `/api/admin/riot-events` | Bloqueo de comunicación entre isolates | Runtime/eventos, F4 | `Set` de listeners en memoria solo comunica en un proceso; callback y SSE pueden llegar a distintos isolates | Estrategia de polling/eventos persistidos o servicio explícito; dos isolates y reconexión |
| `valorant.ts`, `valorant-runtime-key.ts`, rutas sandbox/admin/estadísticas | Adaptación + dependencias bloqueadas | Integraciones/runtime, F4 | Keys y global mutable de sandbox; cachés persistidas y assets | Sandbox no disponible en producción, secretos por entorno, ranking/detalle reales y límites de API |
| `twitch.ts`, `/api/twitch/status` | Adaptación | Integraciones, F4 | Caché/token/promise en memoria como optimización; no asumir caché compartida; cuotas y timeout | Live/offline/unknown, token expiry, errores, coste con múltiples isolates |
| `/overlay/**`, `overlay.ts`, `overlay-data.ts` | UI candidata; lectura bloqueada | Frontend/persistencia, F2/F4 | OBS conserva contratos/URLs; datos y assets aún acoplados a SQLite/FS | Vistas torneo/fase/partido, polling, imágenes, streaming y estados publicados/archivados |
| `/api/health` | Handler candidato; proxy bloqueado | Runtime, F4 | El handler aislado no toca DB, pero el proxy de producción sí la alcanza indirectamente | Health completo del Worker y sus bindings, sin revelar secretos |
| `lib/bracket*`, `swiss.ts`, validadores/tipos/identidad | Candidatos / revisión por imports | Dominio, F1/F2 | Reutilizar lógica pura; no confundir Maps locales de cálculo con estado persistente | Tests existentes y ejecución en Worker de funciones compartidas; cargas representativas |
| Backup/restore SQLite, collect-stats, seed, scripts de desarrollo | Node soportado / adaptación específica | Infra, F2/F5 | Son herramientas de operación Node, no código de Worker; mantener backup Docker | Backup/restore SQLite; diseño D1 Time Travel/export + copia R2 y prueba de restauración separada |

## Adaptador y versiones

| Opción | Evidencia | Decisión |
|---|---|---|
| vinext `1.1.0` + Vite `8.3.4`, plugin Cloudflare `1.63.1`, Wrangler `4.149.0` | Recomendación actual de Cloudflare; `vinext check` en la app: 6/6 imports Next, 4/5 opciones, imágenes parcial; 24 páginas, 3 layouts y 39 handlers. Build de PoC con App Router/RSC | Candidato para piloto; no adopción definitiva |
| React en vinext | Peers de vinext `^19.2.6`; producto mantiene `19.2.4`. Fixture usa React/DOM/RSC `19.2.6` en lockfile independiente | Resolver alineación/paridad en otra PR si hay GO; no usar `--legacy-peer-deps` |
| OpenNext `1.20.10` | Documentación oficial: adapta output de Next y admite App Router/after/SSR; indica falta de soporte de middleware Node | Alternativa pendiente de PoC si vinext bloquea requisitos; cambiar adaptador no elimina SQLite/FS/jobs. No se afirma que se haya construido/probado |
| `next/image` | PoC prueba componente e imagen local sin optimización | Optimización real pendiente: evaluar Images/coste o política de imágenes explícita; no presentar `unoptimized` como paridad |

Las versiones fijadas están en el lockfile de la PoC. No se incorpora infraestructura Cloudflare al bundle Docker; TypeScript/Vitest de producto excluyen la fixture, ESLint sigue revisando su fuente y Docker no la copia.

## Camino propuesto para desbloquear atomicidad

El rollback y CAS de la PoC son pruebas de primitivas D1, **no contratos de los repositorios de esigglol**. El gate permanece abierto hasta demostrar las operaciones representativas del producto:

- D1 `batch()` para lotes conocidos de antemano: si una sentencia falla, todo el lote debe revertir.
- Read-modify-write: convertir versiones en condiciones SQL (`WHERE version = ?`), comprobar filas afectadas y devolver conflicto. Un lote con un UPDATE de cero filas puede continuar: **no basta para cancelar otras escrituras**. Resolver precondiciones atómicas y probarlas antes de trasladar `saveMatch`/fases.
- Lecturas y decisiones dentro de transacciones JS anidadas: diseñar una operación SQL/repository con límites explícitos, sin simular una transacción síncrona D1 ni mantener un lock durante awaits externos.
- Archivos: R2 no comparte rollback con D1. Necesita claves inmutables, publicación condicionada y borrado idempotente tras comprobar referencias; diseñar compensación/reconciliación sin eliminar archivos referenciados en una carrera.

## Camino propuesto para jobs/eventos

Persistir estado, lease/version, cursor de progreso, próximo intento y errores; fragmentar el trabajo por jugador/match con un presupuesto máximo de subrequests/CPU. Separar el caché en memoria opcional de los datos de control duraderos. Evaluar trigger permitido y coste (Cron, cola u otro servicio) antes de elegirlo. No se añade una dependencia de pago ni se promete que Cron Free resuelva CPU.

Los eventos de resultados deben poder verse desde otro isolate; investigar polling de un registro persistido como opción inicial y medir carga. `after()` en la fixture solo demuestra un efecto corto en R2, no ejecución fiable de Riot ni entrega SSE entre procesos.

## Gate de salida F0

- [x] Inventario y matriz revisables, incluida propagación de dependencias indirectas.
- [x] PoC aislada reproducible y versiones fijadas.
- [x] Estrategias candidatas y riesgos de atomicidad/jobs documentados.
- [ ] Validar operaciones reales representativas (fases/CAS, logos, jobs y eventos) con estrategia aceptada.
- [ ] Ejecutar proxy/auth real, UI y optimización de imágenes real en Worker.
- [ ] Piloto remoto Free con CPU/subrequests/bundle/startup, consumo D1/R2 y resultado documentado.
- [ ] Revisar activación/facturación R2, presupuesto, alertas y backup/restore.
- [ ] Aprobar decisión GO antes de iniciar migración global.

## Fuentes oficiales (consultadas 2026-10-10)

- [Next.js / vinext en Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [vinext y sus limitaciones](https://github.com/cloudflare/vinext)
- [OpenNext en Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Límites Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 batch y semántica](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Límites D1](https://developers.cloudflare.com/d1/platform/limits/) y [precios](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 precios](https://developers.cloudflare.com/r2/pricing/) y [activación](https://developers.cloudflare.com/r2/get-started/)
