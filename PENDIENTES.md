# Pendientes para Produccion

Documento de seguimiento de tareas pendientes para llevar ESIgg.lol a produccion completa.

---

## Critico — Antes de cualquier despliegue

### Seguridad de credenciales
- [ ] Rotar todas las API keys (Riot, Anthropic) y generar nuevos secrets
- [ ] Generar `SESSION_SECRET` con un valor criptograficamente seguro (no UUID simple)
- [ ] Usar un gestor de secretos (Vault, AWS Secrets Manager, o similar) en lugar de `.env.local`
- [ ] Asegurar que `.env.local` nunca se commitea (ya esta en `.gitignore`, verificar)

### Hasheo de password de admin
- [x] Implementar hashing con bcrypt para `ADMIN_PASSWORD_HASH` (bcryptjs, cost 12)
- [x] Comparacion via `bcrypt.compare()` en `app/api/admin/login/route.ts`
- [ ] Exigir password de minimo 12 caracteres en produccion

### Tournament API: migrar de stub a produccion
- [ ] Solicitar a Riot acceso a la API de tournament-v5 (produccion)
- [ ] Cambiar `tournament-stub-v5` por `tournament/v5` en `lib/tournament.ts`
- [ ] Usar env var (`TOURNAMENT_API_MODE=stub|production`) para alternar entre ambos
- [ ] Obtener API key de produccion con rate limits adecuados

### API key de Riot en produccion
- [ ] Solicitar API key de produccion a Riot (las dev key expiran cada 24h)
- [ ] Ajustar delays de batch en `app/api/riot/refresh-stats/route.ts` para rate limits de produccion
- [ ] El script `collect-stats-prod.ts` ya maneja mayor concurrencia, validar que funciona

---

## Alta prioridad — Primera semana

### Infraestructura de despliegue
- [ ] Crear Dockerfile para el proyecto
- [ ] Configurar CI/CD (GitHub Actions) con lint + build
- [ ] Documentar proceso de despliegue
- [ ] Configurar health check endpoint (`/api/health`)

### Base de datos
- [ ] Implementar sistema de migraciones (versionado de schema)
- [x] Crear indices en tablas frecuentemente consultadas (en `lib/db.ts` initSchema):
  - `matches.phase_id`
  - `player_match_history.summoner_name`
  - `player_champion_mastery.summoner_name`
- [ ] Configurar backups automaticos del SQLite (cron + copia a storage externo)
- [ ] Evaluar si SQLite es suficiente para el volumen esperado o migrar a PostgreSQL
- [ ] Programar checkpoints de WAL periodicos

### Estado en memoria
- [ ] `isRunning` en refresh-stats y `attempts` en login son single-process
- [ ] Si se despliega con multiples replicas, usar Redis para:
  - Coordinacion de jobs en background
  - Rate limiting distribuido
  - Cache de Riot API (actualmente in-memory con 10min TTL)

### Cabeceras de seguridad
- [x] Anadir `Content-Security-Policy` en `proxy.ts`
- [x] Anadir `Strict-Transport-Security` (HSTS, solo produccion)
- [x] CSRF: protegido via SameSite=lax + JSON Content-Type + JWT (no requiere tokens dedicados)
- [x] Anadir `Permissions-Policy` en `proxy.ts`
- [x] Extender cabeceras a todas las rutas (no solo /admin)

---

## Media prioridad — Semanas 2-3

### Logging y observabilidad
- [ ] Implementar logging estructurado (pino o winston)
- [ ] Integrar error tracking (Sentry)
- [ ] Anadir metricas de requests y tiempos de respuesta
- [ ] Eliminar `catch(() => {})` silenciosos (ej: `refresh-stats/route.ts`)

### Testing
- [x] Configurar framework de tests (Vitest)
- [x] Tests unitarios para logica de bracket (`lib/bracket.ts`) — 12 tests cubriendo elimination, final-four, upper-lower
- [ ] Tests E2E para flujos criticos (generacion de bracket, actualizacion de resultados)
- [ ] Lint en pre-commit hook (husky + lint-staged)

### Cache y rendimiento
- [x] Anadir cache headers HTTP (Cache-Control) en rutas publicas `/api/data/*` y `/api/riot/*`
- [ ] Evaluar ISR (Incremental Static Regeneration) para paginas publicas
- [ ] Cachear `getTeams()` / `getPhases()` a nivel servidor para evitar deserializar JSON en cada request

### Riot API robustez
- [ ] Anadir timeout a las llamadas fetch de `lib/riot.ts` (actualmente sin limite)
- [ ] Manejar errores 429 (rate limit) con retry + backoff exponencial
- [ ] Persistir cache de Riot API en Redis/SQLite para sobrevivir reinicios

### Integracion Anthropic (screenshot parsing)
- [ ] Configurar `ANTHROPIC_API_KEY` en produccion
- [ ] Anadir fallback si la key no esta configurada (deshabilitar boton en UI)
- [ ] Cachear resultados parseados para evitar costes duplicados
- [ ] Documentar coste estimado por screenshot

---

## Baja prioridad — Mejoras continuas

### SEO y accesibilidad
- [ ] Crear `robots.txt` y `sitemap.xml`
- [ ] Anadir Open Graph tags por pagina (titulos dinamicos, imagenes)
- [ ] Anadir meta descriptions en paginas publicas
- [ ] Auditar contraste de colores (dark theme)
- [ ] Anadir ARIA labels en elementos interactivos
- [ ] Anadir alt text a iconos de campeon (DDragon)

