# Piloto remoto privado

Empaqueta la fixture de vinext para un upload por API/conector. No despliega esigglol completo ni importa SQLite, usuarios, secretos de producción o datos de torneos. El resultado y las limitaciones están en [pilot.md](../../../docs/deploy-cloudflare/pilot.md).

## Protección y presupuesto

- Todos los paths, assets y emisor de sesión diagnóstica requieren un Bearer aleatorio de al menos 32 caracteres. Se compara mediante hashes SHA-256 y `timingSafeEqual`; el framework recibe la petición sin esa credencial. No usar tokens en URLs.
- Falta de credencial/configuración o caducidad: 503; credencial incorrecta: 401. `PROBE_EXPIRES_AT` tiene fecha absoluta; el empaquetado propone 24 horas. Respuestas autorizadas privadas sin caché; cookie JWT `HttpOnly`, `Secure`, `SameSite=Lax`.
- Cada petición autorizada reserva atómicamente una unidad en D1 antes de ejecutar la fixture. Máximo **1.000 peticiones en total**, incluyendo assets y errores. El contador persiste entre isolates y redeploys. Presupuesto agotado: 429; error de D1: 503. Una operación `reset` de la fixture no reinicia ese contador.
- R2 solo escribe dos nombres fijos, con textos de 12 y 9 bytes. No admite subidas de contenido arbitrario. Mantener el bucket Standard privado, sin `r2.dev` ni dominio; regla de borrado al alcanzar 24 horas.
- El smoke tiene un máximo adicional de 120 peticiones HTTP y 10 intentos de polling; elimina ambos objetos de prueba al completarse. Desactivar `workers.dev` después de la ventana de pruebas y mantener preview URLs desactivadas.

**No es un límite de facturación de la cuenta.** Peticiones rechazadas siguen invocando Workers; las autorizadas después del agotamiento siguen consultando D1. Otros servicios, otros Workers o acceso directo de administradores al bucket quedan fuera del contador. Las alertas de gasto solo notifican; R2 factura excesos. Mantener Workers Free y no aumentar planes/cuotas para hacer pasar una prueba.

## Reproducción explícita

Desde esta carpeta de fixture, con dependencias instaladas:

```bash
npm run build
npm test
PROBE_DATABASE_ID='<D1 aislado>' PROBE_R2_BUCKET='<R2 aislado>' node remote/prepare.mjs
```

El output está en `.wrangler/remote/` (ignorado). `prepare.mjs` no obtiene credenciales, crea recursos ni sube nada. Aplicar `migrations/0001_probe.sql` y `0002_pilot_budget.sql` solo en el D1 del piloto. El upload necesita todos los módulos `.js`/`.mjs`, `pilot.mjs` como `main_module`, bindings DB/FILES, las vars de la configuración y secretos `PROBE_ACCESS_TOKEN`/`PROBE_SECRET`. Verificar plan y controles del bucket antes de habilitar temporalmente la URL.

Provisionar los secretos fuera de Git y suministrar `PROBE_BASE_URL` y `PROBE_ACCESS_TOKEN` al proceso de pruebas mediante un entorno seguro; ejecutar `node remote/smoke.mjs`. No imprimir secretos ni pasarlos como argumentos de shell. No publicar el emisor de sesiones de la fixture sin la protección exterior. Rotar ambas credenciales antes de una nueva ventana, revisar el contador y no ampliar la fecha de expiración sin una decisión explícita.

Los diez assets pequeños se embeben como un módulo base64 para usar el upload del conector sin una sesión JWT separada de subida de assets. Esto prueba contenido estático servido por código Worker, **no el binding nativo ASSETS**, su caché ni su facturación. Cada asset consume una invocación/presupuesto. No usar esta estrategia para el producto.

La prueba `remote-built.test.mjs` ejecuta el artefacto completo en workerd/Miniflare, incluido R2, D1 y una carrera de ocho peticiones con dos plazas libres: exactamente dos pasan y seis reciben 429. No certifica CPU de Cloudflare; los números de CPU deben obtenerse de Observability remoto. El smoke soporta ausencia explícita de R2 (503), pero el piloto registrado sí tiene FILES.
