# Aplicación completa en Cloudflare (experimental)

## Estado de la instalación del autor

La instancia experimental estuvo publicada en `esiggesports.jlc-dev.me` desde
el 2026-10-10. **Se retiró el 2026-10-29 por decisión del autor**: se desvinculó
el dominio y se eliminaron los Workers de la aplicación y del piloto, los
Durable Objects con sus datos, la base D1 del piloto y ambos buckets R2.
Esa dirección ya no es una demo disponible.

El código de la adaptación se conserva para estudio y para quien quiera
preparar su propia instalación. Las instrucciones siguientes requieren
recursos y configuración propios; no hay una instalación del autor que se
pueda recuperar asociando de nuevo el dominio. Docker sigue disponible con
su build, SQLite WAL y backups. La retirada de Cloudflare no modificó el
despliegue del homelab ni importó o eliminó sus datos.

## Decisión de arquitectura

El piloto D1 documentado en [pilot.md](pilot.md) sigue siendo una investigación
distinta. Sus problemas de transacciones síncronas y CPU no se resolvieron
simulando una transacción. La aplicación usa SQLite **dentro de Durable Objects**:

| Responsabilidad | Cloudflare | Docker |
|---|---|---|
| Enrutamiento | Worker, una llamada al objeto de la instalación | Next.js |
| SSR, rutas, auth y SQL | vinext dentro de `EsiggApplication` | Next.js y better-sqlite3 |
| Transacciones | `storage.transactionSync`, con rollback y anidación | Transacciones SQLite |
| Logos | R2 Standard, claves inmutables y reconciliación | Directorio de uploads |
| Assets públicos | Workers Static Assets, servidos directamente | Directorio public |
| Riot background | SQL con cursor, etapas, alarmas y reintentos | `after()` y ejecución Node |
| Límite de login | SQL persistente, IP de Cloudflare | Contadores Node |
| Métricas | Contadores/duración persistentes, hasta 1.024 combinaciones | prom-client y métricas de proceso |

Un objeto coordina los torneos relacionados de una instalación, sus permisos,
branding y mutaciones atómicas. No se crea un objeto por visita. El Worker
normal ejecuta el salto de enrutamiento; el SSR y bcrypt se ejecutan bajo el
presupuesto de CPU del objeto. `FileBudget` es otro objeto: guarda contadores
independientes que **no deben restaurarse junto con la base del producto**.

Las mismas páginas, componentes, repositorios y migraciones sirven a ambos
destinos. Vite selecciona los adaptadores cloud; los imports Node de archivos,
logger y base de datos no se ejecutan en los caminos cloud. React se actualiza
a 19.2.6 para satisfacer el peer de vinext. Next.js permanece en 16.2.1.

## Controles de gasto

Workers y los objetos utilizan el plan Free, con fallos al superar los límites
del proveedor. No se activan planes Paid, Images, AI, Queues ni Logpush.
`workers.dev` y previews permanecen deshabilitados. Los assets estáticos no
pasan por R2. La variante cloud sirve imágenes originales; no activa una
transformación de imágenes de pago. Los iconos de perfil se leen del CDN de
DDragon, con timeout y tamaño máximo.

R2 puede facturar excesos: el código reserva consumo **antes** de cada `put` o
`get`, en un objeto independiente y con límites conservadores de por vida:

| Control de esta instalación | Límite |
|---|---:|
| Operaciones Class A | 1.000 |
| Operaciones Class B | 50.000 |
| Bytes escritos, incluidos metadatos reservados | 64 MiB |
| Tamaño de un logo | 2 MiB |

No se reembolsa consumo por fallos, borrados o reemplazos y no hay reset
automático. Si el presupuesto no se puede consultar, no se accede a R2.
Los deletes de R2 Standard no consumen esas operaciones facturables. El límite
es de esta instalación; no cubre otras aplicaciones o accesos directos al
bucket de la cuenta. No se debe cambiar el nombre/namespace de `FileBudget`
ni su clave `esigglol-application` para recuperar cuota.

