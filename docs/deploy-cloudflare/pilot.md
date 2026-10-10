# Piloto remoto pendiente y presupuesto

**Estado: no ejecutado.** La fixture local no exige cuenta, ni verifica habilitación/facturación/CPU en Cloudflare. El gate F0 sigue en HOLD. Este documento define la continuación revisable; no da por realizados los pasos.

## Recursos y acceso

Usar una cuenta/entorno de **preview aislado**, confirmar Workers Free y crear D1/R2 nuevos exclusivamente para el piloto. No reutilizar secretos, nombres, datos o dominio de producción. El nombre y D1 ID de la fixture son deliberadamente ficticios; no convertir su configuración local en configuración de producto.

Antes de publicar cualquier probe remota, protegerla con Cloudflare Access o una credencial diagnóstica aleatoria y quitar el emisor de sesiones sin contraseña. No subir `.dev.vars`, secretos temporales ni datos del despacho/club. Token de CI de alcance mínimo por cuenta y servicio; producción fuera de los permisos del piloto. No hay workflow de despliegue remoto en esta PR.

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

**Presupuesto propuesto, pendiente de decisión:** coste objetivo 0 €, aviso al alcanzar el 50 % y 80 % de cualquier cuota relevante, detener carga artificial al 80 % y revisar antes de continuar. Las alertas no son un límite de gasto garantizado. Si no existe un mecanismo de corte adecuado para R2, mantener el piloto privado, con número de solicitudes/objetos limitado y un responsable de interrupción.

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
