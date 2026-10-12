# Despliegue dual: aplicación experimental y viabilidad

Esta carpeta desarrolla la [issue #136](https://github.com/JavierLoro/esigglol/issues/136). La [aplicación completa experimental](application.md) está desplegada con SQLite en Durable Objects, R2 y assets. Docker/Node conserva el destino estable. Los documentos F0 siguientes describen la PoC D1 anterior y su HOLD; no son la arquitectura de la aplicación desplegada.

Orden de lectura:

1. [Compatibilidad y decisión](compatibility.md): estado del gate F0, bloqueos, responsables y pruebas pendientes.
2. [Inventario generado](inventory.md): entradas y señales directas; [JSON](inventory.json) con hashes e imports para revisar dependencias.
3. [PoC](../../tools/cloudflare-poc/README.md): ejecutar la prueba aislada de vinext, D1 y R2 sin cuenta Cloudflare.
4. [Registro de evidencia](evidence.md): resultados locales y lo que no demuestran.
5. [Piloto en cuenta real](pilot.md): requisitos y mediciones que faltan antes del GO.

## Estado y alcance

| Fase | Estado | Condición para avanzar |
|---|---|---|
| F0: inventario y PoC local | Implementados; evidencia local documentada | Completar piloto remoto y decisiones de atomicidad/jobs/CPU |
| F0: Workers Free y facturación | Piloto privado desplegado en Free; R2 Standard activado por el titular | Completar mediciones y paridad del producto; [controles y resultado](pilot.md) |
| Aplicación con Durable Objects | Implementada y desplegada como beta | [Arquitectura, evidencia y gates pendientes](application.md) |

La PoC histórica mantiene su propio lockfile. La adaptación de producto añade comandos cloud, adaptadores y validación independiente; no cambia el esquema del producto, Compose, backups Docker, GHCR ni redeploy. React pasa a 19.2.6; Next.js permanece en 16.2.1.

## Reproducir el inventario

Desde la raíz, después de `npm ci`:

```bash
npm run test:audit-cloudflare
npm run audit:cloudflare
npm run audit:cloudflare -- --check
```

El scanner lee archivos versionados, analiza el AST de TypeScript y sigue imports locales de runtime, re-exports e imports dinámicos literales. Incluye layouts ancestros y el proxy al clasificar las entradas. No importa `lib/db.ts`, no abre bases y no carga secretos. Las referencias SQL y transacciones tienen línea de origen.

Los resultados son conservadores: una dependencia dinámica puede impedir el bundle aunque una rama no se ejecute; un import calculado o un detalle interno de un paquete puede requerir revisión manual. `candidate` no certifica compatibilidad y una señal Node no implica por sí sola incompatibilidad con `nodejs_compat`.

El workflow `cloudflare-feasibility.yml` regenera y publica el inventario de cada commit como artifact. El informe versionado es una instantánea de esta fase; las features futuras no deben editar informes antiguos a mano. No hay credenciales, despliegues ni recursos remotos en ese workflow. La CI/CD de Docker conserva su flujo.
