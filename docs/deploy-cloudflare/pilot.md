# Piloto remoto privado y presupuesto

**Estado: piloto aislado desplegado el 2026-10-10; gate F0 en HOLD.** No es esigglol completo. La aplicación de torneo continúa en Docker. El [empaquetado remoto](../../tools/cloudflare-poc/remote/README.md) protege la fixture y añade un presupuesto persistente; la configuración local permanece separada.

## Recursos y controles verificados

Worker, D1 y bucket R2 nuevos con nombre `esigglol-feasibility-pilot`; solo datos sintéticos. El titular activó R2 en el dashboard. D1 y R2 se ubicaron en WEUR; esto no fija el lugar de ejecución de Workers. No se migraron datos del producto. El dominio personalizado del piloto se añadió después de las pruebas, como se registra abajo.

La API de upload confirmó **Workers Free** al rechazar `limits.cpu_ms` con error 100328: esa opción exige Paid. Se retiró el límite configurable y se mantuvo Free, cuyo presupuesto publicado es 10 ms CPU. `usage_model: standard` por sí solo no prueba Free. El endpoint de suscripciones devolvió 10000 por falta de permiso; no se activó ni modificó ningún plan de pago.

| Control | Estado verificado |
|---|---|
| Acceso al Worker | Bearer aleatorio en todos los paths; secretos fuera de Git; credencial retirada antes del framework |
| Caducidad | 2026-10-11 15:44:15 UTC, absoluta; no depende de memoria de un isolate |
| Corte de trabajo | 1.000 peticiones autorizadas **totales**, reservadas atómicamente en D1; 429 al agotarse y 503 si D1 falla |
| Corte R2 | 100 escrituras A, 1.000 lecturas B y 1 MiB acumulado de payload/metadatos; 32 KiB por payload. Reservas persistentes y atómicas antes de R2; sin reinicio ni devolución automática |
| Bucket | Standard; `r2.dev` desactivado; ningún dominio personalizado |
| Objetos | Dos nombres fijos con textos de 13 y 9 bytes; sin uploads arbitrarios; borrado automático a partir de 24 horas |
| Alerta de gasto | `esigglol pilot budget alert`, activa a **1 USD** de consumo facturable de toda la cuenta, al correo del titular; verificada por GET |
| Endpoint al terminar | `workers.dev` desactivado por API y verificado por GET; preview URLs desactivadas; sin dominio/ruta de producción |
| Dominio personalizado del piloto | `esiggesports.jlc-dev.me`, añadido el 2026-10-10 a petición del titular; HTTPS verificado, 401 sin Bearer; mismas cuotas y caducidad |
| Automatización de despliegue | Ninguna; nueva ventana de acceso requiere intervención explícita |

