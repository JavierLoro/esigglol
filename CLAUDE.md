# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# ESIgg.lol — Codebase Guide

## Project Overview

**ESIgg.lol** is a private League of Legends tournament manager for ESIUCLM. It has two main areas:

- **Public site** — view tournament phases/brackets, player rankings, match results, team detail pages, team comparison, Twitch stream embed
- **Admin panel** (`/admin/*`) — manage teams, phases, matches, generate brackets, parse screenshots, manage tournament codes; password-protected

External integrations: Riot Games API (player stats, Tournament API), Twitch (stream embed), Anthropic Claude (screenshot parsing).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| UI | React 19.2.4 |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS v4 |
| Auth | JWT via `jose` (v6), `bcryptjs` for password hashing |
| Validation | `zod` (v4) |
| Database | `better-sqlite3` (WAL mode) |
| Logging | `pino` + `pino-pretty` (dev) |
| Metrics | `prom-client` (Prometheus) |
| AI | `@anthropic-ai/sdk` (screenshot parsing) |
| Dates | `date-fns`, `react-day-picker` |
| Icons | `lucide-react` |
| Class utils | `clsx` |
| Testing | `vitest` (v4) |

> **Next.js 16 has breaking changes.** Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. The `01-app/` subdirectory covers the App Router. Heed all deprecation notices.

---

## Directory Structure

```
/
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout (Navbar, Geist font, dark bg, legal disclaimer footer)
│   ├── page.tsx                    # Home: Twitch embed + upcoming/completed matches
│   ├── ranking/                    # Public player ranking table
│   ├── fases/                      # Public tournament phases/brackets
│   ├── comparar/                   # Public team comparison tool
│   ├── equipos/[id]/               # Public team detail page
│   ├── partidos/[id]/              # Public match detail page
│   ├── admin/                      # Admin panel (JWT-protected)
│   │   ├── layout.tsx              # Admin layout: sidebar (desktop) + bottom nav (mobile)
│   │   ├── page.tsx                # Dashboard with stats + API key settings + tournament setup
│   │   ├── login/                  # Login page (unprotected)
│   │   ├── equipos/                # Team management
│   │   ├── fases/                  # Phase management
│   │   └── partidos/               # Match management (scores, screenshots, codes)
│   ├── api/
│   │   ├── admin/                  # Protected CRUD routes
│   │   │   ├── login/              # Session create/destroy
│   │   │   ├── equipos/            # Team CRUD
│   │   │   ├── fases/              # Phase CRUD + generate/
│   │   │   ├── partidos/           # Match CRUD + codes/ + lobby/ + parse-screenshot/
│   │   │   ├── settings/           # Admin settings (Riot API key management)
│   │   │   └── tournament/         # Tournament API setup
│   │   ├── data/                   # Public read-only routes (equipos, fases)
│   │   ├── riot/                   # Riot API proxy (summoner, matches, refresh-stats)
│   │   ├── uploads/[filename]/     # Public file serving for uploaded assets (logos)
│   │   ├── tournament/callback/    # Tournament API webhook receiver
│   │   ├── health/                 # Health check endpoint
│   │   └── metrics/                # Prometheus metrics endpoint
│   └── globals.css                 # TailwindCSS v4 import + CSS variables + scrollbar
│
├── components/
│   ├── Navbar.tsx
│   ├── MatchCard.tsx
│   ├── TwitchEmbed.tsx
│   ├── RefreshStatsButton.tsx
│   ├── PlayerRankingTable.tsx
│   ├── CompareClient.tsx
│   ├── ChampionBubbles.tsx         # Champion stat bubbles with tooltips
│   ├── admin/
│   │   ├── LogoutButton.tsx
│   │   ├── DateTimePicker.tsx       # Calendar + time input (react-day-picker)
│   │   ├── TournamentSetup.tsx      # Riot Tournament API registration UI
│   │   └── RiotApiKeySettings.tsx   # Runtime Riot API key management
│   └── brackets/
│       ├── GroupsView.tsx
│       ├── SwissView.tsx
│       ├── EliminationBracket.tsx
│       └── UpperLowerBracket.tsx
│
├── lib/
│   ├── types.ts                    # All shared TypeScript types
│   ├── schemas.ts                  # Zod validation schemas for API input
│   ├── env.ts                      # Centralized env var access + path constants (DATA_DIR, UPLOADS_DIR)
│   ├── data.ts                     # SQLite persistence layer (teams, phases, matches)
│   ├── data-riot.ts                # Riot data persistence (mastery, match history, stats)
│   ├── db.ts                       # better-sqlite3 connection singleton (WAL mode)
│   ├── auth.ts                     # JWT session helpers + requireAdminSession()
│   ├── bracket.ts                  # Bracket advancement logic
│   ├── ddragon.ts                  # DDragon asset sync utilities
│   ├── riot.ts                     # Riot API client with in-memory cache
│   ├── tournament.ts               # Riot Tournament API v5 wrapper
│   ├── screenshot-parser.ts        # Claude Vision integration for match screenshots
│   ├── logger.ts                   # Pino structured logger
│   ├── metrics.ts                  # Prometheus metrics (request duration, count)
│   └── __tests__/
│       └── bracket.test.ts         # Vitest tests for bracket advancement
│
├── scripts/
│   ├── gen-password-hash.ts        # Generate bcrypt hash for admin password
│   ├── sync-ddragon.ts             # Fetch/cache DDragon champion data (runs on predev/prebuild)
│   ├── load-env.ts                 # Environment variable loader utility
│   ├── test-riot-api.ts            # Test Riot API connectivity
│   ├── collect-stats-dev.ts        # Batch player stats collection (dev, lower concurrency)
│   └── collect-stats-prod.ts       # Batch player stats collection (prod, higher concurrency)
│
├── data/                           # Runtime data (persisted via Docker volume)
│   ├── esigglol.db                 # SQLite database (not committed)
│   ├── ddragon-version.txt         # Cached DDragon version string
│   └── uploads/                    # Uploaded files (team logos)
│
├── .github/workflows/ci.yml       # CI/CD: lint, test, build, Docker push to GHCR
├── Dockerfile                      # Multi-stage build (Node 22 Alpine, standalone)
├── docker-compose.yml              # App + Watchtower auto-update
├── proxy.ts                        # Next.js middleware (named export, not middleware.ts)
├── public/                         # Static assets (logos, images)
└── next.config.ts
```

