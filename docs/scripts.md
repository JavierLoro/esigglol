# Scripts de utilidad — ESIgg.lol

Todos los scripts están en `scripts/` y se ejecutan con `npx tsx scripts/<nombre>.ts`.

---

## `gen-password-hash.ts`

Genera un hash bcrypt (coste 12) para la contraseña de admin.

**Cuándo usarlo:** Al configurar o cambiar la contraseña de admin por primera vez o cuando se rota.

**Uso:**
```bash
npx tsx scripts/gen-password-hash.ts <nueva-password>
```

**Salida:** Hash bcrypt listo para copiar en `.env.local`.

**Importante:** El hash contiene `$` — en `.env.local` debe ir entre comillas simples:
```
ADMIN_PASSWORD_HASH='$2b$12$...'
```
Reiniciar el servidor para que tome efecto.

---

## `sync-ddragon.ts`

Descarga y cachea los assets de DDragon (datos de campeones, versión del juego).

**Cuándo usarlo:** Se ejecuta **automáticamente** mediante los hooks `predev` y `prebuild` de npm. No es necesario invocarlo manualmente salvo que se quiera forzar una actualización sin arrancar el servidor.

**Uso:**
```bash
npx tsx scripts/sync-ddragon.ts
# O vía npm:
npm run dev    # ejecuta sync-ddragon antes de arrancar
npm run build  # ejecuta sync-ddragon antes de compilar
```

**Qué hace:**
1. Consulta la versión más reciente de DDragon desde la API de Riot.
2. Si la versión local (`data/ddragon-version.txt`) ya está actualizada, no hace nada.
3. Descarga `champion.json` y lo guarda en `public/ddragon/`.

**Nota:** Si la versión de DDragon queda desactualizada, las URLs de iconos de campeón/item se rompen en la UI.

---

## `load-env.ts`

Utilidad interna que carga variables de entorno desde `.env.local` en el proceso actual.

**No se invoca directamente.** Es importado al inicio de los scripts que necesitan acceder a variables de entorno (`import './load-env'`).

---

## `test-riot-api.ts`

Comprueba la conectividad con la Riot API usando la API key configurada.

**Cuándo usarlo:** Para verificar que la API key es válida, especialmente tras rotar la clave (las dev keys expiran cada 24h).

**Uso:**
```bash
npx tsx scripts/test-riot-api.ts
```

**Requiere:** `RIOT_API_KEY` en `.env.local`.

**No se ejecuta en CI.** Es una herramienta de diagnóstico manual.

---

## `collect-stats-dev.ts`

Recolecta y almacena en la DB las stats de jugadores (maestría + historial de partidas) respetando los límites de una **dev key** de Riot (100 req/120s).

**Cuándo usarlo:**
- Antes de actualizar el ranking por primera vez en un entorno de desarrollo.
- Tras añadir nuevos jugadores a la DB.
- Si el ranking público muestra datos obsoletos y el botón de refresh en la app es demasiado lento.

**Uso:**
```bash
# Todos los jugadores en la DB:
npm run collect-stats-dev

# Solo un jugador concreto:
npm run collect-stats-dev "Nombre#TAG"
```

**Rate limiting:** 95 req/122s (con margen sobre el límite real). 100ms entre requests. En DB con muchos jugadores puede tardar varios minutos.

**Diferencias con `collect-stats-prod.ts`:** La versión dev usa concurrencia y delays más conservadores para no agotar la dev key.

---

## `collect-stats-prod.ts`

Igual que `collect-stats-dev.ts` pero con mayor concurrencia, pensado para una **production key** de Riot con rate limits más altos.

**Cuándo usarlo:** En el entorno de producción con una API key de producción (no la dev key que expira cada 24h).

**Uso:**
```bash
npm run collect-stats-prod
npm run collect-stats-prod "Nombre#TAG"
```

**No se ejecuta automáticamente.** Debe lanzarse manualmente o via cron externo.

---

## `seed-data.ts`

Carga datos de ejemplo/prueba en la base de datos (equipos, fases, partidos ficticios).

**Cuándo usarlo:** Para poblar una instancia vacía en desarrollo o para demostración.

**Uso:**
```bash
npx tsx scripts/seed-data.ts
```

**Advertencia:** Borra y reemplaza los datos existentes. No usar en producción.

---

## Resumen

| Script | npm script | Automático | Entorno |
|---|---|---|---|
| `gen-password-hash.ts` | — | No | Setup |
| `sync-ddragon.ts` | `predev`, `prebuild` | Sí | Dev + Prod |
| `load-env.ts` | — | Import interno | — |
| `test-riot-api.ts` | — | No | Diagnóstico |
| `collect-stats-dev.ts` | `collect-stats-dev` | No | Dev |
| `collect-stats-prod.ts` | `collect-stats-prod` | No | Prod |
| `seed-data.ts` | — | No | Dev |
