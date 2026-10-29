<div align="center">

# ESIgg.lol

**Tu torneo. Tus equipos. Tu comunidad.**

Una web para organizar competiciones de **League of Legends y Valorant**,
dar protagonismo a los equipos y llevar los resultados hasta el directo.

[Guías de uso](docs/guias/index.md) · [Instalar mi propia web](#instala-tu-propia-web) · [Proponer una mejora](https://github.com/JavierLoro/esigglol/issues)

[![CI](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml)

</div>

Del primer equipo inscrito a la final: ESIgg.lol reúne la organización del
torneo, la web que consulta tu comunidad y las fuentes que utilizas en OBS.
Los organizadores gestionan la competición desde su panel, los equipos tienen
su propio espacio y los espectadores pueden seguir cuadros, resultados y
estadísticas en una misma web.

Nació para los torneos de **ESIUCLM**, pero puedes montar tu propia instalación
para una asociación, una comunidad de Discord, un torneo universitario o una
liga entre amigos. Ponle tu nombre, tu logo y tu canal de Twitch.

## Dale una casa a tu competición

- **Prepara una edición y hazla crecer.** Organiza torneos de LoL o Valorant,
  trabaja en borrador, publícalos cuando estén listos y conserva las ediciones
  anteriores.
- **Elige cómo se juega.** Grupos, suizo, eliminación simple, Final Four y
  Upper/Lower, con generación de cuadros y control del avance.
- **Da espacio a cada equipo.** Plantillas, logos y un portal donde consultar
  sus datos y solicitar cambios, con revisión del organizador.
- **Haz que la comunidad lo siga.** Cuadros, resultados, fichas de equipos,
  comparaciones y Twitch desde una web pública.
- **Llévalo al directo.** Fuentes para OBS con marcador, previa y resumen de
  fase, listas para añadir a tu emisión.
- **Hazlo tuyo.** Personaliza el título, el subtítulo, el logo y el canal de
  Twitch desde **Administración → Apariencia**, sin editar código. La apariencia
  es común a todos los torneos de tu instalación.

Puedes organizar la competición y registrar resultados manualmente sin claves
de Riot. Las estadísticas y otras integraciones se activan por separado; LoL
y Valorant tienen capacidades distintas.

## Un proyecto para aprender, compartir y seguir mejorando

ESIgg.lol nació como un proyecto personal de aprendizaje de **vibecoding**:
construir una aplicación real con ayuda de IA, probar ideas y aprender al
ponerlas en práctica. Empezó resolviendo las necesidades de un torneo cercano
y fue creciendo a partir de ahí.

Lo comparto para que otras personas puedan probarlo, montar sus propios
torneos y aportar mejoras. **Puede tener errores, partes por pulir y decisiones
técnicas que merezcan una segunda vuelta.** Si quieres usarlo en una competición,
prueba antes el recorrido completo de tu torneo y prepara tus copias de seguridad.

Encontrar un fallo, contar cómo lo has usado, mejorar una guía o enviar una
pull request también ayuda a que el proyecto avance.

## ¿Por dónde empiezo?

1. **Quiero ver cómo se organiza un torneo:** empieza por las
   [guías para organizadores y equipos](docs/guias/index.md).
2. **Quiero una web para mi comunidad:** abre los pasos de instalación de abajo.
   Necesitarás un ordenador o servidor donde ejecutar la aplicación.
3. **Quiero adaptarlo o contribuir:** encontrarás el entorno de desarrollo y
   las comprobaciones en el apartado desplegable correspondiente.

## Instala tu propia web

El despliegue estable utiliza **Node.js y SQLite**, con opción de **Docker**.
Abre solo el apartado que necesites: los detalles técnicos quedan aquí para
cuando decidas dar el paso.

<details>
<summary><strong>1. Descargar el proyecto y preparar el acceso de administración</strong></summary>

Necesitas **Git, Node.js 22 o posterior y npm** para estos pasos.

```bash
git clone https://github.com/JavierLoro/esigglol.git
cd esigglol
```

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

Guarda estos valores fuera de Git. La contraseña elegida será la que uses
para entrar en `/admin/login`. A continuación, elige Node.js o Docker.

</details>

<details>
<summary><strong>2. Probarlo en tu ordenador con Node.js</strong></summary>

Completa primero la preparación del apartado anterior.

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

</details>

<details>
<summary><strong>3. Ejecutarlo con Docker y construir tu propia imagen</strong></summary>

Completa primero la preparación del apartado 1.

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

</details>

<details>
<summary><strong>4. Desplegar en un servidor, actualizar y conservar los datos</strong></summary>

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
El Compose de producción incluye Watchtower para vigilar la imagen publicada.
Si prefieres controlar cuándo actualizas, revisa ese servicio antes de arrancar.

El pipeline de este repositorio publica imágenes en GHCR y utiliza Tailscale
para redesplegar la instalación del autor. Si haces un fork, adapta o desactiva
esos pasos en [el workflow de CI/CD](.github/workflows/ci.yml): son específicos
de esa instalación y no son necesarios para ejecutar tu propia web.

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

</details>

<details>
<summary><strong>5. Configurar Riot, Twitch y las opciones de la aplicación</strong></summary>

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

</details>

<details>
<summary><strong>6. Desarrollar, ejecutar pruebas y cargar datos de ejemplo</strong></summary>

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

</details>

<details>
<summary><strong>7. Consultar las funciones por juego, las rutas y la configuración de OBS</strong></summary>

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

</details>

<details>
<summary><strong>8. Explorar la adaptación experimental a Cloudflare</strong></summary>

El repositorio conserva una adaptación a Cloudflare Workers, con SQLite en
Durable Objects y archivos en R2. **La instancia de Cloudflare del autor se
retiró el 29 de octubre de 2026**, junto con sus Workers y datos; no hay una
demo activa de esa instalación.

Esta vía es experimental. Para crear otra instalación hay que preparar
recursos, credenciales y configuración propios, y revisar los límites y costes
del proveedor. Consulta [la guía de Cloudflare](docs/deploy-cloudflare/application.md).

El workflow de Cloudflare del repositorio conserva un paso de despliegue
automático en los pushes a `main`. Antes de usarlo en un fork, revísalo y
adáptalo: la configuración incluida apunta a la instalación retirada.

</details>

## Guías para tu próximo paso

| Quiero… | Dónde empezar |
|---|---|
| Organizar el torneo o usar el portal de equipo | [Guías de uso](docs/guias/index.md) |
| Preparar ediciones de LoL y Valorant | [Gestión de torneos](docs/multiple-tournaments.md) |
| Elegir el formato de competición | [Formatos de torneo](docs/tournament-formats.md) |
| Preparar la emisión | [Overlays para OBS](docs/overlays-obs/README.md) |
| Proponer una idea o contar un fallo | [Issues del proyecto](https://github.com/JavierLoro/esigglol/issues) |

<details>
<summary><strong>Ver la documentación técnica y de mantenimiento</strong></summary>

| Necesito… | Leer |
|---|---|
| Activar códigos y eventos de LoL | [Riot Tournament API](docs/riot-tournament-api.md) |
| Actualizar imágenes y catálogo de Valorant | [Recursos de Valorant](docs/valorant-assets.md) |
| Operar y recuperar SQLite | [Backups](docs/backups.md) |
| Usar herramientas de mantenimiento | [Scripts](docs/scripts.md) |
| Consultar la estructura técnica | [Arquitectura](docs/architecture.md), [modelo de datos](docs/data-model.md), [API y métricas](docs/api-reference.md) |
| Explorar Cloudflare | [Aplicación, controles de gasto y limitaciones](docs/deploy-cloudflare/application.md) |
| Mantener las guías publicadas | [Publicación en GitHub Pages](docs/guias/README.md) |

Al añadir, modificar o eliminar funcionalidades del admin global o del portal
de equipo, actualiza [docs/guias/index.md](docs/guias/index.md) en el mismo cambio
con pasos, permisos y opciones del rol afectado. Es la fuente de las guías
publicadas en GitHub Pages.

</details>

## ¿Te apetece aportar?

Si algo no funciona, [abre una issue](https://github.com/JavierLoro/esigglol/issues)
con los pasos para reproducirlo y qué esperabas que ocurriera. Si tienes una
idea, cuenta qué problema resolvería para tu torneo. También son bienvenidas
las mejoras de documentación y las pull requests.

Gracias por darle una oportunidad y ayudar a construir la siguiente versión.