---

## Data Layer

All persistence is **SQLite** via `better-sqlite3`. The database file defaults to `./data/esigglol.db` (configurable via `DB_PATH` env var).

### Core tables (lib/db.ts)

| Table | Purpose |
|---|---|
| `teams` | Team data (id, JSON blob) |
| `phases` | Phase data with ordering (id, order, JSON blob) |
| `matches` | Match data linked to phases (id, phase_id, JSON blob) |
| `player_stats` | Cached aggregated player stats |
| `player_champion_mastery` | Per-player champion mastery data |
| `player_match_history` | Per-player match history (KDA, champion, win/loss) |
| `tournament_config` | Riot Tournament API config + runtime settings (API keys) |

Indexes exist on `matches(phase_id)`, `player_match_history(summoner_name)`, `player_champion_mastery(summoner_name)`.

### Data access modules

- `lib/data.ts` — Core tournament data: `getTeams()`, `saveTeams()`, `getTeamById()`, `getPhases()`, `savePhases()`, `savePhase()`, `getPhaseById()`, `getMatches()`, `saveMatches()`, `saveMatch()`, `getMatchesByPhase()`, `deleteMatches()`, `getPlayerStatsCache()`, `savePlayerStatsCache()`, `getRiotApiKey()`, `saveRiotApiKey()`
- `lib/data-riot.ts` — Riot player data: champion mastery, match history, aggregated stats
- `lib/db.ts` — Singleton connection (WAL mode, foreign keys enabled, auto-creates schema)

**Only call data functions from Server Components or API Route handlers** — never from client components.

- ID generation: `generateId(prefix)` → `"prefix-<timestamp>-<random>"`
- Input validation for API routes is in `lib/schemas.ts` (Zod schemas)
- All env vars are accessed via `lib/env.ts` — never use `process.env` directly elsewhere

---

## Authentication

- Sessions are **JWT tokens** (12-hour expiration) stored in the `admin_session` HttpOnly cookie
- `lib/auth.ts` exports: `createSession()`, `verifySession(token)`, `getSessionFromCookies()`, `requireAdminSession()`, `COOKIE_NAME`
- **Middleware lives in `proxy.ts`** — this is intentional (not `middleware.ts`). It exports a named `proxy` function and a `config` matcher. It protects all `/admin/*` routes except `/admin/login`
- Admin API routes use `requireAdminSession()` — returns a 401 response if not authenticated, or `null` if OK
- `SESSION_SECRET` env var is **required** — the app throws at startup if missing
- Password is verified against `ADMIN_PASSWORD_HASH` env var (bcrypt hash)
- Generate hash: `npx tsx scripts/gen-password-hash.ts <password>`

> **Important:** bcrypt hashes contain `$` characters. In `.env.local`, wrap the hash in single quotes to prevent variable expansion:
> ```
> ADMIN_PASSWORD_HASH='$2b$12$...'
> ```

