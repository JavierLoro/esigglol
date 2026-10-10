# Piloto remoto privado y presupuesto

**Estado: piloto aislado desplegado el 2026-10-10; gate F0 en HOLD.** No es esigglol completo. La aplicación de torneo continúa en Docker. El [empaquetado remoto](../../tools/cloudflare-poc/remote/README.md) protege la fixture y añade un presupuesto persistente; la configuración local permanece separada.

## Recursos y controles verificados

Worker, D1 y bucket R2 nuevos con nombre `esigglol-feasibility-pilot`; solo datos sintéticos. El titular activó R2 en el dashboard. D1 y R2 se ubicaron en WEUR; esto no fija el lugar de ejecución de Workers. No se migraron datos del producto ni se configuró su dominio.

La API de upload confirmó **Workers Free** al rechazar `limits.cpu_ms` con error 100328: esa opción exige Paid. Se retiró el límite configurable y se mantuvo Free, cuyo presupuesto publicado es 10 ms CPU. `usage_model: standard` por sí solo no prueba Free. El endpoint de suscripciones devolvió 10000 por falta de permiso; no se activó ni modificó ningún plan de pago.

| Control | Estado verificado |
|---|---|
| Acceso al Worker | Bearer aleatorio en todos los paths; secretos fuera de Git; credencial retirada antes del framework |
| Caducidad | 2026-10-11 15:44:15 UTC, absoluta; no depende de memoria de un isolate |
| Corte de trabajo | 1.000 peticiones autorizadas **totales**, reservadas atómicamente en D1; 429 al agotarse y 503 si D1 falla |
| Bucket | Standard; `r2.dev` desactivado; ningún dominio personalizado |
| Objetos | Dos nombres fijos con textos de 12 y 9 bytes; sin uploads arbitrarios; borrado automático a partir de 24 horas |
| Alerta de gasto | `esigglol pilot budget alert`, activa a **1 USD** de consumo facturable de toda la cuenta, al correo del titular; verificada por GET |
| Endpoint al terminar | `workers.dev` desactivado por API y verificado por GET; preview URLs desactivadas; sin dominio/ruta de producción |
| Automatización de despliegue | Ninguna; nueva ventana de acceso requiere intervención explícita |

La alerta **no detiene consumo ni cargos**. El contador limita la ejecución de la fixture y el trabajo R2, pero las peticiones rechazadas siguen invocando Workers y, si llevan credencial válida, consultando D1. No cubre otros recursos de la cuenta ni escrituras directas de administradores. No existe aquí un tope global garantizado de 0 €. Referencias: [alertas](https://developers.cloudflare.com/billing/manage/budget-alerts/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Revisar consumo agregado antes de otra ventana.

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
