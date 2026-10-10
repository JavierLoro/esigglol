# PoC local de Workers (F0, issue #136)

Esta fixture comprueba primitivas del runtime. **No es otra versión del producto**, ni un adaptador SQLite/D1 o Local/R2, ni un despliegue completo de esigglol. Reutiliza directamente `lib/player-identity.ts` y `lib/bracket-sizes.ts`. El resto son rutas diagnósticas, proxy y sesión de prueba; no copia pantallas ni autenticación de producción.

Requiere Node 22 o posterior. Desde la raíz:

```bash
npm ci
npm ci --prefix tools/cloudflare-poc
npm run check:app --prefix tools/cloudflare-poc
npm run build --prefix tools/cloudflare-poc
npm test --prefix tools/cloudflare-poc
```

El test arranca el **bundle de producción** de la fixture en workerd mediante `vite preview`, en `127.0.0.1` y puerto efímero. Aplica la migración **local** de la tabla `probe_records`, crea un secreto temporal de prueba (permiso 0600, borrado al terminar) y comprueba:

- SSR/RSC y dos funciones puras importadas de la app; recurso estático y `next/image` sin optimización.
- `proxy.js`, cabecera CSP, cookies HttpOnly/SameSite, JWT válido e inválido y ruta privada con 401.
- Bindings D1/R2, rollback de un batch ante fallo de clave primaria y 8 escrituras CAS concurrentes (1 éxito, 7 conflictos).
- Lectura/escritura/borrado R2, MIME, ETag y 404; efecto corto de `after()` en R2.
- 20 solicitudes secuenciales por caso SSR/JSON/JWT, con latencia local p50/p95. **CPU remota no medida**.

Los datos quedan bajo `.wrangler/`, dentro de esta carpeta. El test comprueba nombre de Worker y el ID D1 ficticio antes de ejecutar. No toca `data/esigglol.db` ni carga `lib/db.ts`/`lib/env.ts`. El inspector está desactivado para funcionar en CI sin descubrimiento de interfaces de red.

## Desarrollo manual

Crear `.dev.vars` aquí, fuera de Git, con un secreto exclusivamente de prueba:

```bash
node -e "console.log('PROBE_SECRET=' + require('node:crypto').randomBytes(32).toString('hex'))" > tools/cloudflare-poc/.dev.vars
cd tools/cloudflare-poc
npx wrangler d1 migrations apply DB --local
npm run dev
```

Para preview manual, el plugin lee los secretos del directorio del bundle. El harness los crea allí después del build y los elimina al terminar; no reescribe un archivo ya existente. Usar `npm test` para esa ruta automatizada.

## Aislamiento y límites

- Lockfile independiente: producto React `19.2.4`, fixture `19.2.6` según peers de vinext. No hay upgrade global ni `--legacy-peer-deps`.
- La configuración local mantiene un D1 ID ficticio, R2 de fixture y `workers_dev`/preview URLs desactivados. El empaquetado [remoto](remote/README.md) es un paso separado y explícito, con credencial, caducidad y presupuesto persistente; no convierte la fixture en una aplicación de producto.
- El workflow solo construye/ejecuta localmente y publica evidencia; no solicita secretos.
- El login de prueba emite sesiones sin contraseña; **no publicar esta fixture como una aplicación segura o de producción**.
- Los batches/CAS diagnósticos no cubren las transacciones anidadas de producto. R2/D1 locales no certifican latencia/consumo/consistencia operativa en cuenta real.
- El estado `after()` es un diagnóstico acotado; no es una cola ni un refresco durable. No se prueban aquí el SSE real, bcrypt, APIs externas ni los assets completos.

Consultar el [gate F0](../../docs/deploy-cloudflare/compatibility.md) y el [piloto remoto](../../docs/deploy-cloudflare/pilot.md).