### UX y funcionalidad
- [ ] Shutdown graceful: manejar SIGTERM para esperar jobs en curso
- [ ] Validar que los tournament codes no hayan expirado antes de mostrarlos
- [ ] Permitir re-generar tournament codes si los anteriores expiran
- [ ] Opcion de restringir tournament codes a PUUIDs de los jugadores del partido
- [ ] Notificaciones en tiempo real cuando Riot envia callback de resultado

### Calidad de codigo
- [ ] Reducir uso de `any` en `lib/data.ts` (player stats cache)
- [ ] Extraer constantes magicas a configuracion (delays, batch sizes, TTLs)
- [ ] Revisar y limpiar scripts en `scripts/` (documentar uso de cada uno)

---

## Funcionalidades incompletas o a revisar

### Tournament config — sin opcion de reset
- [ ] Una vez registrado provider/tournament no hay forma de reconfigurarlo desde la UI
- [ ] Anadir endpoint `DELETE /api/admin/tournament` para resetear y boton en dashboard
- [ ] Mostrar la callback URL registrada en el panel de estado

### Tournament codes — ciclo de vida incompleto
- [ ] No se trackea la expiracion de los codes (Riot los expira)
- [ ] No hay forma de regenerar codes si expiran o se invalidan
- [ ] Los lobby events se consultan pero no se muestran de forma clara (solo contador)
- [ ] No hay visibilidad publica de los codes (solo admin); evaluar si los jugadores deberian verlos

### Boton de borrar partido individual oculto
- [ ] En `app/admin/partidos/page.tsx` hay un boton de borrar por partido con clase `hidden`
- [ ] Solo se puede borrar mediante seleccion multiple; decidir si exponer el boton individual

### Programacion de partidos (`scheduledAt`)
- [ ] No se valida que la fecha sea futura
- [ ] No hay conversion/indicacion de timezone para el usuario
- [ ] No existe sistema de recordatorios o notificaciones de proximos partidos
- [ ] No se ordena por fecha programada en la vista publica

### DDragon — sincronizacion manual
- [ ] `scripts/sync-ddragon.ts` debe ejecutarse manualmente para actualizar la version
- [ ] Si la version queda desactualizada, las URLs de iconos de campeon/item se rompen
- [ ] Automatizar con cron o check al arrancar la app

### Scripts sin automatizar
- [ ] `scripts/collect-stats-dev.ts` y `collect-stats-prod.ts` — recoleccion manual de stats
- [ ] `scripts/test-riot-api.ts` — test de conectividad manual
- [ ] Ninguno se ejecuta en CI ni como cron; documentar cuando y como usarlos

### Refresh de stats de jugadores
- [ ] Solo hay refresh masivo (boton global en ranking); no se puede refrescar un jugador individual
- [ ] Si falla un jugador, se muestra warning pero no hay retry
- [ ] El flag `isRunning` es in-memory; si el server se reinicia durante un refresh, queda en estado inconsistente

### Twitch embed — limitacion por IP
- [ ] `TwitchEmbed.tsx` devuelve null si se accede por IP directa (sin dominio)
- [ ] No hay fallback ni enlace alternativo al canal de Twitch
- [ ] En desarrollo local con IP siempre se ve "stream no disponible"

### Comparador de equipos (`/comparar`)
- [ ] Revisar que se muestran todas las stats disponibles (mastery, historial reciente)
- [ ] Los datos de `data-riot.ts` (mastery/historial) solo se usan en paginas de equipo, no en comparacion

### Datos de partida: prioridad screenshot vs Riot API
- [ ] Los datos de screenshot parseados tienen prioridad sobre los de Riot API
- [ ] Si un screenshot se parsea mal, no hay forma de corregirlo desde la UI sin borrar el game data
- [ ] No hay validacion cruzada entre datos de screenshot y datos reales de Riot

### Bracket — edge cases sin tests
- [ ] Logica de avance en `lib/bracket.ts` no tiene tests automatizados
- [ ] Posibles edge cases en:
  - Brackets elimination con numero impar de equipos
  - Rondas suizas con empates o walkovers
  - Upper/lower bracket con grand final reset
- [ ] Generacion de brackets en `app/api/admin/fases/generate/route.ts` tampoco testeada

### Paginas de equipo (`/equipos/[id]`)
- [ ] Datos de mastery y historial reciente se cargan desde `data-riot.ts`
- [ ] Si la API de Riot falla, la pagina puede quedarse sin datos sin indicacion clara al usuario

### Ranking publico
- [ ] Stats pueden estar desactualizadas si no se ejecuta refresh periodicamente
- [ ] No se muestra la fecha de ultima actualizacion de los datos

---

## Estado actual — Que ya funciona bien

- Autenticacion JWT con cookies HttpOnly y expiracion de 12h
- Validacion de input con Zod en todas las API routes
- Rate limiting en login (por IP)
- Cabeceras basicas de seguridad (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- TypeScript en modo estricto
- Soporte completo para 5 formatos de torneo (groups, swiss, elimination, final-four, upper-lower)
- Avance automatico de brackets al reportar resultados
- Sincronizacion de assets DDragon
- Integracion Riot API con cache in-memory
- Tournament codes (modo stub) con generacion desde admin y callback preparado
- Tema oscuro consistente en toda la app
