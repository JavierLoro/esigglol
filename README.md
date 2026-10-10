<div align="center">

# ESIgg.lol

**Plataforma para organizar torneos de League of Legends y Valorant**

[![Instancia ESIUCLM](https://img.shields.io/badge/instancia_ESIUCLM-esigglol.jlc--dev.me-C89B3C)](https://esigglol.jlc-dev.me)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)
[![CI](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml)

</div>

ESIgg.lol permite organizar varias ediciones de torneos, gestionar equipos y
publicar fases, resultados y fuentes para OBS. Los organizadores trabajan desde
un panel protegido; cada equipo tiene su propio portal; y los espectadores
consultan la competición desde la web pública.

El proyecto nació para los torneos de ESIUCLM y actualmente puede utilizarse
para torneos de LoL y Valorant de cualquier organizador, con su propia
instalación, equipos y ediciones. Desde **Administración → Apariencia** se pueden
configurar el título, subtítulo, logo y canal de Twitch de la portada; esta
configuración es común a todos los torneos de la instalación. Los valores
iniciales conservan la identidad del torneo original de ESIUCLM.

El despliegue soportado utiliza **Node.js y Docker con SQLite**. La migración a
Cloudflare está en una [fase de viabilidad](docs/deploy-cloudflare/README.md): la
PoC aislada funciona localmente y tiene un piloto privado en Workers Free.
El despliegue completo y el gate de viabilidad siguen pendientes.

[Inicio rápido](#inicio-rápido) · [Configuración](#configuración) ·
[Desarrollo](#desarrollo-y-validación) · [Despliegue](#docker-y-despliegue) ·
[Documentación](#documentación)

## Qué permite hacer

### Competición y administración

- Crear ediciones de LoL o Valorant, prepararlas como borrador, publicarlas y
  archivarlas. Cada edición mantiene sus equipos, fases y partidos.
- Organizar grupos, suizo, eliminación simple, Final Four y Upper/Lower.
- Generar y avanzar cuadros con confirmación del administrador, y corregir
  resultados recalculando los cruces dependientes.
- Gestionar plantillas, logos, accesos de equipos y solicitudes de cambios.
- Consultar cuadros, resultados, fichas de equipos y comparaciones en la web
  pública, e integrar el canal de Twitch.
- Configurar tres fuentes permanentes de OBS por torneo: marcador, previa y
  resumen de fase, con selección de contenido y opciones visuales.

Publicar una edición no publica automáticamente sus cuadros o rondas suizas.
Consulta [la guía de uso](docs/guias/index.md) para el flujo de administración y
[la gestión de ediciones](docs/multiple-tournaments.md) para sus estados y alcance.

### Integraciones por juego

| Juego | Funcionalidad | Límites actuales |
|---|---|---|
| League of Legends | Estadísticas e historial de partidas; códigos de torneo, eventos de lobby y recogida de resultados mediante Riot | Las consultas requieren una clave compatible; Tournament API usa `stub` por defecto y necesita acceso autorizado para partidas reales |
| Valorant (PC, EU) | Resultados manuales de series y mapas; ranking a partir del leaderboard oficial del acto activo | Funciona sin API para la competición manual; el ranking puede tener cobertura parcial y requiere `VALORANT_API_KEY`. Sin códigos de torneo, lobbies, vetos ni historial personal integrado |

Las claves de LoL y Valorant se configuran por separado. Las condiciones de
acceso, privacidad y cobertura de Valorant están en
[la documentación de ediciones](docs/multiple-tournaments.md).

### Portal de equipos

Cada equipo entra con sus credenciales en `/equipo/login`. Desde `/equipo`
consulta su plantilla, ajusta los roles permitidos y solicita cambios de logo,
Riot ID o incorporación de jugadores. Los cambios de identidad o composición
requieren la revisión de un administrador.

## Accesos

| Área | Ruta | Acceso |
|---|---|---|
| Web pública | `/` | Público |
| Administración | `/admin` → `/admin/login` | Contraseña global |
| Portal de equipos | `/equipo` → `/equipo/login` | Credenciales del equipo |
| Fuentes OBS por edición | `/overlay/torneos/[id]/marcador`, `/overlay/torneos/[id]/previa`, `/overlay/torneos/[id]/fase` | Público |
| Vistas OBS fijas | `/overlay/fases/[id]`, `/overlay/partidos/[id]` | Público |
| Estado y métricas | `/api/health`, `/api/metrics` | Público |

En OBS, añade las fuentes como **Navegador** a 1920 × 1080. La selección se guarda
por edición en **Emisión / OBS** y las fuentes abiertas se actualizan cada
30 segundos. Consulta [la guía de overlays](docs/overlays-obs/README.md).

## Inicio rápido

### Desarrollo local

Requiere **Node.js 22 o posterior y npm**. Desde un checkout del repositorio:

```bash
npm ci
cp .env.example .env.local
npm run generate-session-secret
npx tsx scripts/gen-password-hash.ts 'replace-with-your-local-password'
```

**Antes de arrancar**, edita `.env.local`: copia la línea `SESSION_SECRET=...`
generada y pega el hash bcrypt en `ADMIN_PASSWORD_HASH`, entre comillas simples
para conservar sus caracteres `$`:

```dotenv
ADMIN_PASSWORD_HASH='$2b$12$...'
SESSION_SECRET=replace-with-the-generated-secret
```

El bloque anterior muestra el formato; sustituye ambos valores por los que
has generado. No hacen falta claves de Riot para gestionar equipos, fases y
resultados manuales.

```bash
npm run dev
```

Abre `http://localhost:3000` y entra en `/admin/login` con la contraseña que
usaste al generar el hash. La base de datos y sus migraciones se crean al
acceder a los datos; no hay un paso manual de migración.

`npm run dev` y `npm run build` sincronizan antes los recursos de Data Dragon y
el catálogo de Valorant. La primera descarga oficial de Valorant puede rondar
**1,5 GB**; se extraen los recursos necesarios y se elimina el ZIP temporal.
Su sincronización automática es opcional: si falla, conserva el catálogo previo
o usa las alternativas visuales disponibles. Véase
[Recursos de Valorant](docs/valorant-assets.md) para sincronización manual y ZIP local.

### Ejecución local con Docker

Requiere Docker con Compose y un `.env.local` con las dos credenciales ya
configuradas. Prepara `data` y `backups` con permisos de lectura y escritura
para UID **1000**, el usuario de los servicios:

```bash
mkdir -p data backups
docker compose -f docker-compose.dev.yml up --build
```

La aplicación queda en `http://localhost:3000`. Este Compose construye y ejecuta
**la imagen de producción localmente**: después de cambiar el código, repite el
build. Para recarga en caliente, usa `npm run dev`.

## Configuración

[`.env.example`](.env.example) es el punto de partida. Usa `.env.local` en
desarrollo y proporciona los secretos al entorno de producción sin versionarlos.

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `ADMIN_PASSWORD_HASH` | Sí | — | Hash bcrypt de la contraseña global |
| `SESSION_SECRET` | Sí | — | Firma JWT; mínimo 32 caracteres |
| `RIOT_API_KEY` | No | Vacío | Consultas de LoL y Tournament API |
| `VALORANT_API_KEY` | No | Vacío | Consultas de Valorant; no hereda `RIOT_API_KEY` |
| `RIOT_REGION` | No | `euw1` | Región de LoL |
| `TOURNAMENT_API_MODE` | No | `stub` | `stub` o `production` para Tournament API |
| `TWITCH_CHANNEL` | No | Vacío | Canal mostrado en la portada |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | No | Vacío | Consulta del estado del directo |
| `DB_PATH` | No | `./data/esigglol.db` | Archivo SQLite |
| `REFRESH_AUTO_INTERVAL_MS` | No | `21600000` | Edad mínima para refrescar estadísticas |
| `REFRESH_BATCH_SIZE` | No | `3` | Jugadores por lote |
| `REFRESH_BATCH_DELAY_MS` | No | `30000` | Espera entre lotes en milisegundos |
| `LOG_LEVEL`, `LOG_PRETTY` | No | `info`, `false` | Nivel de logs y formato legible |

Los códigos para partidas reales de LoL requieren acceso de producción
autorizado por Riot, una clave compatible y `TOURNAMENT_API_MODE=production`.
La [guía de Tournament API](docs/riot-tournament-api.md) describe la configuración.

En **Compose de producción**, `app` solo recibe las variables enumeradas en
`services.app.environment`. Actualmente no incluye `VALORANT_API_KEY` ni
`TOURNAMENT_API_MODE`: añádelas a esa lista si necesitas esas integraciones y
proporciónalas desde el entorno del host. Definirlas únicamente en `.env.local`
no las pasa a ese servicio. El Compose local sí carga ese archivo para `app`.

## Desarrollo y validación

El proyecto usa Next.js 16 (App Router), React 19, TypeScript estricto,
Tailwind CSS v4 y SQLite (`better-sqlite3`, WAL). La autenticación utiliza JWT
con `jose` y bcrypt; Zod valida entradas; Pino y Prometheus aportan observabilidad.

| Comando | Acción |
|---|---|
| `npm run dev` | Desarrollo con recarga en caliente |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Vitest, una ejecución o modo interactivo |
| `npm run test:e2e` / `npm run test:e2e:ui` | Playwright, consola o interfaz |
| `npm run build` / `npm run start` | Compilar y arrancar en producción |
| `npm run sync-ddragon` / `npm run sync-valorant` | Sincronizar recursos de cada juego |
| `npm run dev:valorant-sandbox` | Entorno de pruebas de Valorant con base aislada |
| `npm run collect-stats-dev` / `npm run collect-stats-prod` | Recogida de estadísticas de LoL |
| `npm run backup` | Crear una copia consistente de SQLite |

Consulta [Scripts de utilidad](docs/scripts.md) para argumentos y requisitos.
El hook de pre-commit ejecuta ESLint con correcciones sobre los archivos de
código preparados para el commit.

### Datos de prueba

Con `.env.local` configurado, el seed añade equipos y jugadores ficticios al
torneo de LoL inicial (`legacy-lol`), conservando los existentes. No crea fases
ni partidos y cada ejecución añade nuevos equipos:

```bash
npx tsx scripts/seed-data.ts --teams 4 --players 5
```

Úsalo en una base de desarrollo. Para probar Valorant por separado, ejecuta
`npm run dev:valorant-sandbox`: usa `.tmp/valorant-sandbox/sandbox.db` y escucha
solo en `http://127.0.0.1:3200`. La contraseña local, fixtures y configuración de
la clave se explican en [la guía de ediciones](docs/multiple-tournaments.md).

## Docker y despliegue

| Archivo | Uso |
|---|---|
| [`docker-compose.dev.yml`](docker-compose.dev.yml) | Build local de la app y worker de backups |
| [`docker-compose.yml`](docker-compose.yml) | Imagen `ghcr.io/javierloro/esigglol:latest`, backups y Watchtower |

Antes de iniciar producción, configura las variables del host que necesita
`app`, prepara los volúmenes con permisos para UID 1000 y crea `.env.local`
con la configuración del worker `backup`, que lo requiere como `env_file`.
Ambos servicios deben usar el mismo `DB_PATH` dentro del volumen `/app/data`.
Conserva esa ruta montada si personalizas la ubicación de SQLite.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app backup
```

`--build` construye el worker de backups; la app utiliza la imagen publicada.
Los pushes a `main` ejecutan lint, pruebas y build, publican la imagen en GHCR
y solicitan el redespliegue al servicio interno mediante Tailscale. El Compose
de producción también incluye Watchtower para vigilar la imagen publicada.

### Persistencia y copias de seguridad

El volumen `./data` conserva SQLite y recursos locales asociados, incluidos
los logos subidos. El worker `backup` crea snapshots **de SQLite** mediante la
API de copia en línea, los valida y conserva los siete más recientes por defecto,
con una copia al arrancar y otra cada 24 horas. Los archivos subidos necesitan
su propia copia; no están dentro del snapshot de la base de datos.

Las copias se montan en `./backups` por defecto. Para otro destino,
`BACKUP_HOST_PATH` debe estar en el shell o en el archivo `.env` de Compose;
ponerlo solo en `.env.local` del worker no cambia el volumen.

Consulta [Copias, verificación y restauración](docs/backups.md) para retención,
copias manuales y restauración. Conserva copias fuera del volumen principal y
prueba la recuperación antes de necesitarla. No publiques secretos, claves ni
copias de datos en Git, logs o incidencias.

## Documentación

| Necesito… | Leer |
|---|---|
| Administrar la competición o el portal de equipo | [Guías de uso](docs/guias/index.md) |
| Entender ediciones, publicación y límites de Valorant | [Torneos de LoL y Valorant](docs/multiple-tournaments.md) |
| Configurar cuadros y avance | [Formatos de torneo](docs/tournament-formats.md) |
| Preparar la emisión | [Overlays OBS](docs/overlays-obs/README.md) |
| Activar códigos y eventos de LoL | [Riot Tournament API](docs/riot-tournament-api.md) |
| Actualizar imágenes y catálogo de Valorant | [Recursos de Valorant](docs/valorant-assets.md) |
| Operar y recuperar SQLite | [Backups](docs/backups.md) |
| Usar herramientas de mantenimiento | [Scripts](docs/scripts.md) |
| Consultar la estructura técnica | [Arquitectura](docs/architecture.md), [modelo de datos](docs/data-model.md), [API y métricas](docs/api-reference.md) |
| Revisar la viabilidad de Cloudflare | [Estado F0, PoC y piloto privado](docs/deploy-cloudflare/README.md) |
| Mantener las guías publicadas | [Publicación en GitHub Pages](docs/guias/README.md) |

Al añadir, modificar o eliminar funcionalidades del admin global o del portal
de equipo, actualiza [docs/guias/index.md](docs/guias/index.md) en el mismo cambio
con pasos, permisos y opciones del rol afectado. Es la fuente de las guías
publicadas en GitHub Pages.
