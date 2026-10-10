# Despliegue dual: fase de viabilidad

Esta carpeta desarrolla la [issue #136](https://github.com/JavierLoro/esigglol/issues/136). **Todavía no permite desplegar esigglol completo en Cloudflare.** Docker/Node continúa siendo el destino soportado.

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
| F0: Workers Free y facturación | Pendiente, sin cuenta ni recursos remotos usados | Medición en una cuenta Free y revisión de activación R2 |
| F1–F6 | Pendientes | GO explícito de F0; PRs incrementales |

No se añade un `deploy:cloudflare` de producto, ni se modifica el esquema SQLite, sus datos, Docker, Compose, backups, GHCR o redeploy. La PoC tiene su propio lockfile y no cambia las versiones de React/Next de la aplicación.

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
