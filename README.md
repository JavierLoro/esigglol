# ESIgg.lol

Gestor de torneos de League of Legends para ESIUCLM. Incluye sitio publico con brackets, ranking de jugadores, resultados de partidos y embed de Twitch, mas un panel de administracion protegido.

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
# Copiar el hash resultante a ADMIN_PASSWORD_HASH en .env.local

# Generar SESSION_SECRET
openssl rand -hex 32
# Copiar el resultado a SESSION_SECRET en .env.local

# Iniciar servidor de desarrollo
npm run dev
```

La app estara disponible en `http://localhost:3000`.

## Variables de entorno

Ver `.env.example` para la lista completa. Variables requeridas:

| Variable | Descripcion |
|---|---|
| `RIOT_API_KEY` | API key de Riot Games |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt del password de admin |
| `SESSION_SECRET` | Secreto para firmar JWT (min 32 chars) |

Variables opcionales: `RIOT_REGION`, `TWITCH_CHANNEL`, `ANTHROPIC_API_KEY`.

## Docker

```bash
# Construir y arrancar
docker compose up -d

# O manualmente
docker build -t esigglol .
docker run --env-file .env.local -p 3000:3000 -v ./data:/app/data esigglol
```

La base de datos SQLite se almacena en `/app/data` dentro del contenedor. Montar un volumen para persistirla.

## Scripts disponibles

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Iniciar servidor de produccion |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Ejecutar tests (Vitest) |
| `npm run sync-ddragon` | Sincronizar assets de Data Dragon |
| `npm run collect-stats-dev` | Recolectar stats (dev key, con delays) |
| `npm run collect-stats-prod` | Recolectar stats (production key) |

## CI/CD

GitHub Actions ejecuta automaticamente al pushear a `main` o abrir PR:

1. **CI**: lint + test + build
2. **Docker**: build y push de imagen a GitHub Container Registry (`ghcr.io`)

## Tech Stack

Next.js 16 (App Router), React 19, TypeScript, TailwindCSS v4, SQLite (better-sqlite3), JWT (jose), bcryptjs.
