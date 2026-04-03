<div align="center">

# ESIgg.lol

**League of Legends Tournament Manager for ESIUCLM**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)
[![CI](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml)

</div>

---

## Overview

ESIgg.lol is a private League of Legends tournament platform for ESIUCLM. It provides a public-facing site for spectators and a password-protected admin panel for tournament management.

### Public site
- Tournament phases and brackets (groups, Swiss, single/double elimination)
- Player rankings and stats
- Team detail pages and head-to-head comparison
- Match results and history
- Live Twitch stream embed

### Admin panel (`/admin`)
- Team, phase, and match management (with logo upload)
- Automatic bracket generation
- Match screenshot parsing via Claude Vision
- Riot Tournament API integration (tournament codes, lobby events)
- Player stats collection from Riot API
- Runtime Riot API key management (no restart needed)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TailwindCSS v4, lucide-react |
| Language | TypeScript 5 (strict) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | JWT (jose), bcryptjs |
| Validation | Zod v4 |
| Logging | Pino + pino-pretty |
| Metrics | Prometheus — `prom-client` |
| AI | Anthropic SDK (screenshot parsing) |
| Testing | Vitest |

---

## Local Setup

### Docker (recommended — identical to production)

**Requirements:** Docker Desktop

```bash
# Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local: set SESSION_SECRET and ADMIN_PASSWORD_HASH

# Generate admin password hash
npx tsx scripts/gen-password-hash.ts <your-password>

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Build and start (same image as production)
docker compose -f docker-compose.dev.yml up --build
```

App available at `http://localhost:3000`. After code changes, re-run `up --build`.

### Without Docker (fast iteration with HMR)

**Requirements:** Node.js 22+, npm

```bash
npm install
cp .env.example .env.local
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | Yes | bcrypt hash of the admin password |
| `SESSION_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `RIOT_API_KEY` | No | Riot Games API key (can also be set from admin panel) |
| `RIOT_REGION` | No | Riot API region (default: `euw1`) |
| `TWITCH_CHANNEL` | No | Twitch channel name for embed |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (enables screenshot parsing) |
| `DB_PATH` | No | SQLite database path (default: `./data/esigglol.db`) |
| `REFRESH_AUTO_INTERVAL_MS` | No | Min age for auto refresh in ms (default: `21600000`) |
| `REFRESH_BATCH_SIZE` | No | Players processed per refresh batch (default: `3`) |
| `REFRESH_BATCH_DELAY_MS` | No | Delay between refresh batches in ms (default: `30000`) |

> **Note:** The Riot API key can be configured at runtime from the admin dashboard — no server restart needed when the dev key expires.

> **Note:** `ADMIN_PASSWORD_HASH` contains `$` characters. Always wrap the value in single quotes in `.env.local` to prevent shell variable expansion:
> ```
> ADMIN_PASSWORD_HASH='$2b$12$...'
> ```

---

## Docker

| File | Purpose |
|---|---|
| `docker-compose.yml` | Production — pulls image from GHCR + Watchtower auto-updates |
| `docker-compose.dev.yml` | Dev — builds image locally, no Watchtower |

```bash
# Dev (local machine)
docker compose -f docker-compose.dev.yml up --build

# Production
docker compose up -d

# View logs
docker logs esigglol-app-1 -f

# Check status
docker compose ps
```

The SQLite database is persisted in `./data/` via a volume mount. The container runs as user `1000`. Ensure the database files are writable:

```bash
chmod 666 data/esigglol.db data/esigglol.db-shm data/esigglol.db-wal
```

**Watchtower** polls the registry every 60 seconds and automatically redeploys when a new image is available.

---

## Changing the Admin Password

```bash
npx tsx scripts/gen-password-hash.ts <new-password>
# Update ADMIN_PASSWORD_HASH in .env.local (single quotes)
docker compose restart app
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (syncs DDragon assets first) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run prepare` | Install Git hooks (Husky) |
| `npm run sync-ddragon` | Manually sync Data Dragon assets |
| `npm run collect-stats-dev` | Collect player stats (dev key, rate-limited) |
| `npm run collect-stats-prod` | Collect player stats (production key) |
| `npx tsx scripts/seed-data.ts` | Seed placeholder teams and players into the database |

> Pre-commit runs `lint-staged`, which executes ESLint with `--fix` only on staged JS/TS files.

### Seeding placeholder data

Populates the database with placeholder teams and players for development and testing. Always **adds** without touching existing data.

```bash
npx tsx scripts/seed-data.ts              # 8 teams × 5 starters + 1 sub
npx tsx scripts/seed-data.ts --teams 4    # custom team count
npx tsx scripts/seed-data.ts --players 5  # custom starters per team (max 5 with current pool)
```

---

## CI/CD

Pushing to `main` triggers GitHub Actions:

1. **CI** — lint + test + build
2. **Docker** — build and push image to `ghcr.io/javierloro/esigglol:latest`
3. **Watchtower** — detects the new image within ~60s and redeploys automatically

---

---

<div align="center">

# ESIgg.lol — Español

**Gestor de torneos de League of Legends para ESIUCLM**

</div>

---

## Descripcion

ESIgg.lol es una plataforma privada de torneos de League of Legends para ESIUCLM. Incluye un sitio publico para los espectadores y un panel de administracion protegido por contrasena.

### Sitio publico
- Fases y brackets del torneo (grupos, suizo, eliminacion simple y doble)
- Ranking y estadisticas de jugadores
- Paginas de equipo y comparador
- Resultados e historial de partidos
- Embed del directo de Twitch

### Panel de administracion (`/admin`)
- Gestion de equipos, fases y partidos (con subida de logos)
- Generacion automatica de brackets
- Parseo de screenshots de partidos via Claude Vision
- Integracion con Riot Tournament API (codigos de torneo, lobby events)
- Recoleccion de stats de jugadores desde la API de Riot
- Gestion de la API key de Riot en tiempo real (sin reinicio)

---

## Tech Stack

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TailwindCSS v4, lucide-react |
| Lenguaje | TypeScript 5 (strict) |
| Base de datos | SQLite via better-sqlite3 (modo WAL) |
| Auth | JWT (jose), bcryptjs |
| Validacion | Zod v4 |
| Logging | Pino + pino-pretty |
| Metricas | Prometheus — `prom-client` |
| IA | Anthropic SDK (parseo de screenshots) |
| Testing | Vitest |

---

## Setup local

### Docker (recomendado — identico a produccion)

**Requisitos:** Docker Desktop

```bash
# Copiar variables de entorno y rellenar valores
cp .env.example .env.local
# Editar .env.local: rellenar SESSION_SECRET y ADMIN_PASSWORD_HASH

# Generar hash de password para admin
npx tsx scripts/gen-password-hash.ts <tu-password>

# Generar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Construir y arrancar (misma imagen que produccion)
docker compose -f docker-compose.dev.yml up --build
```

La app estara disponible en `http://localhost:3000`. Tras cambios de codigo, volver a ejecutar `up --build`.

### Sin Docker (iteracion rapida con HMR)

**Requisitos:** Node.js 22+, npm

```bash
npm install
cp .env.example .env.local
npm run dev
```

---

## Variables de entorno

| Variable | Requerida | Descripcion |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | Si | Hash bcrypt del password de admin |
| `SESSION_SECRET` | Si | Secreto para firmar JWT (min 32 chars) |
| `RIOT_API_KEY` | No | API key de Riot Games (tambien configurable desde el panel admin) |
| `RIOT_REGION` | No | Region de Riot API (default: `euw1`) |
| `TWITCH_CHANNEL` | No | Canal de Twitch para el embed |
| `ANTHROPIC_API_KEY` | No | API key de Anthropic (habilita parseo de screenshots) |
| `DB_PATH` | No | Ruta de la BD SQLite (default: `./data/esigglol.db`) |
| `REFRESH_AUTO_INTERVAL_MS` | No | Edad mínima (ms) para auto refresh (default: `21600000`) |
| `REFRESH_BATCH_SIZE` | No | Jugadores procesados por batch de refresh (default: `3`) |
| `REFRESH_BATCH_DELAY_MS` | No | Delay entre batches de refresh en ms (default: `30000`) |

> **Nota:** La API key de Riot se puede configurar en tiempo real desde el panel admin — no requiere reiniciar el servidor cuando la dev key expira.

> **Importante:** `ADMIN_PASSWORD_HASH` contiene caracteres `$`. En `.env.local` envuelve el valor entre comillas simples para evitar expansion de variables:
> ```
> ADMIN_PASSWORD_HASH='$2b$12$...'
> ```

---

## Docker

| Archivo | Uso |
|---|---|
| `docker-compose.yml` | Produccion — tira imagen de GHCR + Watchtower auto-actualizacion |
| `docker-compose.dev.yml` | Dev — construye imagen local, sin Watchtower |

```bash
# Dev (maquina local)
docker compose -f docker-compose.dev.yml up --build

# Produccion
docker compose up -d

# Ver logs
docker logs esigglol-app-1 -f

# Ver estado
docker compose ps
```

La base de datos SQLite se persiste en `./data/` mediante un volumen. El contenedor corre como usuario `1000`. Los archivos de la BD deben tener permisos de escritura:

```bash
chmod 666 data/esigglol.db data/esigglol.db-shm data/esigglol.db-wal
```

**Watchtower** comprueba cada 60 segundos si hay una nueva imagen en el registry y redespliega automaticamente.

---

## Cambiar la contrasena de admin

```bash
npx tsx scripts/gen-password-hash.ts <nueva-password>
# Actualizar ADMIN_PASSWORD_HASH en .env.local (entre comillas simples)
docker compose restart app
```

---

## Scripts disponibles

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo (sincroniza DDragon primero) |
| `npm run build` | Build de produccion |
| `npm run start` | Iniciar servidor de produccion |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Ejecutar tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run prepare` | Instalar hooks de Git (Husky) |
| `npm run sync-ddragon` | Sincronizar assets de Data Dragon manualmente |
| `npm run collect-stats-dev` | Recolectar stats de jugadores (dev key, con delays) |
| `npm run collect-stats-prod` | Recolectar stats de jugadores (prod key) |
| `npx tsx scripts/seed-data.ts` | Poblar la BD con equipos y jugadores placeholder |

> El pre-commit ejecuta `lint-staged`, que lanza ESLint con `--fix` solo sobre archivos JS/TS staged.

### Generar datos de prueba (seed)

Puebla la base de datos con equipos y jugadores ficticios para desarrollo. **Siempre añade** sin tocar los datos existentes.

```bash
npx tsx scripts/seed-data.ts              # 8 equipos × 5 titulares + 1 suplente
npx tsx scripts/seed-data.ts --teams 4    # numero de equipos personalizado
npx tsx scripts/seed-data.ts --players 5  # titulares por equipo personalizado (máx 5 con el pool actual)
```

---

## CI/CD

Push a `main` dispara GitHub Actions:

1. **CI** — lint + test + build
2. **Docker** — build y push de imagen a `ghcr.io/javierloro/esigglol:latest`
3. **Watchtower** — detecta la nueva imagen en ~60s y redespliega el contenedor automaticamente
