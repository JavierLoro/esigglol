# Evidencia local de F0

Este registro conserva la evidencia de la PoC local inicial. La continuación remota del 2026-10-10, sus controles de gasto y CPU se registran por separado en [pilot.md](pilot.md); no convierten estos resultados locales en pruebas de producción.

Revisión: 2026-10-10. Base de producto `6a431db`, Node local `24.19.0`; CI configurada con Node 22. Versiones exactas de la fixture en `tools/cloudflare-poc/package-lock.json`.

## Resultados

| Comprobación | Resultado | Alcance real |
|---|---|---|
| `npm test` en producto | **303 tests / 54 archivos pasan** | Regresión automatizada SQLite/handlers/lógica existente; no paridad Workers |
| `npm run test:audit-cloudflare` | **3 tests pasan** | Detección AST, transacciones anidadas, imports type-only/dinámicos y cierre transitivo con ciclos |
| `npm run lint`, `npx tsc --noEmit` | **Pasan** | Fuente de producto y fixture lint; tipos de producto sin incluir fixture |
| Scanner estático | **174 módulos, 67 entradas** | Snapshot generado sin importar DB. 32 llamadas de transacción exterior, 9 anidadas, 34 `.immediate()` detectados; detalles en inventario |
| `vinext check` en producto | **98 % reportado por el checker** | 19 puntos soportados y 1 parcial (imágenes). No inspecciona garantías SQLite, jobs, FS persistente ni coste/CPU; no es 98 % de paridad de producto |
| Build de fixture | **Pasa** | App Router/RSC/SSR + bindings Workers, con dependencias aisladas |
| Smoke del bundle en workerd | **Pasa** | SSR, asset/image sin optimizar, proxy/CSP, JWT/cookies, 401, efecto corto after, D1 rollback + 8 CAS concurrentes (1 éxito/7 conflictos), R2 put/get/delete/404/MIME/ETag |
| Wrangler deploy `--dry-run` de fixture | **Pasa, sin deploy remoto** | 939,02 KiB de upload / 282,21 KiB gzip, 18 assets. No es el bundle de esigglol completo ni confirma la cuota efectiva de una cuenta |
| Compilador Next de producto | **Pasa con workaround local descrito abajo** | Compilación Next 16.2.1, TypeScript y prerender 43/43; no ejecución completa de Docker/Compose ni de prebuild |
| Bundle Node standalone | **Pasa smoke local** | `/api/health` 200 con `status: ok` y `/admin` sin sesión redirige 307 a `/admin/login`; DB de prueba en memoria |
| Workers Free / recursos remotos | **No ejecutado** | CPU, startup remoto, facturación R2, cuotas, restore y paridad completa siguen pendientes |

Los contadores del scanner son señales sintácticas, no número de transacciones por request. Revisar código y tests de producto antes de diseñar operaciones D1.

## Latencia medida en workerd local

20 peticiones secuenciales por caso, después del smoke, esperando el cuerpo completo con `performance.now()` del cliente Node. Fixture pequeña, caché caliente y sin APIs externas. Registro ilustrativo de esta ejecución; CI vuelve a producir su propio artifact.

| Caso | p50 wall ms | p95 wall ms | CPU Workers |
|---|---:|---:|---|
| SSR + funciones puras | 31,43 | 99,33 | No medida |
| JSON + bindings disponibles | 14,40 | 21,80 | No medida |
| Ruta JWT/cookie privada | 14,62 | 21,72 | No medida |

Estas cifras incluyen cliente, scheduling, IPC y runtime local; **no permiten comparar CPU con el límite Free de 10 ms**. El reporte automatizado mantiene `cpuMs: null` y `freePlanVerified: false`.

## Limitaciones del entorno y comprobaciones pendientes

El `npm run build` literal encontró `EPERM` al abrir el socket Unix del CLI `tsx` de prebuild. El sistema también rechaza `os.networkInterfaces()`, que usa el `next.config.ts` ya existente para los orígenes de desarrollo. No se modificó código de producto para ocultar esos errores.

Se verificó la sincronización Data Dragon con `node --import tsx scripts/sync-ddragon.ts` y credenciales ficticias de build, evitando el IPC del CLI. Se ejecutó el compilador Next directamente con `DB_PATH=:memory:` y un preload **temporal, fuera del repositorio**, que devuelve interfaces vacías solo cuando el host produce `ERR_SYSTEM_ERROR`. Este workaround afecta al descubrimiento de IPs de desarrollo, no cambia SQLite ni los handlers. Valorant no se descargó (su catálogo puede ser ~1,5 GB); no se presenta el prebuild completo como probado.

La CI existente conserva `npm run build` en Ubuntu/Node 22, sin ese preload. El resultado de CI debe revisarse en la PR antes de merge. No se ejecutó Docker/Compose en este entorno (sin Docker instalado), E2E completo de navegador ni operaciones remotas. Estas limitaciones no bloquean la revisión de la PoC, pero no satisfacen la Definition of Done global de #136.

## Reproducibilidad

Ver [README de la fixture](../../tools/cloudflare-poc/README.md). `npm run bundle:report --prefix tools/cloudflare-poc` solo genera un dry-run. El workflow publica el inventario actualizado, JSON de latencias locales y reporte del bundle; no publica secretos ni realiza un deploy.

El proxy/auth probado es el **diagnóstico**, no el de producción; `lib/auth.ts` alcanza `team-portal-data.ts` mediante import dinámico y `lib/env.ts` valida secretos en import. Migraciones, datos y transacciones de producto todavía son Node/SQLite. Ningún test de primitivas sustituye esos contratos.
