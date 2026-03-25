# ESIgg.lol

Gestor de torneos de League of Legends para ESIUCLM.

**Sitio publico:** brackets de fases, ranking de jugadores, resultados de partidos, paginas de equipo, comparador de equipos, embed de Twitch.

**Panel de administracion** (`/admin`): gestion de equipos, fases y partidos; generacion de brackets; parseo de screenshots via Claude Vision; integracion con Riot Tournament API (codigos de torneo, lobby events); protegido por contrasena.

---

## Requisitos

- Node.js 22+
- npm

## Setup local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno y rellenar valores
cp .env.example .env.local

# Generar hash de password para admin
npx tsx scripts/gen-password-hash.ts <tu-password>
# Copiar el hash resultante a ADMIN_PASSWORD_HASH en .env.local (entre comillas simples)

# Generar SESSION_SECRET
openssl rand -hex 32
# Copiar el resultado a SESSION_SECRET en .env.local

# Iniciar servidor de desarrollo
npm run dev
```

La app estara disponible en `http://localhost:3000`.

---

## Variables de entorno

Ver `.env.example` para la lista completa.

| Variable | Requerida | Descripcion |
|---|---|---|
| `RIOT_API_KEY` | Si | API key de Riot Games |
| `ADMIN_PASSWORD_HASH` | Si | Hash bcrypt del password de admin |
| `SESSION_SECRET` | Si | Secreto para firmar JWT (min 32 chars) |
| `RIOT_REGION` | No | Region de Riot API (default: `euw1`) |
| `TWITCH_CHANNEL` | No | Canal de Twitch para el embed |
| `ANTHROPIC_API_KEY` | No | API key de Claude (habilita parseo de screenshots) |
| `DB_PATH` | No | Ruta de la BD SQLite (default: `./data/esigglol.db`) |

> **Importante:** `ADMIN_PASSWORD_HASH` contiene caracteres `$`. En `.env.local` envuelve el valor entre comillas simples para evitar expansion de variables:
> ```
> ADMIN_PASSWORD_HASH='$2b$12$...'
> ```

---

## Docker

El `docker-compose.yml` incluye la app y Watchtower (auto-actualizacion).

```bash
# Arrancar en produccion
docker compose up -d

# Ver logs
docker logs esigglol-app-1 -f

# Ver estado
docker compose ps
```

La base de datos SQLite se persiste en `./data/` mediante un volumen. El contenedor corre como usuario `1000` (no root). Los archivos de la BD deben tener permisos de escritura para ese usuario:

```bash
chmod 666 data/esigglol.db data/esigglol.db-shm data/esigglol.db-wal
```

**Watchtower** comprueba cada 60 segundos si hay una nueva imagen en el registry y redespliega automaticamente.

---

## Cambiar la contrasena de admin

```bash
npx tsx scripts/gen-password-hash.ts <nueva-password>
# Copiar el hash a ADMIN_PASSWORD_HASH en .env.local (entre comillas simples)
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
| `npm run sync-ddragon` | Sincronizar assets de Data Dragon manualmente |
| `npm run collect-stats-dev` | Recolectar stats de jugadores (dev key, delays) |
| `npm run collect-stats-prod` | Recolectar stats de jugadores (prod key) |

---

## CI/CD

Push a `main` dispara GitHub Actions:

1. **CI** — lint + test + build
2. **Docker** — build y push de imagen a `ghcr.io/javierloro/esigglol:latest`
3. **Watchtower** — detecta la nueva imagen en ~60s y redespliega el contenedor automaticamente

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
| Metricas | Prometheus (prom-client) — `GET /api/metrics` |
| IA | Anthropic SDK (parseo de screenshots) |
| Testing | Vitest |
