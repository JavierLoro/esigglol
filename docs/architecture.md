# Arquitectura de ESIgg.lol

## Capas de la aplicación

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  React Client Components (interactividad: botones, forms, polling) │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼─────────────────────────────────────┐
│  Next.js App Router (Node.js)                                       │
│                                                                     │
│  proxy.ts (Middleware)                                              │
│  ├── Autenticación JWT (/admin/* excepto /admin/login)              │
│  ├── Cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.)      │
│  └── Métricas Prometheus (httpRequestDuration, httpRequestsTotal)   │
│                                                                     │
│  Server Components / Route Handlers                                 │
│  ├── app/                 → páginas públicas + admin panel          │
│  └── app/api/             → API REST                                │
│      ├── admin/           → CRUD protegido (JWT)                    │
│      ├── data/            → lectura pública (equipos, fases)        │
│      ├── riot/            → proxy Riot API (con caché)              │
│      ├── tournament/      → webhook Riot Tournament                 │
│      ├── health/          → health check                            │
│      └── metrics/         → endpoint Prometheus                     │
│                                                                     │
│  lib/                     → lógica de negocio y acceso a datos      │
│  ├── auth.ts              → JWT sessions                            │
│  ├── data.ts              → SQLite (equipos, fases, partidos)       │
│  ├── data-riot.ts         → SQLite (mastery, historial, stats)      │
│  ├── riot.ts              → cliente Riot API + caché in-memory      │
│  ├── tournament.ts        → Riot Tournament API v5 wrapper          │
│  ├── bracket.ts           → lógica de avance de bracket             │
│  ├── screenshot-parser.ts → Claude Vision para parsear screenshots  │
│  ├── logger.ts            → Pino structured logger                  │
│  └── metrics.ts           → Prometheus client                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  SQLite (better-sqlite3, WAL mode)                                  │
│  Archivo: ./data/esigglol.db                                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  APIs externas                                                      │
│  ├── Riot Games API (summoner, league, mastery, match, tournament)  │
│  ├── Anthropic Claude API (screenshot parsing / Vision)             │
│  └── Twitch embed (iframe)                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flujo de datos principal

### Lectura pública (páginas de fases/equipos)

```
Browser
  └─→ Server Component (app/fases/page.tsx)
        └─→ lib/data.ts → getPhases() + getMatches()
              └─→ SQLite: SELECT data FROM phases / matches
```

### Actualización de resultados (admin)

```
Admin Browser
  └─→ PATCH /api/admin/partidos
        ├─→ requireAdminSession() → verifica JWT cookie
        ├─→ Zod validation (lib/schemas.ts)
        ├─→ lib/data.ts → saveMatch()
        └─→ lib/bracket.ts → advanceWinner()
              └─→ lib/data.ts → saveMatch() para cada partido afectado
```

### Refresh de stats de jugadores

```
Admin click "Refrescar"
  └─→ POST /api/riot/refresh-stats
        └─→ Background loop (cada 5 jugadores, 20s delay):
              └─→ lib/riot.ts → getPlayerStats() [con caché 10min]
                    └─→ Riot API (account-v1, summoner-v4, league-v4)
              └─→ lib/data.ts → savePlayerStatsCache()

Browser polling (cada 3s)
  └─→ GET /api/riot/refresh-stats → estado actual (isRunning, progress)
```

### Parseo de screenshot

```
Admin sube imagen
  └─→ POST /api/admin/partidos/parse-screenshot
        └─→ lib/screenshot-parser.ts
              └─→ Anthropic Claude API (claude-3-5-sonnet, Vision)
              └─→ Zod validation del JSON devuelto
        └─→ lib/data.ts → saveMatch() con games[]
```

---

## Decisiones de diseño

### SQLite como base de datos
- Volumen esperado pequeño (torneo privado, decenas de equipos/partidos)
- Sin necesidad de escalado horizontal
- Deployment simplificado: un solo binario, sin servidor de DB externo
- WAL mode habilitado para mejor concurrencia lectores/escritor
- Datos almacenados como JSON blob (columna `data`) + columnas de índice necesarias

### JWT en cookie HttpOnly
- Autenticación stateless, no requiere almacenamiento de sesiones
- HttpOnly + SameSite=lax previene XSS y CSRF
- Expiración de 12h; `SESSION_SECRET` obligatorio al arrancar

### Middleware en `proxy.ts` (no `middleware.ts`)
- Nombre intencional para diferenciar del middleware estándar de Next.js
- Exporta named function `proxy` + `config` matcher
- Centraliza auth, security headers y métricas

### Caché in-memory para Riot API
- TTL de 10 minutos, limpieza por acceso (lazy eviction)
- No sobrevive reinicios del servidor
- Suficiente para el uso esperado (no hay tráfico concurrente alto)

### Validación con Zod
- Todos los API routes validan input en `lib/schemas.ts`
- TypeScript strict + Zod = doble capa de seguridad de tipos

### Formato de IDs
- `generateId(prefix)` → `"prefix-<timestamp>-<random5chars>"`
- Colisiones prácticamente imposibles a este volumen
- Legibles/debuggeables (se ve el tipo de entidad en el ID)
