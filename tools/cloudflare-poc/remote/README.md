# Piloto remoto privado

Empaqueta la fixture de vinext para un upload por API/conector. No despliega esigglol completo ni importa SQLite, usuarios, secretos de producción o datos de torneos. El resultado y las limitaciones están en [pilot.md](../../../docs/deploy-cloudflare/pilot.md).

## Protección y presupuesto

- Todos los paths, assets y emisor de sesión diagnóstica requieren un Bearer aleatorio de al menos 32 caracteres. Se compara mediante hashes SHA-256 y `timingSafeEqual`; el framework recibe la petición sin esa credencial. No usar tokens en URLs.
- Falta de credencial/configuración o caducidad: 503; credencial incorrecta: 401. `PROBE_EXPIRES_AT` tiene fecha absoluta; el empaquetado propone 24 horas. Respuestas autorizadas privadas sin caché; cookie JWT `HttpOnly`, `Secure`, `SameSite=Lax`.
- Cada petición autorizada reserva atómicamente una unidad en D1 antes de ejecutar la fixture. Máximo **1.000 peticiones en total**, incluyendo assets y errores. El contador persiste entre isolates y redeploys. Presupuesto agotado: 429; error de D1: 503. Una operación `reset` de la fixture no reinicia ese contador.
- R2 solo escribe dos nombres fijos, con textos de 13 y 9 bytes. No admite subidas de contenido arbitrario. Mantener el bucket Standard privado, sin `r2.dev` ni dominio; regla de borrado al alcanzar 24 horas.
- Además, todas sus operaciones remotas pasan por `lib/r2-budget.mjs`: máximo **100 escrituras A, 1.000 lecturas B y 1 MiB de bytes acumulados**, con 32 KiB de payload por objeto. Son presupuestos de toda la vida del piloto, sin renovación automática. Incluyen reservas fallidas, lecturas 404, bytes UTF-8 y metadatos admitidos. No se devuelve cuota por overwrite, delete, error o timeout: así se acota conservadoramente el almacenamiento y se evita depender de reconciliación R2/D1 o del día de facturación.
- La reserva de operaciones y bytes se realiza con un único UPDATE condicional en D1, antes de llamar a R2. Cuota agotada: **429**; tabla/contador ausente o D1 indisponible: **503**, sin R2. Payload excesivo: **413**; streams de tamaño desconocido, multipart, list y opciones de almacenamiento no admitidas quedan bloqueados. El adaptador fuerza Standard y solo permite MIME acotado. Borrar objetos sigue permitido cuando se agota R2 porque DeleteObject es gratuito, siempre dentro del límite exterior de peticiones/acceso.
- `after()` reserva su escritura antes de emitir la respuesta. La ejecución diferida usa una reserva de un solo uso y una copia del payload/metadatos. Si no hay cuota, el emisor devuelve 429 sin cookie ni tarea en segundo plano.
- `/api/quota`, protegido por la misma credencial, muestra límites y reservas persistentes mediante D1, sin consultar R2. El guard remoto exige `PROBE_REMOTE=1`; omitirlo no habilita la ruta local sin cuotas. Estas restricciones son del piloto, no una integración con la facturación de toda la cuenta.
- El smoke tiene un máximo adicional de 120 peticiones HTTP y 10 intentos de polling; elimina ambos objetos de prueba al completarse. Desactivar `workers.dev` después de la ventana de pruebas y mantener preview URLs desactivadas.

**No es un límite de facturación de la cuenta.** Peticiones rechazadas siguen invocando Workers; las autorizadas después del agotamiento siguen consultando D1. Otros servicios, otros Workers o acceso directo de administradores al bucket quedan fuera del contador. Las alertas de gasto solo notifican; R2 factura excesos. Mantener Workers Free y no aumentar planes/cuotas para hacer pasar una prueba.

## Reproducción explícita

Desde esta carpeta de fixture, con dependencias instaladas:

```bash
npm run build
npm test
PROBE_DATABASE_ID='<D1 aislado>' PROBE_R2_BUCKET='<R2 aislado>' node remote/prepare.mjs
```

El output está en `.wrangler/remote/` (ignorado). `prepare.mjs` no obtiene credenciales, crea recursos ni sube nada. Aplicar `migrations/0001_probe.sql`, `0002_pilot_budget.sql` y `0003_r2_budget.sql` solo en el D1 del piloto. La migración R2 usa INSERT OR IGNORE y no reinicia reservas existentes. Activar sobre un bucket nuevo/vacío; datos previos y accesos directos quedan fuera del contador. El upload necesita todos los módulos `.js`/`.mjs`, `pilot.mjs` como `main_module`, bindings DB/FILES, las vars de la configuración y secretos `PROBE_ACCESS_TOKEN`/`PROBE_SECRET`. Verificar plan y controles del bucket antes de habilitar temporalmente la URL.

Provisionar los secretos fuera de Git y suministrar `PROBE_BASE_URL` y `PROBE_ACCESS_TOKEN` al proceso de pruebas mediante un entorno seguro; ejecutar `node remote/smoke.mjs`. `PROBE_LATENCY_SAMPLES=0` ejecuta solo las comprobaciones funcionales, evitando repetir benchmarks; admite 0–20 muestras. No imprimir secretos ni pasarlos como argumentos de shell. No publicar el emisor de sesiones de la fixture sin la protección exterior. Rotar ambas credenciales antes de una nueva ventana, revisar los contadores y no ampliar cuotas/fecha ni vaciar tablas sin una decisión explícita.

Los diez assets pequeños se embeben como un módulo base64 para usar el upload del conector sin una sesión JWT separada de subida de assets. Esto prueba contenido estático servido por código Worker, **no el binding nativo ASSETS**, su caché ni su facturación. Cada asset consume una invocación/presupuesto. No usar esta estrategia para el producto.

La prueba `remote-built.test.mjs` ejecuta el artefacto completo en workerd/Miniflare, incluido R2, D1 y una carrera de ocho peticiones con dos plazas libres: exactamente dos pasan y seis reciben 429. No certifica CPU de Cloudflare; los números de CPU deben obtenerse de Observability remoto. El smoke soporta ausencia explícita de R2 (503), pero el piloto registrado sí tiene FILES.
