<div align="center">

# ESIgg.lol

**Gestor de torneos de League of Legends para ESIUCLM**

[![Aplicación](https://img.shields.io/badge/aplicación-esigglol.jlc--dev.me-C89B3C)](https://esigglol.jlc-dev.me)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)
[![CI](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml/badge.svg)](https://github.com/JavierLoro/esigglol/actions/workflows/ci.yml)

</div>

ESIgg.lol reúne la gestión y publicación de un torneo de League of Legends. Los
organizadores preparan equipos, fases y partidos desde un panel protegido; los
participantes consultan y mantienen la información permitida de su equipo; y
los espectadores siguen cuadros, resultados y estadísticas desde la web
pública.

## Funcionalidades

### Sitio público

- Fases de grupos, sistema suizo, eliminación simple, Final Four y Upper/Lower.
- Cuadros y resultados actualizados a partir de los partidos del torneo.
- Ranking, estadísticas de jugadores e historial de partidas.
- Fichas de equipos y comparador cara a cara.
- Overlays de fases y partidos para emisiones.
- Estado e integración del canal de Twitch.

### Administración

- Gestión de equipos, jugadores, fases y partidos.
- Generación y avance de cuadros con confirmación del administrador.
- Corrección de resultados con recálculo de los cruces dependientes.
- Subida de logos y edición segura mediante control de versiones por entidad.
- Generación de códigos de torneo, eventos de lobby y recogida de estadísticas
  mediante las API de Riot.
- Configuración de la Riot API key sin reiniciar la aplicación.
- Gestión de accesos de equipos y aprobación o rechazo de sus solicitudes.

### Portal de equipos

Cada equipo dispone de un acceso independiente en `/equipo/login`. Desde
`/equipo` puede consultar su plantilla, ajustar los roles permitidos y enviar
solicitudes para cambiar el logo, corregir un Riot ID o incorporar un jugador.
Los cambios que afectan a la identidad o composición del equipo requieren la
revisión de un administrador.

## Accesos

| Área | Ruta | Acceso |
|---|---|---|
| Web pública | `/` | Público |
| Administración | `/admin` | Contraseña de administrador |
| Portal de equipos | `/equipo` | Credenciales propias del equipo |
| Overlays | `/overlay/fases/[id]`, `/overlay/partidos/[id]` | Público |
| Estado del servicio | `/api/health` | Público |
| Métricas | `/api/metrics` | Público |

## Tecnología

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 con App Router y React 19 |
| Interfaz | Tailwind CSS v4 y lucide-react |
| Lenguaje | TypeScript 5 en modo estricto |
| Persistencia | SQLite con better-sqlite3 y modo WAL |
| Autenticación | JWT con jose y contraseñas bcrypt |
| Validación | Zod v4 |
| Observabilidad | Pino y métricas Prometheus |
| Pruebas | Vitest y Playwright |

## Inicio rápido

### Desarrollo local

Requiere Node.js 22 o posterior y npm.

```bash
npm install
cp .env.example .env.local
npm run generate-session-secret
npx tsx scripts/gen-password-hash.ts <contraseña>
npm run dev
```

Copia en `.env.local` el secreto y el hash generados. La aplicación estará
disponible en `http://localhost:3000`. `npm run dev` sincroniza antes los datos
de Data Dragon.

### Docker

Requiere Docker Desktop o Docker Engine con Compose.

```bash
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up --build
```

El entorno de desarrollo construye la imagen local y monta `./data` para
conservar SQLite. Después de modificar el código, vuelve a construir la imagen.

## Configuración

Las credenciales y secretos deben permanecer fuera del repositorio. Usa
`.env.local` en desarrollo y el gestor de secretos del despliegue en producción.

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `ADMIN_PASSWORD_HASH` | Sí | — | Hash bcrypt de la contraseña de administración |
| `SESSION_SECRET` | Sí | — | Firma de sesiones JWT; mínimo 32 caracteres |
| `RIOT_API_KEY` | No | Vacío | Consultas a Riot y operaciones de Tournament API |
| `RIOT_REGION` | No | `euw1` | Región de Riot |
| `TOURNAMENT_API_MODE` | No | `stub` | Proveedor `stub` o `production` de Tournament API |
| `TWITCH_CHANNEL` | No | Vacío | Canal mostrado en la portada |
| `TWITCH_CLIENT_ID` | No | Vacío | Consulta del estado del directo |
| `TWITCH_CLIENT_SECRET` | No | Vacío | Consulta del estado del directo |
| `DB_PATH` | No | `./data/esigglol.db` | Ruta del archivo SQLite |
| `REFRESH_AUTO_INTERVAL_MS` | No | `21600000` | Edad mínima antes de refrescar estadísticas |
| `REFRESH_BATCH_SIZE` | No | `3` | Jugadores procesados por lote |
| `REFRESH_BATCH_DELAY_MS` | No | `30000` | Espera entre lotes, en milisegundos |
| `LOG_LEVEL` | No | `info` | Nivel de logs de Pino |
| `LOG_PRETTY` | No | `false` | Formato legible para desarrollo |

El modo `stub` sirve para desarrollo y pruebas. Los códigos válidos para
partidas reales requieren acceso de producción autorizado por Riot, una clave
compatible y `TOURNAMENT_API_MODE=production`. La guía de
[Tournament API](docs/riot-tournament-api.md) describe la configuración y sus
restricciones. Al desplegar con Compose, la variable también debe estar
declarada en `services.app.environment`; mientras no se reenvíe al contenedor,
la aplicación conservará el modo `stub` predeterminado.

`ADMIN_PASSWORD_HASH` contiene caracteres `$`. Escríbelo entre comillas simples
para evitar que el shell los expanda:

```dotenv
ADMIN_PASSWORD_HASH='$2b$12$...'
```

## Desarrollo y validación

| Comando | Acción |
|---|---|
| `npm run dev` | Arranca Next.js con recarga en caliente |
| `npm run lint` | Ejecuta ESLint |
| `npm test` | Ejecuta las pruebas de Vitest |
| `npm run test:watch` | Ejecuta Vitest en modo interactivo |
| `npm run test:e2e` | Ejecuta las pruebas E2E de Playwright |
| `npm run test:e2e:ui` | Abre la interfaz de Playwright |
| `npm run build` | Genera el build de producción |
| `npm run start` | Arranca el build de producción |
| `npm run sync-ddragon` | Actualiza manualmente los datos de Data Dragon |
| `npm run collect-stats-dev` | Recoge estadísticas respetando límites de una dev key |
| `npm run collect-stats-prod` | Recoge estadísticas con configuración de producción |

El hook de pre-commit ejecuta ESLint con correcciones automáticas sobre los
archivos JavaScript y TypeScript preparados para el commit.

### Datos de prueba

El seed añade equipos y jugadores ficticios sin borrar los datos existentes:

```bash
npx tsx scripts/seed-data.ts
npx tsx scripts/seed-data.ts --teams 4
npx tsx scripts/seed-data.ts --players 5
```

No lo ejecutes sobre una base de datos de producción.

## Docker y despliegue

| Archivo | Uso |
|---|---|
| `docker-compose.dev.yml` | Construye la aplicación localmente |
| `docker-compose.yml` | Usa la imagen publicada en GHCR y activa Watchtower |

```bash
# Producción
docker compose up -d

# Estado y logs
docker compose ps
docker compose logs -f app
```

El servicio `app` de producción recibe desde el host las variables declaradas
en `services.app.environment`. El servicio `backup` carga su configuración
desde `.env.local`; además, `BACKUP_HOST_PATH` debe definirse para Compose en el
shell o en un archivo `.env`, porque determina el volumen antes de arrancar los
contenedores.

Los pushes a `main` ejecutan el siguiente flujo:

1. ESLint, pruebas y build de producción.
2. Construcción y publicación de la imagen en
   `ghcr.io/javierloro/esigglol:latest`.
3. Conexión de GitHub Actions a la red privada mediante Tailscale.
4. Solicitud autenticada al servicio interno de redespliegue.

El Compose de producción también incluye Watchtower para vigilar la imagen
publicada como mecanismo de actualización del host.

## Persistencia y copias de seguridad

SQLite se conserva en `./data`. Los contenedores se ejecutan con el usuario
`1000`, por lo que ese directorio debe permitir escritura a dicho usuario.

El worker `backup` usa la API de copia en línea de SQLite, valida cada snapshot
y aplica una política de retención. Sus principales variables son:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `BACKUP_ENABLED` | `true` | Activa el worker |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Intervalo entre copias |
| `BACKUP_RUN_ON_START` | `true` | Crea una copia al arrancar |
| `BACKUP_RETENTION_COUNT` | `7` | Número de snapshots conservados |
| `BACKUP_HOST_PATH` | `./backups` | Directorio del host para las copias |

Consulta [Copias de seguridad](docs/backups.md) antes de configurar un volumen
externo o restaurar una base de datos.

## Documentación

- [Formatos de torneo](docs/tournament-formats.md)
- [Integración con Riot Tournament API](docs/riot-tournament-api.md)
- [Copias, verificación y restauración](docs/backups.md)
- [Scripts de utilidad](docs/scripts.md)
- [Arquitectura](docs/architecture.md)
- [Referencia de API y métricas](docs/api-reference.md)

## Seguridad

- No publiques contraseñas, claves de Riot, secretos de Twitch ni
  `SESSION_SECRET` en Git, logs o incidencias.
- Rota una credencial desde el proveedor correspondiente y actualízala en el
  gestor de secretos del despliegue.
- Conserva las copias de SQLite fuera del volumen principal y prueba el proceso
  de restauración antes de necesitarlo.