La asociación a un logo exige que esté live. Un tombstone impide referenciar
un archivo mientras se borra. Los logos staging/live sin referencias y más
de cinco minutos, y los borrados pendientes, se reconcilian por alarmas.
Cada alarma procesa como máximo diez borrados y programa los lotes restantes,
los archivos todavía jóvenes y los reintentos. Los logos referenciados se
filtran antes de limitar el lote: no pueden bloquear la limpieza de otros.

## Compilar y desplegar

```bash
npm ci
npm run build:cloudflare
npm run check:cloudflare
npm run test:cloudflare
npx wrangler deploy --config dist/server/wrangler.json --dry-run
```

La sincronización descarga assets públicos sin credenciales de la instalación.
El catálogo de Valorant puede requerir una descarga grande; se conserva el
comportamiento opcional del build Docker si su proveedor no está disponible.
La preparación de public excluye ZIPs, temporales y el catálogo fuente que la
web no consume. Las versiones y manifiestos se incorporan al build.

Para otra instalación, cambia nombre de Worker, bucket, instalación y dominio
en `cloudflare/wrangler.jsonc`. Crea el bucket Standard, configura los secretos
con `wrangler secret bulk` desde un archivo ignorado y autentica Wrangler.
Los secretos son `SESSION_SECRET` (al menos 32 caracteres),
`ADMIN_PASSWORD_HASH` (bcrypt), y opcionalmente `BOOTSTRAP_TOKEN` (32 bytes
aleatorios en base64url) y `BOOTSTRAP_EXPIRES` (ISO). Mantén `SESSION_SECRET`
estable: firma sesiones y cifra las credenciales de los equipos.

```bash
npm run deploy:cloudflare
```

El conector puede crear la sesión de upload, asociar recursos, subir módulos
y gestionar el dominio. `upload-assets.mjs` recibe por stdin exclusivamente el
JWT temporal de upload; `prepare-upload.mjs` genera multipart en `.wrangler`,
sin imprimir secretos. El manifiesto generado con `--manifest` guarda una
huella local; la subida y la preparación rechazan assets de otra compilación.
Después de cada build hay que generar la sesión con el manifiesto completo,
subir los archivos pendientes y publicar el Worker con ese JWT de assets.
No uses `keep_assets` para publicar un servidor recién compilado: conserva
el manifiesto anterior y puede dejar los nuevos chunks JavaScript en 404.
Estos archivos operativos no se versionan.

### Despliegue automático desde GitHub

**Revisa este workflow antes de fusionar cambios en `main` o reutilizarlo.**
El archivo conserva los pasos de publicación de la instalación retirada.
Eliminar los recursos remotos no desactiva esos pasos: si siguen disponibles
las credenciales y los prerrequisitos, un push a `main` intentará desplegar de
nuevo. La retirada de infraestructura no modificó el workflow ni sus secretos.

El workflow `cloudflare-application.yml` comprueba build, tipos, SQL, HTTP,
JavaScript/CSS y tamaño tanto en las PR como en los pushes a `main`.
Las PR terminan con `--dry-run`, sin credenciales de despliegue.
Tras pasar las comprobaciones, el paso de un push a `main` está configurado
para publicar en el antiguo dominio `esiggesports.jlc-dev.me` y verificar seis páginas públicas y los
JavaScript/CSS de la misma compilación. Esta verificación no modifica datos;
si falla, el workflow queda en rojo y no revierte automáticamente la publicación.
Las ejecuciones de una misma rama no se solapan ni cancelan un despliegue en curso.

