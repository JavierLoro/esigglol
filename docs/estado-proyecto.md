# Estado del proyecto — ESIgg.lol

Análisis del estado actual a 29 de marzo de 2026.

---

## Qué funciona bien

### Core del torneo
- Soporte completo para los 5 formatos: `groups`, `swiss`, `elimination`, `final-four`, `upper-lower`
- Generación automática de brackets y partidos
- Avance automático de brackets al reportar resultados (`lib/bracket.ts`, 12 tests Vitest)
- Visualización pública de fases, brackets y resultados
- Sistema de confirmación de rondas/brackets (swiss y eliminaciones)

### Autenticación y seguridad
- JWT en cookie HttpOnly con expiración 12h
- bcrypt (coste 12) para la contraseña de admin
- Rate limiting en login por IP
- Cabeceras de seguridad: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- TypeScript strict en toda la base de código
- Validación de input con Zod en todos los API routes

### Integración con Riot API
- Caché in-memory con TTL 10 min para reducir llamadas
- Soporte a formatos `Name#TAG` (Riot ID)
- Colección de maestría de campeones e historial de partidas clasificatorias
- API key configurable en runtime desde el panel de admin (sin reiniciar el servidor)
- Proxy estable con reintentos básicos en 429

### Infraestructura
- Docker con multi-stage build (Node 22 Alpine, standalone)
- CI/CD con GitHub Actions: lint → test → build → push a GHCR
- Watchtower para auto-actualización en producción
- Health check endpoint (`/api/health`)
- Métricas Prometheus (`/api/metrics`)
- Logging estructurado con Pino

### UI
- Tema oscuro consistente con design tokens (`--esi-blue`, `--esi-red`)
- Admin panel responsivo (sidebar desktop + bottom nav móvil)
- Parseo de screenshots de fin de partida con Claude Vision
- Comparador de equipos público
- Tabla de ranking público
- Embed de Twitch en página principal
- Sincronización automática de assets DDragon

---

## Deuda técnica y gaps conocidos

### Alta prioridad

**Sin sistema de migraciones de DB**
El schema se crea con `CREATE TABLE IF NOT EXISTS` en `lib/db.ts`. No hay control de versiones ni forma de aplicar cambios al schema sin reiniciar desde cero.

**Sin backups automáticos**
La DB SQLite vive en un volumen Docker. No hay mecanismo de backup periódico. Una corrupción o pérdida del volumen significaría perder todos los datos del torneo.

**`isRunning` inconsistente tras reinicio**
El flag `isRunning` de refresh-stats es in-memory. Si el servidor se reinicia durante un refresh, queda atascado en `true` indefinidamente hasta que se reinicie de nuevo.

### Prioridad media

**Sin timeout en `lib/riot.ts`**
Las llamadas `fetch` a la API de Riot no tienen límite de tiempo. Una respuesta lenta puede colgar el request indefinidamente.

**Retry básico en 429**
`riotFetch()` reintenta hasta 3 veces en 429 con el `Retry-After` de la respuesta. Funciona, pero no implementa backoff exponencial ni jitter.

**Refresh individual de jugador**
Solo existe refresh masivo (botón global en `/ranking`). No se puede refrescar un solo jugador desde la UI.

**Fallback en UI para `ANTHROPIC_API_KEY`**
El botón de parsear screenshot no se desactiva si la key no está configurada. El usuario recibe error solo al intentarlo.

**Datos de screenshot sin corrección**
Si un screenshot se parsea mal, no hay forma de corregirlo desde la UI sin borrar el `games[]` del partido.

### Prioridad baja

**Sin reset de tournament config**
Una vez registrado un provider/tournament en Riot, no hay forma de reconfigurarlo desde la UI.

**Sin indicación de timezone en `scheduledAt`**
Las fechas programadas se muestran sin referencia de zona horaria.

**Sin tests E2E**
Hay tests unitarios de `bracket.ts` (12 casos con Vitest), pero no hay tests de integración para flujos completos como generación de bracket + actualización de resultados.

**Tournament API en modo stub**
`lib/tournament.ts` usa `tournament-stub-v5`. Para producción real se necesita acceso a `tournament/v5` y una API key de producción.

---

## Pendientes antes de producción completa

Estos puntos bloquean o degradan significativamente la experiencia en producción:

1. **Riot API key de producción** — las dev keys expiran cada 24h
2. **Migrar Tournament API de stub a v5 real** — los códigos stub no funcionan en partidas reales
3. **Sistema de migraciones de DB** — necesario para evolucionar el schema de forma segura
4. **Backups del SQLite** — prevenir pérdida de datos irrecuperable
5. **Rotar secretos** (`SESSION_SECRET`, API keys) antes del primer despliegue público

---

## Métricas de código

| Aspecto | Estado |
|---|---|
| TypeScript strict | Activado, sin `any` explícitos salvo en migration shim de `lib/data.ts` |
| Tests | 12 tests unitarios (bracket logic) |
| Cobertura E2E | 0% |
| Lint | ESLint v9 flat config, sin errores en CI |
| Build | Pasa en CI (Node 22, npm ci) |
| Docker | Multi-stage, imagen Alpine, standalone output |

---

## Prioridades sugeridas (siguientes sprints)

1. Sistema de migraciones de DB (`#` ver issue)
2. Backups automáticos de SQLite
3. Timeout en llamadas fetch de Riot
4. Fallback en UI cuando `ANTHROPIC_API_KEY` falta
5. Refresh individual de jugador
6. Reset de tournament config desde UI
