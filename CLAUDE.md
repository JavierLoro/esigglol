@AGENTS.md

# ESIgg.lol — Codebase Guide

## Project Overview

**ESIgg.lol** is a private League of Legends tournament manager for ESIUCLM. It has two main areas:

- **Public site** — view tournament phases/brackets, player rankings, match results, team comparison, Twitch stream embed
- **Admin panel** (`/admin/*`) — manage teams, phases, matches, generate brackets; password-protected

External integrations: Riot Games API (player stats) and Twitch (stream embed).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| UI | React 19.2.4 |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS v4 |
| Auth | JWT via `jose` (v6) |
| Icons | `lucide-react` |
| Class utils | `clsx` |

> **Next.js 16 has breaking changes.** Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. The `01-app/` subdirectory covers the App Router. Heed all deprecation notices.

---

## Directory Structure

```
/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (Navbar, Geist font, dark bg)
│   ├── page.tsx                # Home: Twitch embed + upcoming/completed matches
│   ├── ranking/                # Public player ranking table
│   ├── fases/                  # Public tournament phases/brackets
│   ├── comparar/               # Public team comparison tool
│   ├── admin/                  # Admin panel (JWT-protected)
│   │   ├── layout.tsx          # Admin layout: sidebar (desktop) + bottom nav (mobile)
│   │   ├── page.tsx            # Dashboard with stats
│   │   ├── login/              # Login page (unprotected)
│   │   ├── equipos/            # Team management
│   │   ├── fases/              # Phase management
│   │   └── partidos/           # Match management
│   ├── api/
│   │   ├── admin/              # Protected CRUD routes (login, equipos, fases, partidos)
│   │   │   └── fases/generate/ # Bracket generation logic
│   │   ├── data/               # Public read-only routes (equipos, fases)
│   │   └── riot/               # Riot API proxy (summoner, matches, refresh-stats)
│   └── globals.css             # TailwindCSS v4 import + CSS variables + scrollbar
│
├── components/
│   ├── Navbar.tsx
│   ├── MatchCard.tsx
│   ├── TwitchEmbed.tsx
│   ├── RefreshStatsButton.tsx
│   ├── PlayerRankingTable.tsx
│   ├── CompareClient.tsx
│   ├── admin/
│   │   └── LogoutButton.tsx
│   └── brackets/
│       ├── GroupsView.tsx
│       ├── SwissView.tsx
│       ├── EliminationBracket.tsx
│       └── UpperLowerBracket.tsx
│
├── lib/
│   ├── types.ts                # All shared TypeScript types
│   ├── schemas.ts              # Zod validation schemas for API input
│   ├── data.ts                 # SQLite persistence layer (server-side only)
│   ├── db.ts                   # better-sqlite3 connection singleton (WAL mode)
│   ├── auth.ts                 # JWT session helpers + requireAdminSession()
│   ├── bracket.ts              # Bracket advancement logic
│   ├── ddragon.ts              # DDragon asset sync utilities
│   └── riot.ts                 # Riot API client with in-memory cache
│
├── data/                       # Non-source runtime files
│   └── ddragon-version.txt     # Cached DDragon version string
│
├── esigglol.db                 # SQLite database (not committed)
│
├── public/                     # Static assets (logos, images)
├── proxy.ts                    # Next.js middleware (named export, not middleware.ts)
└── next.config.ts
```

---

## Data Layer

All persistence is **SQLite** via `lib/data.ts` using `better-sqlite3`. The database file is `esigglol.db` at the project root.

- `lib/db.ts` holds the singleton connection (WAL mode, foreign keys enabled)
- **Only call data functions from Server Components or API Route handlers** — never from client components
- Available helpers: `getTeams()`, `saveTeams()`, `getTeamById()`, `getPhases()`, `savePhases()`, `savePhase()`, `getPhaseById()`, `getMatches()`, `saveMatches()`, `saveMatch()`, `getMatchesByPhase()`, `deleteMatches()`, `getPlayerStatsCache()`, `savePlayerStatsCache()`
- ID generation: `generateId(prefix)` → `"prefix-<timestamp>-<random>"`
- Input validation for API routes is in `lib/schemas.ts` (Zod schemas)

---

## Authentication

- Sessions are **JWT tokens** (12-hour expiration) stored in the `admin_session` HttpOnly cookie
- `lib/auth.ts` exports: `createSession()`, `verifySession(token)`, `getSessionFromCookies()`, `requireAdminSession()`, `COOKIE_NAME`
- **Middleware lives in `proxy.ts`** — this is intentional (not `middleware.ts`). It exports a named `proxy` function and a `config` matcher. It protects all `/admin/*` routes except `/admin/login`
- Admin API routes use `requireAdminSession()` — returns a 401 response if not authenticated, or `null` if OK
- `SESSION_SECRET` env var is **required** — the app throws at startup if missing
- Password is set via `ADMIN_PASSWORD` env var

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
| `GET /api/data/equipos` | No | Public team list |
| `GET /api/data/fases` | No | Public phases + matches |
| `GET /api/riot/summoner?name=Nick%23TAG` | No | Summoner stats |
| `GET /api/riot/matches?id=MATCH_ID` | No | Match details |
| `POST /api/riot/refresh-stats` | No | Trigger background stats refresh |
| `GET /api/riot/refresh-stats` | No | Poll refresh status |

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

Bracket generation is handled in `app/api/admin/fases/generate/route.ts`.

---

## Environment Variables

Stored in `.env.local` (not committed):

```
RIOT_API_KEY=          # Riot Games development API key
RIOT_REGION=euw1       # Riot region (euw1 = Europe West)
TWITCH_CHANNEL=        # Twitch channel name for embed
ADMIN_PASSWORD_HASH=   # bcrypt hash of admin password (generate: npx tsx scripts/gen-password-hash.ts <password>)
SESSION_SECRET=        # Secret for JWT signing
```

### Cambiar la contraseña de admin

```bash
npx tsx scripts/gen-password-hash.ts <nueva-password>
# Copiar el hash resultante a .env.local:
# ADMIN_PASSWORD_HASH=<hash>
# Reiniciar el servidor para que tome efecto.
```

---

## Development Workflow

```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run ESLint (v9 flat config)
```

- No automated tests exist
- No CI/CD pipelines
- ESLint config: `eslint.config.mjs` (flat config format, not `.eslintrc`)
- `next.config.ts` auto-detects local network IPs via `os.networkInterfaces()` for `allowedDevOrigins`

---

## Key Conventions

- Route and variable names are in **Spanish** (`/fases`, `/equipos`, `/partidos`, `/comparar`)
- Use `lucide-react` for all icons
- Use `clsx` for conditional `className` strings
- Player names use Riot's `Name#TAG` format; the `#` is always included
- The Riot API client (`lib/riot.ts`) uses an in-memory cache with 10-minute TTL
- Batch refresh of player stats (5 players per batch, 20s delay) to respect Riot dev API rate limits