---

## API Routes

All route handlers are in `app/api/` using the App Router convention (`route.ts` files).

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/admin/login` | No | Create session cookie |
| `DELETE /api/admin/login` | No | Clear session cookie |
| `GET/POST/PUT/DELETE /api/admin/equipos` | Yes | Team CRUD |
| `GET/POST/PUT/DELETE /api/admin/fases` | Yes | Phase CRUD |
| `GET/POST/PUT/DELETE /api/admin/partidos` | Yes | Match CRUD |
| `POST /api/admin/fases/generate` | Yes | Generate bracket matches |
| `POST /api/admin/tournament` | Yes | Register Riot Tournament API provider/tournament |
| `POST /api/admin/partidos/codes` | Yes | Generate tournament codes for a match |
| `GET /api/admin/partidos/lobby` | Yes | Get lobby events from tournament codes |
| `POST /api/admin/partidos/parse-screenshot` | Yes | Parse match screenshot via Claude Vision |
| `GET/PUT /api/admin/settings` | Yes | Get/update Riot API key (masked in GET) |
| `POST /api/admin/equipos/upload-logo` | Yes | Upload team logo image |
| `GET /api/uploads/[filename]` | No | Serve uploaded files (logos) |
| `GET /api/data/equipos` | No | Public team list |
| `GET /api/data/fases` | No | Public phases + matches |
| `GET /api/riot/summoner?name=Nick%23TAG` | No | Summoner stats |
| `GET /api/riot/matches?id=MATCH_ID` | No | Match details |
| `POST /api/riot/refresh-stats` | No | Trigger background stats refresh |
| `GET /api/riot/refresh-stats` | No | Poll refresh status |
| `POST /api/tournament/callback` | No | Riot Tournament API webhook receiver |
| `GET /api/health` | No | Health check for load balancers |
| `GET /api/metrics` | No | Prometheus metrics export |

---

## Observability

### Logging (`lib/logger.ts`)
- **Pino** structured logger — JSON in production, pretty-printed in development
- Create child loggers with `logger.child({ module: 'name' })`

### Metrics (`lib/metrics.ts`)
- **Prometheus** via `prom-client`
- `httpRequestDuration` — histogram of request durations by method, route, status
- `httpRequestsTotal` — counter of total requests by method, route, status
- Collected in `proxy.ts` middleware for every request
- Scraped at `GET /api/metrics`

### Health check
- `GET /api/health` — used by Docker healthcheck and load balancers

---

## Deployment

### Docker
- **Dockerfile**: multi-stage build (deps → builder → runner), Node 22 Alpine, standalone Next.js output
- **docker-compose.yml**: prod — pulls `ghcr.io/javierloro/esigglol:latest` + Watchtower auto-updates
- **docker-compose.dev.yml**: dev — builds desde el `Dockerfile` local, sin watchtower (`docker-compose -f docker-compose.dev.yml up --build`)
- Image: `ghcr.io/javierloro/esigglol:latest`
- Volume: `./data:/app/data` for SQLite database + uploaded files persistence
- Env file: `.env.local` (via `env_file:`)
- Next.js image cache: `/app/.next/cache` created with `chmod 777` in Dockerfile for image optimization

### CI/CD (`.github/workflows/ci.yml`)
- Trigger: push/PR to `main`
- Jobs: lint → test → build → Docker build & push to GHCR (on push to main only)
- Node 22, npm ci, uses GHA build cache for Docker

---

## Styling Conventions

**TailwindCSS v4** — the configuration and import syntax differ from v3:

- Import in CSS: `@import "tailwindcss"` (not `@tailwind base; @tailwind components; @tailwind utilities`)
- PostCSS plugin: `@tailwindcss/postcss` (no `tailwind.config.js`)
- CSS custom properties go in `app/globals.css`; register them with `@theme inline {}` for Tailwind token access

**Design tokens:**
```css
--esi-blue: #0097D7       /* primary brand blue */
--esi-blue-light: #33b3e8
--esi-red: #B30133        /* accent red */
```

**Base theme:**
- Background: `bg-[#0a0e1a]` (dark navy)
- Dark theme throughout; no light mode
- Use `clsx` for conditional class logic

---

## TypeScript Conventions

- Strict mode is enabled — no implicit `any`, no skipping null checks
- Path alias: `@/*` maps to the project root (e.g., `@/lib/data`, `@/components/Navbar`)
- All shared types are defined in `lib/types.ts` — add new types there, not inline
- Avoid `any`; the one exception is the `players` array in `PlayerStatsCache` in `lib/data.ts`

---

## Tournament Formats

Supported phase types (defined in `lib/types.ts` as `PhaseType`):

| Type | Description |
|---|---|
| `groups` | All-vs-all within each group, configurable advancement count |
| `swiss` | W-L pairing; configurable wins to advance / losses to eliminate |
| `elimination` | Single elimination bracket, any power-of-2 team count |
| `final-four` | 2 semifinals + final + optional 3rd place (round 98) |
| `upper-lower` | Double-elimination with upper bracket, lower bracket, grand final |

### Swiss format details
- Supports per-round BO format via `roundBo` in phase config
- Rounds must be **confirmed** by admin before public visibility (`confirmedRounds` array in config)
- Admin generates next round, reviews matches, then confirms

### Double-elimination (upper-lower) conventions
- Positive `round` values = upper bracket
- Negative `round` values = lower bracket
- `round = 99` = grand final

### Bracket generation
Handled in `app/api/admin/fases/generate/route.ts`. Advancement logic in `lib/bracket.ts` (tested in `lib/__tests__/bracket.test.ts`).

---

## Environment Variables

All env vars are validated in `lib/env.ts`. Stored in `.env.local` (not committed):

```
# Required
SESSION_SECRET=            # Secret for JWT signing
ADMIN_PASSWORD_HASH='...'  # bcrypt hash (MUST be in single quotes due to $ chars)

# Optional
RIOT_API_KEY=              # Riot Games API key (can also be set via admin panel, stored in DB)
RIOT_REGION=euw1           # Riot region (default: euw1)
TWITCH_CHANNEL=            # Twitch channel name for embed
ANTHROPIC_API_KEY=         # Claude API key (enables screenshot parsing)
DB_PATH=./data/esigglol.db # SQLite database path (default: ./data/esigglol.db)
LOG_PRETTY=true            # Enables pino-pretty (colorized, human-readable logs). Optional in dev.
```

> **Riot API Key:** Can be configured via the admin panel at runtime (stored in `tournament_config` table). The DB value takes priority over the env var. This avoids server restarts when the dev key expires every 24h.

### Cambiar la contraseña de admin

```bash
npx tsx scripts/gen-password-hash.ts <nueva-password>
# Copiar el hash resultante a .env.local (entre comillas simples):
# ADMIN_PASSWORD_HASH='$2b$12$...'
# Reiniciar el servidor para que tome efecto.
```

---

## Development Workflow

### Docker (recomendado — idéntico a producción)

```bash
# Primera vez en una máquina nueva:
cp .env.example .env.local   # rellenar SESSION_SECRET + ADMIN_PASSWORD_HASH

# Arrancar (construye la misma imagen que va a producción):
docker compose -f docker-compose.dev.yml up --build

# Tras cambios de código, rebuildar:
docker compose -f docker-compose.dev.yml up --build
```

La app queda disponible en `http://localhost:3000`. El runtime es idéntico al de producción: mismo `Dockerfile`, mismo `NODE_ENV=production`, mismo `node server.js`.

### Sin Docker (iteración rápida con HMR)

```bash
npm run dev              # Start dev server (runs sync-ddragon first)
npm run build            # Production build (runs sync-ddragon first)
npm run start            # Start production server
npm run lint             # Run ESLint (v9 flat config)
npm run test             # Run Vitest tests
npm run test:watch       # Run Vitest in watch mode
npx vitest run lib/__tests__/bracket.test.ts  # Run a single test file
npm run collect-stats-dev  # Batch collect player stats (dev rate limits)
npm run collect-stats-prod # Batch collect player stats (prod rate limits)
```

- ESLint config: `eslint.config.mjs` (flat config format, not `.eslintrc`)
- `next.config.ts` auto-detects local network IPs via `os.networkInterfaces()` for `allowedDevOrigins`
- `predev` and `prebuild` npm hooks automatically sync DDragon assets

---

## Key Conventions

- Route and variable names are in **Spanish** (`/fases`, `/equipos`, `/partidos`, `/comparar`)
- Use `lucide-react` for all icons
- Use `clsx` for conditional `className` strings
- Player names use Riot's `Name#TAG` format; the `#` is always included
- The Riot API client (`lib/riot.ts`) reads the API key per-request via `getRiotApiKey()` (DB with env fallback), uses an in-memory cache with 10-minute TTL
- Batch refresh of player stats (5 players per batch, 20s delay) to respect Riot dev API rate limits
- All env vars must go through `lib/env.ts` — never access `process.env` directly in other modules
- Use `logger.child({ module: 'name' })` for structured logging in new modules