La alerta **no detiene consumo ni cargos**. El contador limita la ejecución de la fixture y el trabajo R2, pero las peticiones rechazadas siguen invocando Workers y, si llevan credencial válida, consultando D1. No cubre otros recursos de la cuenta ni escrituras directas de administradores. No existe aquí un tope global garantizado de 0 €. Referencias: [alertas](https://developers.cloudflare.com/billing/manage/budget-alerts/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Revisar consumo agregado antes de otra ventana.

### Dominio personalizado del piloto

`https://esiggesports.jlc-dev.me` apunta al mismo Worker aislado mediante un Custom Domain, verificado por API. Cloudflare creó su registro DNS proxied y certificado. Una petición HTTPS sin credencial devuelve 401 con `WWW-Authenticate: Bearer` y `Cache-Control: no-store`. No se modificaron los recursos ni las rutas del servidor Proxmox.

El hostname está activo aunque `workers.dev` esté desactivado: cerrar esa URL no cierra un Custom Domain. Sus preview URLs permanecen desactivadas. El Bearer, el límite persistente de peticiones y las cuotas R2 siguen vigentes; a partir de la caducidad absoluta del 2026-10-11 15:44:15 UTC el guard devuelve 503 sin ejecutar la fixture. No se amplió la ventana ni se reiniciaron contadores. Para cerrar también el hostname hay que retirar su asociación al Worker en Domains & Routes o mediante la API de Worker Domains.

Este dominio todavía sirve el piloto técnico, no el producto completo ni su login. Cambiar el hostname no elimina el gate F0 HOLD ni los trabajos pendientes de la migración. Referencia: [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### Bloqueo de operaciones R2

`lib/r2-budget.mjs` aplica el corte a cada get/head/put remoto, incluyendo lecturas 404, fallos/reintentos y la escritura de `after()`. La cuota se reserva con un solo UPDATE condicional que incluye operaciones y bytes UTF-8/metadatos: no hay un check separado de la escritura. Cuota agotada devuelve 429; falta de tabla/contador o fallo de D1 devuelve 503 antes de contactar R2. El trabajo diferido reserva antes de la respuesta y usa un permiso de un solo uso, para no emitir cookie ni programar trabajo si no cabe. Payload desconocido, streaming/multipart/list, metadatos arbitrarios e Infrequent Access quedan fuera del adaptador y bloqueados.

Actualización desplegada con versión Worker `5314d425-3aac-43e7-bbcd-de7f19bed682`; startup API 20 ms. **14 tests locales pasan**, incluyendo carreras de ocho adaptadores contra la última reserva A/B/bytes, error de R2 sin devolución, fallo de D1, payloads desconocidos/excesivos y reservas de `after()` de un solo uso y comparación numérica con parámetros de texto de la API D1. El artefacto compilado comprueba 429 para rutas de lectura/escritura/after, 503 sin la tabla y que borrar sigue disponible al agotar R2. El harness local espera consultas D1 y lecturas R2 reales antes de empezar, no solo presencia de bindings.

Smoke remoto del adaptador en la versión `2add9c89-ef84-4936-97d7-f2edf707b6e5`: **30 peticiones, pasa**, con `PROBE_LATENCY_SAMPLES=0` para no repetir benchmarks. Dos reservas A, tres B y **52 bytes** (payload más metadatos); ambos objetos se eliminan y la cuota permanece. La reserva con CAST de la versión final también rechazó tres intentos por encima de los límites en D1 remoto, con cero filas/cambios y sin modificar esos contadores. La URL se desactivó al terminar y se verificó por GET. Las métricas de CPU de la sección siguiente pertenecen a la versión anterior y no se atribuyen a este nuevo upload; el gate no cambia.

El almacenamiento se acota de forma conservadora mediante **bytes acumulados reservados**, no una estimación de tamaño actual que pudiera quedar desincronizada al borrar o reemplazar. No se devuelve reserva aunque R2 falle o el objeto se elimine; borrar sigue permitido porque DeleteObject es gratuito. Son límites de toda la vida del piloto, mucho menores que Free. No se renuevan por mes: el día de facturación y el consumo agregado de la cuenta no están conectados al adaptador. La migración `0003_r2_budget.sql` no reinicia contadores existentes; no borrar/resembrar esa tabla para reabrir cuota sin una decisión expresa.

`/api/quota` permite revisar límites y reservas, detrás del Bearer, mediante D1 y sin R2. El guard requiere explícitamente PROBE_REMOTE=1; una configuración remota incompleta no activa el modo local sin cuotas. El adaptador opera solo sobre el bucket privado del piloto, que había quedado vacío tras el smoke anterior. Una futura aplicación debe pasar todas sus operaciones por un control equivalente y reservar margen para consumo de otras fuentes; estos límites no son un tope de facturación global.

## Resultado remoto del 2026-10-10

Base de producto `5161928` más los cambios de `feat/cloudflare-remote-pilot`. Upload por conector Cloudflare, versión Worker `f136888d-88ac-47bd-b763-075be7560313`, `nodejs_compat`, compatibility date `2026-10-10`; startup informado por API: 13 ms, **no CPU de invocación**. Fixture y versiones independientes del producto. Los diez assets se embeben en código para el upload: no se certificó el binding nativo ASSETS.

Smoke remoto: **88 peticiones, pasa**. Se comprueban SSR/identificadores, proxy, asset, 401 en todos los paths sin Bearer, cookie segura/JWT, rollback D1, ocho escritores CAS (un ganador y siete 409), R2 write/read con MIME/ETag, delete/404 y side effect acotado de `after()`. Ambos objetos sintéticos se eliminan al terminar. No son mutaciones ni jobs del producto. Contador persistente final: **82 de 1.000** peticiones autorizadas; las seis sin Bearer no consumieron D1/R2.

CPU obtenida de Workers Observability (`$workers.cpuTimeMs`), filtrando servicio/versión y tomando las últimas 20 invocaciones GET 200 por caso en orden temporal. p50/p95/p99 son los valores ordenados en posiciones 10/19/20; p99 con 20 muestras equivale al máximo y no caracteriza colas de producción. La latencia se mide en el cliente y contiene el proxy/red del entorno de pruebas.

| Caso, 20 muestras | CPU p50/p95/p99 ms | Latencia p50/p95 ms | Resultado |
|---|---|---|---|
| SSR | 16 / 23 / 33 | 275 / 4.261 | Sin margen frente a 10 ms Free |
| JSON / bindings | 5 / 8 / 11 | 261 / 279 | p99 por encima del presupuesto publicado |
| JWT | 6 / 10 / 13 | 248 / 268 | Margen insuficiente en la cola |

Primera SSR: 86 ms CPU. Las invocaciones muestreadas tienen outcome `ok`: la flexibilidad ocasional de isolates no demuestra cumplimiento sostenido del presupuesto. **NO-GO para afirmar SSR a coste cero con esta fixture/configuración; F0 del producto sigue HOLD.** Optimizar o evaluar otra estrategia antes de avanzar; no subir a Paid para hacer pasar el gate. Faltan atomicidad de mutaciones reales, jobs/checkpoints/leases, bcrypt/roles completos, restore, assets nativos y métricas de consumo por operación del producto. No se interpreta la alerta como prueba de coste final ni se dispone de una factura cerrada.

Verificación local del nuevo artefacto: build y seis tests pasan, incluido presupuesto concurrente al límite en workerd. ESLint y `git diff --check` pasan. Inventario regenerado contra `5161928`: solo cambia la base auditada, sin cambios en las señales del producto.

## Recursos y acceso

Usar una cuenta/entorno de **preview aislado**, confirmar Workers Free y crear D1/R2 nuevos exclusivamente para el piloto. No reutilizar secretos, nombres, datos o dominio de producción. El nombre y D1 ID de la fixture son deliberadamente ficticios; no convertir su configuración local en configuración de producto.

Antes de publicar cualquier probe remota, protegerla con Cloudflare Access o una credencial diagnóstica aleatoria. El emisor de sesión de esta fixture es exclusivamente diagnóstico y queda detrás de esa credencial; nunca equivale al login del producto. No subir `.dev.vars`, secretos temporales ni datos del despacho/club. Token de CI de alcance mínimo por cuenta y servicio; producción fuera de los permisos del piloto. No hay workflow de despliegue remoto en esta PR.

## Límites de referencia

Referencia oficial revisada el 2026-10-10, **no medición ni confirmación de la cuenta**. Revalidar límites al lanzar el piloto y registrar los valores efectivos.

| Servicio | Referencia Free | Qué verificar |
|---|---|---|
| Workers HTTP | 100.000 solicitudes/día, 10 ms CPU por invocación, 128 MB, 50 subrequests externos, 6 conexiones simultáneas | CPU y errores de límite, redirecciones/subrequests, startup/tamaño final según cuota vigente de la cuenta |
| Trabajo tras responder | `waitUntil()` puede extender hasta 30 s tras fin de respuesta/desconexión | No diseñar una tarea durable sobre ese margen; medir cada fragmento y recuperación |
| D1 | 5 millones de filas leídas/día, 100.000 escritas/día, 5 GB total; 500 MB por DB Free; 50 queries/invocación | Filas escaneadas e índices, tamaño JSON por fila, batching, consumo durante migraciones; errores al agotar cuota |
| R2 Standard | 10 GB-mes, 1 millón de operaciones A/mes y 10 millones B/mes; egress directo gratuito | Operaciones/tamaño, abuso de lecturas públicas, metadatos y coherencia de referencias |

Fuentes: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

R2 requiere [añadir una suscripción mediante checkout](https://developers.cloudflare.com/r2/get-started/). La franquicia gratuita no elimina la facturación de excesos. Registrar activación, condiciones de cobro, cuenta responsable y alertas antes de crear recursos. No activar Workers Paid u otro servicio de pago de forma implícita.

**Presupuesto del piloto:** objetivo 0 €, 120 solicitudes HTTP como máximo por ejecución del smoke y 1.000 autorizadas para toda la ventana; dos objetos diminutos. El corte de trabajo y la desactivación del endpoint son las restricciones efectivas de esta fixture; la alerta de 1 USD es detección posterior. Los avisos al 50 %/80 % de cuotas de producto siguen como propuesta para una futura implantación, no como controles ya configurados.

## Cargas y métricas a registrar

| Caso | Fixture / carga propuesta | Evidencia obligatoria |
|---|---|---|
| SSR público | Home/equipos/ranking/bracket con 8, 16 y 32 equipos, caché fría y caliente | CPU p50/p95/p99, latencia, solicitudes/subrequests, errores, bytes y cache hit |
| Auth/admin/equipo | JWT/cookies reales y bcrypt, roles/versiones de sesión; payloads válidos e inválidos | CPU, aislamiento de equipos, 401/403/409, CSP/headers y secretos no filtrados |
| Mutaciones | 8 escritores concurrentes y fallo intermedio en operaciones de fase/partido/equipo | Un ganador CAS, precondiciones atómicas, rollback de todas las escrituras y conteos SQL |
| Jobs Riot/Valorant | APIs simuladas con 100 matches por jugador, timeouts y 429 antes de usar API real | Fragmentos dentro del presupuesto, checkpoints, lease/retry, reanudación tras muerte del isolate |
| Archivos/OBS/eventos | Logos reales, iconos, caché de assets, reemplazo concurrente, overlays y evento entre isolates | Tamaño/MIME, 404, cache headers, no borrar referencias, reconciliación y consumo D1/R2 |

Escalonar la carga con un máximo explícito de peticiones y parar ante errores/coste. No lanzar pruebas ilimitadas ni tráfico contra Riot sin revisar sus políticas y cuotas. Guardar entorno/plan, commit, versiones/flags, región si aplica, dataset, número de solicitudes, hora, método y exports del dashboard/Analytics. `performance.now()` en el cliente o la latencia de Miniflare **no son CPU de Workers**.

Plantilla del resultado, una fila por caso:

| Commit / entorno / caso | Requests | CPU p50/p95/p99 ms | Subrequests máx. | D1 read/write | R2 A/B | Errores | Coste / GO |
|---|---:|---|---:|---|---|---|---|
| Pendiente | — | No medido | — | — | — | — | HOLD |

## Salida y alternativas

GO solo con contratos reales de atomicidad/jobs aceptados, comportamiento HTTP y auth comprobados, medición Free con margen suficiente y recuperación de datos/objetos ensayada. Documentar desviaciones; no degradar silenciosamente una feature para hacer pasar el presupuesto.

Si SSR/auth/jobs exceden Free, registrar NO-GO para coste cero y elegir explícitamente entre mantener Docker, rediseñar trabajo/caché con paridad comprobada, evaluar OpenNext por compatibilidad o solicitar decisión de un plan de pago. OpenNext no soluciona por sí mismo addons nativos, transacciones o jobs.

Rollback de código y restore de datos son procedimientos distintos. Para el siguiente piloto definir export/Time Travel D1, copia/versionado o política de recuperación R2 y prueba de restore antes de borrar recursos. No ejecutar importación SQLite → D1 sin solicitud separada, copia previa, dry-run, recuentos e integridad.