Configura `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en los secretos de
GitHub Actions del repositorio. El token necesita permisos de despliegue de
Workers, limitados a la cuenta y zona de la aplicación. Solo el paso de
publicación recibe estas credenciales. `--keep-vars` conserva las variables
remotas que no están en la configuración; los secretos de la aplicación,
incluido `SESSION_SECRET`, permanecen en el Worker y no se regeneran.
El workflow de Docker mantiene su despliegue independiente.

Tras publicar, verifica también el frontal del dominio con la misma compilación:

```bash
npm run verify:cloudflare:frontend -- https://esiggesports.jlc-dev.me
```

Esta comprobación solo lee seis páginas públicas y todos los JavaScript/CSS
del build, incluidos chunks que se cargan después de navegar. No necesita
sesión de administrador, no activa el setup ni crea datos de prueba.
Una página HTML con HTTP 200 no basta: si los menús se quedan en «Cargando…»,
comprueba que sus scripts también devuelven 200 y su tipo de contenido correcto.

## Acceso y operación

En la instalación recién desplegada, el operador entrega un enlace privado
`/__setup?token=…`. Solo acepta una activación antes de su caducidad. El
administrador elige su contraseña; el hash se guarda en SQL. La ruta POST
comprueba Origin, limita la longitud y solo permite una inserción. Después,
el acceso normal es `/admin/login`. No publiques el enlace de activación.

`GET /api/admin/runtime` requiere sesión de administrador. Informa del tamaño
SQL, consumo de archivos, etapas de refresco y un bookmark de recuperación
del objeto. El endpoint es de lectura; no permite restaurar datos ni resetear
presupuestos. La invalidación del acceso del equipo se comprueba contra SQL
en cada operación y sigue funcionando después de reiniciar el objeto.

Riot se procesa por jugador y etapa: ranking, mastery, listado de IDs e
historial, con una partida por alarma. Los cursors quedan guardados; los
upserts permiten repetir una etapa tras un fallo. Un HTTP 429 de Riot aplaza
el trabajo según Retry-After. Un 401/403 marca la key inválida. Los fallos
transitorios tienen reintentos limitados; se conserva el fallback de ranking.

## Evidencia y alcance de la beta

Los resultados remotos y de dominio de esta sección son históricos, anteriores
a la retirada del 2026-10-29. No describen un servicio activo ni una nueva
validación del código tras esa fecha.

| Verificación | Resultado |
|---|---|
| Tests Node | 303 tests, 54 archivos, todos pasan |
| Build Next.js de producción | Pasa |
| Cloudflare SQL | Rollback real, anidación, rollback de migración, tombstones |
| Cuota concurrente | 1.010 reservas simultáneas: exactamente 1.000 admitidas |
| Ciclo de archivos | 20 logos de equipos, branding y solicitud pendiente protegidos; huérfanos en varios lotes, alarma futura y reintento tras fallo |
| Recuperación aislada | Fixture SQL + R2 restaurada; SQL solo no recupera un logo borrado; el consumo no se reembolsa |
| HTTP workerd | 49 comprobaciones; auth, alta/publicación, equipos, fases/generación, R2, jobs y reinicio |
| HTTP remoto | 39 comprobaciones; web/assets, auth, equipos/R2, revocación y bookmark PITR |
| Frontal | 6 páginas y 60 JavaScript/CSS verificados en workerd y dominio; menús Fases, Ranking y Comparar comprobados en navegador |
| Despliegue de assets | La preparación rechaza huellas de otra compilación; regresión de chunks 404 cubierta por tests |
| Bundle | 603,13 KiB gzip; 719 assets públicos |
| Arranque remoto | 20 ms |
| Dominio | HTTPS activo, portada pública y redirect de admin sin sesión |

La verificación remota crea y elimina exclusivamente sus propios torneos
de prueba. No activa la contraseña del administrador del titular.

La issue #136 sigue abierta: esta beta no equivale a cerrar todos los gates.
Quedan el procedimiento y ensayo de recuperación operativo completo **SQL + R2**, importación de datos
Docker si se solicita, mediciones prolongadas de CPU/cuotas y validación de
las integraciones Riot/Valorant/Twitch con credenciales reales. Se verificó
la obtención de un bookmark PITR; **no se hizo un restore remoto**. El test
`files.test.mjs` restaura una fixture de equipo y logo en workerd aislado;
no es una copia completa, un procedimiento de producción ni una prueba de
PITR remoto. Restaurar
SQL no recupera un logo ya borrado en R2: antes de operar una recuperación
hay que conservar la copia correspondiente de ambos almacenes. Los scripts
de backup/restore SQLite de Docker continúan con su función original.

Fuentes: [SQLite y PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[límites de Durable Objects](https://developers.cloudflare.com/durable-objects/platform/limits/),
[plan Free](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[assets](https://developers.cloudflare.com/workers/static-assets/direct-upload/).
