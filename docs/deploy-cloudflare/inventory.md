# Inventario generado de compatibilidad

Generar: `npm run audit:cloudflare`. Verificar: `npm run audit:cloudflare -- --check`.

Base auditada: `51619281f29e4a5c4cfed1f4bb104f0935dc2310`. 174 módulos; 67 entradas.

Análisis conservador de imports de runtime (incluidos dinámicos literales), layouts ancestros y proxy. No ejecuta código de producto. `candidate` significa candidato sin señales detectadas, **no compatible probado**. Las dependencias transitivas de paquetes y los imports calculados requieren revisión manual.

## Señales directas

| Señal | Apariciones |
|---|---:|
| deferred-work | 20 |
| filesystem | 23 |
| module-initialization | 20 |
| module-mutable-state | 7 |
| nested-transaction | 9 |
| node-api | 41 |
| process-global | 123 |
| process-observability | 1 |
| runtime-global | 2 |
| sql-exec | 9 |
| sql-immediate | 34 |
| sql-pragma | 6 |
| sql-prepare | 93 |
| sql-text | 101 |
| sql-transaction | 32 |
| sqlite-native | 6 |

## Entradas (rutas, layouts y proxy)

| Entrada | Estado | Señales transitivas |
|---|---|---|
| `app/admin/(shell)/apariencia/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/equipos/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/fases/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/layout.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/overlay/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/partidos/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/pruebas/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/solicitudes/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/torneos/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/(shell)/valorant/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/admin/login/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/apariencia/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/equipos/[id]/access/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/equipos/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/equipos/upload-logo/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/fases/generate/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/fases/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/login/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/overlay/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/partidos/codes/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/partidos/lobby/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/partidos/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/pruebas/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, runtime-global, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/riot-events/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/settings/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/solicitudes/[id]/approve/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/solicitudes/[id]/reject/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/solicitudes/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/torneos/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/tournament/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/admin/valorant/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/data/equipos/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/data/fases/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/data/torneos/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/ddragon/profileicon/[id]/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/health/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/metrics/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/riot/matches/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/riot/refresh-stats/player/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/riot/refresh-stats/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/riot/summoner/route.ts` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/login/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/matches/[id]/schedule/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/players/[id]/roles/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/requests/logo/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/requests/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/team/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/tournament/callback/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/twitch/status/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/api/uploads/[filename]/route.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/comparar/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/equipo/login/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/equipo/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/equipos/[id]/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/equipos/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/fases/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/layout.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/overlay/fases/[id]/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/overlay/layout.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/overlay/partidos/[id]/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/overlay/torneos/[id]/[view]/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/partidos/[id]/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/partidos/page.tsx` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `app/ranking/page.tsx` | blocked | deferred-work, filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, runtime-global, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |
| `proxy.ts` | blocked | filesystem, module-initialization, module-mutable-state, nested-transaction, node-api, process-global, process-observability, sql-exec, sql-immediate, sql-pragma, sql-prepare, sql-text, sql-transaction, sqlite-native |

## Evidencia directa por módulo

### app/admin/(shell)/equipos/page.tsx

- L38: **deferred-work** — `setTimeout`
- L92: **sql-text** — `DELETE`

### app/admin/(shell)/fases/page.tsx

- L72: **deferred-work** — `setTimeout`
- L149: **sql-text** — `DELETE`

### app/admin/(shell)/layout.tsx

- L23: **module-initialization** — `Set`
- L32: **sql-text** — `DELETE`
- L117: **process-global** — `process.env`
- L117: **process-global** — `process.env`
- L117: **process-global** — `process.env`

### app/admin/(shell)/partidos/page.tsx

- L64: **deferred-work** — `setTimeout`
- L147: **sql-text** — `DELETE`

### app/admin/(shell)/pruebas/page.tsx

- L7: **process-global** — `process.env`
- L7: **process-global** — `process.env`

### app/admin/(shell)/torneos/page.tsx

- L26: **sql-text** — `DELETE`

### app/api/admin/apariencia/route.ts

- L1: **node-api** — `node:crypto`
- L2: **filesystem** — `node:fs/promises`

### app/api/admin/equipos/upload-logo/route.ts

- L8: **filesystem** — `fs/promises`
- L9: **node-api** — `crypto`

### app/api/admin/login/route.ts

- L7: **module-initialization** — `Map`

### app/api/admin/partidos/codes/route.ts

- L8: **node-api** — `crypto`

### app/api/admin/pruebas/route.ts

- L7: **process-global** — `process.env`
- L7: **process-global** — `process.env`

### app/api/admin/riot-events/route.ts

- L27: **deferred-work** — `setInterval`

### app/api/admin/valorant/route.ts

- L8: **process-global** — `process.env`

### app/api/ddragon/profileicon/[id]/route.ts

- L4: **filesystem** — `fs/promises`
- L5: **node-api** — `path`

### app/api/riot/refresh-stats/player/route.ts

- L41: **deferred-work** — `after`

### app/api/riot/refresh-stats/route.ts

- L27: **deferred-work** — `after`

### app/api/team/login/route.ts

- L11: **module-initialization** — `Map`
- L30: **sql-prepare** — `db.prepare`
- L30: **sql-text** — `SELECT data FROM teams WHERE id = ?`

### app/api/team/matches/[id]/schedule/route.ts

- L23: **sql-immediate** — `db.transaction(() => { const match = getTeamPendingMatches(session.teamId).find(match => match.id === id) if (!match) return undefined return updateMatches([{ ...match, version: pa`
- L23: **sql-transaction** — `db.transaction`

### app/api/team/requests/logo/route.ts

- L3: **node-api** — `crypto`
- L4: **filesystem** — `fs/promises`

### app/api/uploads/[filename]/route.ts

- L3: **filesystem** — `fs/promises`

### app/equipo/page.tsx

- L69: **sql-text** — `DELETE`

### app/ranking/page.tsx

- L25: **deferred-work** — `after`

### components/RefreshPlayerButton.tsx

- L49: **deferred-work** — `setTimeout`
- L78: **deferred-work** — `setTimeout`

### components/RefreshStatsButton.tsx

- L50: **deferred-work** — `setTimeout`
- L62: **deferred-work** — `setTimeout`

### components/admin/LogoutButton.tsx

- L6: **sql-text** — `DELETE`

### components/admin/RiotApiKeySettings.tsx

- L24: **deferred-work** — `setTimeout`

### components/admin/TournamentSetup.tsx

- L96: **sql-text** — `DELETE`

### components/overlay/AutoRefresh.tsx

- L9: **deferred-work** — `setInterval`

### lib/admin-client.ts

- L86: **module-initialization** — `Set`
- L87: **module-initialization** — `Set`
- L88: **module-initialization** — `Set`
- L89: **module-initialization** — `Set`
- L90: **module-initialization** — `Set`

### lib/auth.ts

- L6: **module-initialization** — `TextEncoder`

### lib/competition-context.ts

- L1: **node-api** — `node:async_hooks`
- L4: **module-initialization** — `AsyncLocalStorage`

### lib/competition-route.ts

- L21: **sql-prepare** — `db.prepare`
- L21: **sql-text** — `SELECT data FROM teams WHERE id = ?`

### lib/competitions.ts

- L1: **node-api** — `node:crypto`
- L7: **sql-prepare** — `db.prepare`
- L7: **sql-text** — `SELECT data FROM tournaments ORDER BY rowid`
- L11: **sql-prepare** — `db.prepare`
- L11: **sql-text** — `SELECT data FROM tournaments WHERE id = ?`
- L21: **sql-immediate** — `db.transaction(() => { const existing = input.id ? getTournament(input.id) : undefined if (input.id && !existing) throw new Error('Torneo no encontrado') if (existing && (existing.`
- L21: **sql-transaction** — `db.transaction`
- L26: **sql-prepare** — `db.prepare`
- L32: **sql-prepare** — `db.prepare`
- L32: **sql-text** — `INSERT INTO tournaments (id, slug, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data`
- L40: **sql-immediate** — `db.transaction(() => { if (!getTournament(id)) return undefined const teamIds = "SELECT id FROM teams WHERE json_extract(data, '$.tournamentId') = ?" const uploads = db.prepare(' S`
- L40: **sql-transaction** — `db.transaction`
- L42: **sql-text** — `SELECT id FROM teams WHERE json_extract(data, '$.tournamentId') = ?`
- L43: **sql-prepare** — `db.prepare`
- L50: **sql-prepare** — `db.prepare`
- L56: **sql-prepare** — `db.prepare`
- L59: **sql-prepare** — `db.prepare`
- L62: **sql-prepare** — `db.prepare`
- L64: **sql-prepare** — `db.prepare`
- L64: **sql-text** — `DELETE FROM tournaments WHERE id = ?`

### lib/data-riot.ts

- L53: **sql-prepare** — `db.prepare`
- L54: **sql-text** — `SELECT MAX(updated_at) as last FROM player_champion_mastery WHERE player_id = ?`
- L63: **sql-prepare** — `db.prepare`
- L63: **sql-text** — `INSERT OR REPLACE INTO player_champion_mastery (player_id, summoner_name, champion_id, champion_name, mastery_level, mastery_points, last_played_at, updated_at)`
- L68: **sql-transaction** — `db.transaction`
- L77: **sql-prepare** — `db.prepare`
- L77: **sql-text** — `SELECT player_id, summoner_name, champion_id, champion_name, mastery_level, mastery_points, last_played_at, updated_at FROM player_champion_mastery WHERE player`
- L98: **sql-prepare** — `db.prepare`
- L98: **sql-text** — `INSERT OR IGNORE INTO player_match_history (player_id, summoner_name, match_id, champion_id, champion_name, position, kills, deaths, assists, win, played_at, qu`
- L103: **sql-transaction** — `db.transaction`
- L113: **sql-prepare** — `db.prepare`
- L113: **sql-text** — `SELECT match_id FROM player_match_history WHERE player_id = ?`
- L119: **sql-prepare** — `db.prepare`
- L119: **sql-text** — `SELECT player_id, summoner_name, match_id, champion_id, champion_name, position, kills, deaths, assists, win, played_at, queue_id FROM player_match_history WHER`
- L147: **sql-prepare** — `db.prepare`
- L147: **sql-text** — `SELECT champion_name, COUNT(*) AS games, SUM(win) AS wins, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists FROM player_match_history WHERE p`
- L167: **sql-prepare** — `db.prepare`
- L167: **sql-text** — `SELECT champion_name, COUNT(*) AS games, SUM(win) AS wins, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists FROM ( SELECT champion_name, win,`
- L217: **sql-prepare** — `db.prepare`
- L217: **sql-text** — `SELECT champion_name, COUNT(*) AS games, SUM(win) AS wins FROM ( SELECT champion_name, win FROM player_match_history WHERE player_id = ? ORDER BY played_at DESC`

### lib/data.ts

- L28: **sql-prepare** — `db.prepare`
- L28: **sql-text** — `SELECT data, version FROM teams WHERE json_extract(data, '$.tournamentId') = ?`
- L39: **sql-immediate** — `db.transaction(() => { teams = teams.map(prepareEntity) // Bulk replacement is reserved for imports and maintenance scripts. db.transaction(() => { db.prepare("DELETE FROM teams WH`
- L39: **sql-transaction** — `db.transaction`
- L42: **nested-transaction** — `db.transaction`
- L43: **sql-prepare** — `db.prepare`
- L43: **sql-text** — `DELETE FROM teams WHERE json_extract(data, '$.tournamentId') = ?`
- L44: **sql-prepare** — `db.prepare`
- L44: **sql-text** — `INSERT INTO teams (id, data) VALUES (?, ?)`
- L51: **sql-prepare** — `db.prepare`
- L51: **sql-text** — `SELECT data, version FROM teams WHERE id = ?`
- L63: **sql-immediate** — `db.transaction(() => { team = prepareEntity(team) const created = { ...team, version: 1 } db.prepare('INSERT INTO teams (id, data, version) VALUES (?, ?, 1)').run(team.id, JSON.str`
- L63: **sql-transaction** — `db.transaction`
- L66: **sql-prepare** — `db.prepare`
- L66: **sql-text** — `INSERT INTO teams (id, data, version) VALUES (?, ?, 1)`
- L72: **sql-immediate** — `db.transaction(() => { team = prepareEntity(team) if (!team.version) throw new StaleWriteError('Missing entity version') const updated = { ...team, version: team.version + 1 } cons`
- L72: **sql-transaction** — `db.transaction`
- L76: **sql-prepare** — `db.prepare`
- L76: **sql-text** — `UPDATE teams SET data = ?, version = ? WHERE id = ? AND version = ?`
- L84: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable(); owned('teams', id) return db.transaction(() => { const result = db.prepare('DELETE FROM teams WHERE id = ? AND version = ?').run`
- L84: **sql-transaction** — `db.transaction`
- L86: **sql-immediate** — `db.transaction(() => { const result = db.prepare('DELETE FROM teams WHERE id = ? AND version = ?').run(id, version) if (result.changes === 1) { db.prepare('DELETE FROM team_access `
- L86: **nested-transaction** — `db.transaction`
- L87: **sql-prepare** — `db.prepare`
- L87: **sql-text** — `DELETE FROM teams WHERE id = ? AND version = ?`
- L89: **sql-prepare** — `db.prepare`
- L89: **sql-text** — `DELETE FROM team_access WHERE team_id = ?`
- L90: **sql-prepare** — `db.prepare`
- L90: **sql-text** — `DELETE FROM team_change_requests WHERE team_id = ?`
- L99: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable(); owned('teams', teamId) const update = db.transaction(() => { const team = getTeamById(teamId) if (!team) return undefined const `
- L99: **sql-transaction** — `db.transaction`
- L101: **nested-transaction** — `db.transaction`
- L107: **sql-prepare** — `db.prepare`
- L107: **sql-text** — `UPDATE teams SET data = ?, version = ? WHERE id = ? AND version = ?`
- L146: **sql-prepare** — `db.prepare`
- L146: **sql-text** — `SELECT data, version FROM phases WHERE json_extract(data, '$.tournamentId') = ? ORDER BY order_ ASC`
- L151: **sql-immediate** — `db.transaction(() => { phases = phases.map(prepareEntity) // Bulk replacement is reserved for imports and maintenance scripts. db.transaction(() => { db.prepare("DELETE FROM phases`
- L151: **sql-transaction** — `db.transaction`
- L154: **nested-transaction** — `db.transaction`
- L155: **sql-prepare** — `db.prepare`
- L155: **sql-text** — `DELETE FROM phases WHERE json_extract(data, '$.tournamentId') = ?`
- L156: **sql-prepare** — `db.prepare`
- L156: **sql-text** — `INSERT INTO phases (id, order_, data) VALUES (?, ?, ?)`
- L163: **sql-immediate** — `db.transaction(() => { phase = prepareEntity(phase) db.prepare('INSERT OR REPLACE INTO phases (id, order_, data) VALUES (?, ?, ?)') .run(phase.id, phase.order, JSON.stringify(phase`
- L163: **sql-transaction** — `db.transaction`
- L165: **sql-prepare** — `db.prepare`
- L165: **sql-text** — `INSERT OR REPLACE INTO phases (id, order_, data) VALUES (?, ?, ?)`
- L171: **sql-prepare** — `db.prepare`
- L171: **sql-text** — `SELECT data, version FROM phases WHERE id = ?`
- L176: **sql-immediate** — `db.transaction(() => { phase = prepareEntity(phase) const created = { ...phase, version: 1 } db.prepare('INSERT INTO phases (id, order_, data, version) VALUES (?, ?, ?, 1)').run(ph`
- L176: **sql-transaction** — `db.transaction`
- L179: **sql-prepare** — `db.prepare`
- L179: **sql-text** — `INSERT INTO phases (id, order_, data, version) VALUES (?, ?, ?, 1)`
- L185: **sql-immediate** — `db.transaction(() => { phase = prepareEntity(phase) if (!phase.version) throw new StaleWriteError('Missing entity version') const updated = { ...phase, version: phase.version + 1 }`
- L185: **sql-transaction** — `db.transaction`
- L189: **sql-prepare** — `db.prepare`
- L189: **sql-text** — `UPDATE phases SET order_ = ?, data = ?, version = ? WHERE id = ? AND version = ?`
- L197: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable(); owned('phases', id) return db.transaction(() => { const result = db.prepare('DELETE FROM phases WHERE id = ? AND version = ?').r`
- L197: **sql-transaction** — `db.transaction`
- L199: **sql-immediate** — `db.transaction(() => { const result = db.prepare('DELETE FROM phases WHERE id = ? AND version = ?').run(id, version) if (result.changes === 1) db.prepare('DELETE FROM matches WHERE`
- L199: **nested-transaction** — `db.transaction`
- L200: **sql-prepare** — `db.prepare`
- L200: **sql-text** — `DELETE FROM phases WHERE id = ? AND version = ?`
- L201: **sql-prepare** — `db.prepare`
- L201: **sql-text** — `DELETE FROM matches WHERE phase_id = ?`
- L210: **sql-prepare** — `db.prepare`
- L210: **sql-text** — `SELECT data, version FROM matches WHERE json_extract(data, '$.tournamentId') = ?`
- L215: **sql-immediate** — `db.transaction(() => { matches = matches.map(prepareEntity) // Bulk replacement is reserved for imports and maintenance scripts. db.transaction(() => { db.prepare("DELETE FROM matc`
- L215: **sql-transaction** — `db.transaction`
- L218: **nested-transaction** — `db.transaction`
- L219: **sql-prepare** — `db.prepare`
- L219: **sql-text** — `DELETE FROM matches WHERE json_extract(data, '$.tournamentId') = ?`
- L220: **sql-prepare** — `db.prepare`
- L220: **sql-text** — `INSERT INTO matches (id, phase_id, data) VALUES (?, ?, ?)`
- L227: **sql-immediate** — `db.transaction(() => { match = prepareEntity(match) db.prepare('INSERT OR REPLACE INTO matches (id, phase_id, data) VALUES (?, ?, ?)') .run(match.id, match.phaseId, JSON.stringify(`
- L227: **sql-transaction** — `db.transaction`
- L229: **sql-prepare** — `db.prepare`
- L229: **sql-text** — `INSERT OR REPLACE INTO matches (id, phase_id, data) VALUES (?, ?, ?)`
- L235: **sql-prepare** — `db.prepare`
- L235: **sql-text** — `SELECT data, version FROM matches WHERE phase_id = ?`
- L240: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable(); for (const id of ids) owned('matches', id) if (ids.length === 0) return const placeholders = ids.map(() => '?').join(',') db.pre`
- L240: **sql-transaction** — `db.transaction`
- L244: **sql-prepare** — `db.prepare`
- L249: **sql-prepare** — `db.prepare`
- L249: **sql-text** — `SELECT data, version FROM matches WHERE id = ?`
- L254: **sql-immediate** — `db.transaction(() => { matches = matches.map(prepareEntity) const insert = db.prepare('INSERT INTO matches (id, phase_id, data, version) VALUES (?, ?, ?, 1)') return db.transaction`
- L254: **sql-transaction** — `db.transaction`
- L256: **sql-prepare** — `db.prepare`
- L256: **sql-text** — `INSERT INTO matches (id, phase_id, data, version) VALUES (?, ?, ?, 1)`
- L257: **nested-transaction** — `db.transaction`
- L266: **sql-immediate** — `db.transaction(() => { matches = matches.map(prepareEntity) const stmt = db.prepare('UPDATE matches SET phase_id = ?, data = ?, version = ? WHERE id = ? AND version = ?') return db`
- L266: **sql-transaction** — `db.transaction`
- L268: **sql-prepare** — `db.prepare`
- L268: **sql-text** — `UPDATE matches SET phase_id = ?, data = ?, version = ? WHERE id = ? AND version = ?`
- L269: **sql-immediate** — `db.transaction((items: Match[]) => items.map(match => { if (!match.version) throw new StaleWriteError('Missing entity version') const updated = { ...match, version: match.version +`
- L269: **nested-transaction** — `db.transaction`
- L279: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable(); for (const id of Object.keys(versions)) owned('matches', id) const stmt = db.prepare('DELETE FROM matches WHERE id = ? AND versi`
- L279: **sql-transaction** — `db.transaction`
- L281: **sql-prepare** — `db.prepare`
- L281: **sql-text** — `DELETE FROM matches WHERE id = ? AND version = ?`
- L282: **sql-immediate** — `db.transaction((entries: Array<[string, number]>) => { for (const [id, version] of entries) if (stmt.run(id, version).changes !== 1) throw new StaleWriteError('Match was modified')`
- L282: **nested-transaction** — `db.transaction`
- L294: **sql-immediate** — `db.transaction(() => { const deleted = deleteMatchesVersioned(deleteVersions) const updatedMatches = updateMatches(matches) const updatedPhases = phases.map(updatePhase) return { m`
- L294: **sql-transaction** — `db.transaction`
- L310: **sql-prepare** — `db.prepare`
- L310: **sql-text** — `SELECT data FROM player_stats WHERE key = ?`
- L318: **sql-prepare** — `db.prepare`
- L318: **sql-text** — `INSERT OR REPLACE INTO player_stats (key, data) VALUES (?, ?)`
- L325: **sql-prepare** — `db.prepare`
- L325: **sql-text** — `SELECT data FROM tournament_config WHERE key = ?`
- L329: **process-global** — `process.env`
- L333: **sql-prepare** — `db.prepare`
- L333: **sql-text** — `INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)`
- L351: **sql-prepare** — `db.prepare`
- L358: **sql-prepare** — `db.prepare`
- L370: **sql-prepare** — `db.prepare`
- L370: **sql-text** — `SELECT data FROM teams WHERE id != ?`

### lib/db-migrations.ts

- L24: **sql-exec** — `db.exec`
- L24: **sql-text** — `CREATE TABLE IF NOT EXISTS teams ( id TEXT PRIMARY KEY, data TEXT NOT NULL ); CREATE TABLE IF NOT EXISTS phases ( id TEXT PRIMARY KEY, order_ INTEGER NOT NULL D`
- L88: **sql-exec** — `db.exec`
- L88: **sql-text** — `ALTER TABLE player_champion_mastery ADD COLUMN player_id TEXT; ALTER TABLE player_match_history ADD COLUMN player_id TEXT;`
- L95: **sql-prepare** — `db.prepare`
- L95: **sql-text** — `SELECT data FROM teams`
- L101: **sql-prepare** — `db.prepare`
- L101: **sql-text** — `SELECT DISTINCT summoner_name FROM player_champion_mastery`
- L102: **sql-prepare** — `db.prepare`
- L102: **sql-text** — `SELECT DISTINCT summoner_name FROM player_match_history`
- L103: **sql-prepare** — `db.prepare`
- L103: **sql-text** — `UPDATE player_champion_mastery SET player_id = ? WHERE summoner_name = ?`
- L104: **sql-prepare** — `db.prepare`
- L104: **sql-text** — `UPDATE player_match_history SET player_id = ? WHERE summoner_name = ?`
- L108: **sql-exec** — `db.exec`
- L108: **sql-text** — `CREATE TABLE player_champion_mastery_v2 ( player_id TEXT NOT NULL, summoner_name TEXT NOT NULL, champion_id INTEGER NOT NULL, champion_name TEXT NOT NULL, maste`
- L142: **sql-prepare** — `db.prepare`
- L142: **sql-text** — `SELECT data FROM player_stats WHERE key = 'cache'`
- L146: **sql-prepare** — `db.prepare`
- L146: **sql-text** — `UPDATE player_stats SET data = ? WHERE key = 'cache'`
- L154: **sql-exec** — `db.exec`
- L154: **sql-text** — `ALTER TABLE teams ADD COLUMN version INTEGER NOT NULL DEFAULT 1; ALTER TABLE phases ADD COLUMN version INTEGER NOT NULL DEFAULT 1; ALTER TABLE matches ADD COLUM`
- L165: **sql-exec** — `db.exec`
- L165: **sql-text** — `CREATE TABLE team_access ( team_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, password_encrypted TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, session_`
- L197: **sql-exec** — `db.exec`
- L197: **sql-text** — `CREATE TABLE tournaments (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL);`
- L199: **sql-prepare** — `db.prepare`
- L199: **sql-text** — `INSERT INTO tournaments VALUES (?, ?, ?)`
- L201: **sql-exec** — `db.exec`
- L204: **sql-exec** — `db.exec`
- L204: **sql-text** — `UPDATE player_stats SET key = 'legacy-lol:cache' WHERE key = 'cache'; UPDATE tournament_config SET key = 'legacy-lol:' || key WHERE key != 'riot-api-key';`
- L238: **sql-exec** — `db.exec`
- L238: **sql-text** — `CREATE TABLE IF NOT EXISTS schema_migrations ( version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )`
- L248: **sql-prepare** — `db.prepare`
- L249: **sql-text** — `SELECT version, name FROM schema_migrations ORDER BY version ASC`
- L289: **sql-transaction** — `db.transaction`
- L292: **sql-prepare** — `db.prepare`
- L292: **sql-text** — `SELECT name FROM schema_migrations WHERE version = ?`
- L301: **sql-prepare** — `db.prepare`
- L302: **sql-text** — `INSERT INTO schema_migrations (version, name) VALUES (?, ?)`
- L305: **sql-immediate** — `applyMigration.immediate`

### lib/db.ts

- L1: **sqlite-native** — `better-sqlite3`
- L2: **node-api** — `path`
- L3: **filesystem** — `fs`
- L6: **process-global** — `process.env`
- L6: **process-global** — `process.cwd`
- L9: **module-mutable-state** — `let _db: Database.Database | null = null`
- L15: **sql-pragma** — `_db.pragma`
- L16: **sql-pragma** — `_db.pragma`
- L17: **sql-pragma** — `_db.pragma`
- L23: **module-initialization** — `getDb`

### lib/ddragon.ts

- L1: **filesystem** — `node:fs`
- L2: **node-api** — `node:path`
- L12: **process-global** — `process.cwd`
- L13: **process-global** — `process.cwd`
- L142: **module-mutable-state** — `let _championNameMapCache: Map<string, string> | null = null`

### lib/env.ts

- L5: **node-api** — `path`
- L6: **filesystem** — `fs`
- L9: **process-global** — `process.env`
- L24: **process-global** — `process.env`
- L32: **process-global** — `process.env`
- L46: **process-global** — `process.env`
- L50: **process-global** — `process.env`
- L52: **process-global** — `process.cwd`
- L61: **process-global** — `process.env`
- L65: **process-global** — `process.env`
- L66: **process-global** — `process.env`
- L67: **process-global** — `process.env`
- L68: **process-global** — `process.env`
- L78: **process-global** — `process.env`
- L82: **process-global** — `process.env`
- L82: **process-global** — `process.cwd`
- L95: **process-global** — `process.env`

### lib/logger.ts

- L4: **process-global** — `process.env`
- L5: **process-global** — `process.env`

### lib/logo-cleanup.ts

- L1: **filesystem** — `node:fs`
- L14: **sql-immediate** — `db.transaction(() => { const referenced = db.prepare(' SELECT 1 FROM teams WHERE json_extract(data, '$.logo') = ? UNION ALL SELECT 1 FROM team_change_requests WHERE status = 'pendi`
- L14: **sql-transaction** — `db.transaction`
- L15: **sql-prepare** — `db.prepare`
- L15: **sql-text** — `SELECT 1 FROM teams WHERE json_extract(data, '$.logo') = ? UNION ALL SELECT 1 FROM team_change_requests WHERE status = 'pending' AND type = 'team_logo' AND json`

### lib/metrics.ts

- L1: **process-observability** — `prom-client`
- L3: **module-initialization** — `Registry`
- L7: **module-initialization** — `Histogram`
- L15: **module-initialization** — `Counter`

### lib/overlay-data.ts

- L8: **sql-prepare** — `db.prepare`
- L8: **sql-text** — `SELECT data FROM tournament_config WHERE key = ?`
- L13: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() const error = overlayConfigError(config, getPhases(), getMatches()) if (error) return error db.prepare('INSERT OR REPLACE INTO to`
- L13: **sql-transaction** — `db.transaction`
- L17: **sql-prepare** — `db.prepare`
- L17: **sql-text** — `INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)`

### lib/public-competition.ts

- L13: **sql-prepare** — `db.prepare`

### lib/publication.ts

- L3: **module-initialization** — `Set`

### lib/refresh.ts

- L2: **filesystem** — `fs`
- L3: **node-api** — `path`
- L15: **deferred-work** — `setTimeout`
- L17: **module-initialization** — `Map`
- L31: **process-global** — `process.cwd`

### lib/riot-events.ts

- L13: **module-initialization** — `Set`

### lib/riot.ts

- L27: **module-initialization** — `Map`
- L61: **deferred-work** — `setTimeout`
- L70: **deferred-work** — `setTimeout`

### lib/site-branding.ts

- L9: **sql-prepare** — `db.prepare`
- L9: **sql-text** — `SELECT data FROM tournament_config WHERE key = ?`
- L13: **sql-prepare** — `db.prepare`
- L13: **sql-text** — `INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)`

### lib/team-credentials.ts

- L1: **node-api** — `crypto`

### lib/team-portal-data.ts

- L57: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() if (!getTeamById(teamId)) throw new Error('Equipo fuera del torneo') db.prepare('INSERT INTO team_access (team_id, password_hash,`
- L57: **sql-transaction** — `db.transaction`
- L60: **sql-prepare** — `db.prepare`
- L60: **sql-text** — `INSERT INTO team_access (team_id, password_hash, password_encrypted) VALUES (?, ?, ?)`
- L68: **sql-prepare** — `db.prepare`
- L68: **sql-text** — `SELECT teams.id FROM teams LEFT JOIN team_access ON team_access.team_id = teams.id WHERE team_access.team_id IS NULL AND json_extract(teams.data, '$.tournamentI`
- L96: **sql-prepare** — `db.prepare`
- L96: **sql-text** — `SELECT * FROM team_access WHERE team_id = ?`
- L101: **sql-prepare** — `db.prepare`
- L101: **sql-text** — `SELECT * FROM team_access WHERE team_id = ?`
- L106: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() if (!getTeamById(teamId)) throw new Error('Equipo fuera del torneo') db.prepare('INSERT INTO team_access (team_id, password_hash,`
- L106: **sql-transaction** — `db.transaction`
- L109: **sql-prepare** — `db.prepare`
- L109: **sql-text** — `INSERT INTO team_access (team_id, password_hash, password_encrypted, enabled) VALUES (?, ?, ?, 1) ON CONFLICT(team_id) DO UPDATE SET password_hash = excluded.pa`
- L118: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() if (!getTeamById(teamId)) throw new Error('Equipo fuera del torneo') if (db.prepare('UPDATE team_access SET enabled = ?, session_`
- L118: **sql-transaction** — `db.transaction`
- L121: **sql-prepare** — `db.prepare`
- L121: **sql-text** — `UPDATE team_access SET enabled = ?, session_version = session_version + 1 WHERE team_id = ?`
- L127: **sql-prepare** — `db.prepare`
- L127: **sql-text** — `UPDATE team_access SET last_login_at = CURRENT_TIMESTAMP WHERE team_id = ?`
- L131: **sql-immediate** — `db.transaction(() => { const created = createTeam(team) createTeamAccess(team.id, passwordHash, encryptedPassword) return created }).immediate`
- L131: **sql-transaction** — `db.transaction`
- L148: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() if (!getTeamById(teamId)) throw new Error('Equipo fuera del torneo') const duplicate = db.prepare('SELECT id FROM team_change_req`
- L148: **sql-transaction** — `db.transaction`
- L151: **sql-prepare** — `db.prepare`
- L151: **sql-text** — `SELECT id FROM team_change_requests WHERE team_id = ? AND type = ? AND COALESCE(player_id, '') = COALESCE(?, '') AND status = 'pending'`
- L155: **sql-prepare** — `db.prepare`
- L155: **sql-text** — `INSERT INTO team_change_requests (id, team_id, type, player_id, payload) VALUES (?, ?, ?, ?, ?)`
- L162: **sql-prepare** — `db.prepare`
- L162: **sql-text** — `SELECT * FROM team_change_requests WHERE id = ?`
- L168: **sql-prepare** — `db.prepare`
- L168: **sql-text** — `SELECT * FROM team_change_requests WHERE team_id = ? ORDER BY created_at DESC`
- L169: **sql-prepare** — `db.prepare`
- L169: **sql-text** — `SELECT * FROM team_change_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC`
- L174: **sql-immediate** — `db.transaction(() => { assertCompetitionWritable() if (!getTeamChangeRequest(id)) return undefined const result = db.prepare('UPDATE team_change_requests SET status = 'rejected', r`
- L174: **sql-transaction** — `db.transaction`
- L177: **sql-prepare** — `db.prepare`
- L177: **sql-text** — `UPDATE team_change_requests SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ? AND status = 'pending'`
- L184: **sql-immediate** — `db.transaction(() => { const request = getTeamChangeRequest(id) if (!request || request.status !== 'pending') return undefined const team = getTeamById(request.teamId) if (!team) t`
- L184: **sql-transaction** — `db.transaction`
- L206: **sql-prepare** — `db.prepare`
- L206: **sql-text** — `UPDATE team_change_requests SET status = 'approved', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`

### lib/tournament.ts

- L74: **deferred-work** — `setTimeout`
- L159: **sql-prepare** — `db.prepare`
- L159: **sql-text** — `SELECT data FROM tournament_config WHERE key = ?`
- L164: **sql-prepare** — `db.prepare`
- L165: **sql-text** — `INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)`
- L171: **sql-prepare** — `db.prepare`
- L171: **sql-text** — `DELETE FROM tournament_config WHERE key = ?`

### lib/twitch.ts

- L16: **module-mutable-state** — `let cachedStatus: { channel: string; value: TwitchStatusResult; expiresAt: number } | undefined`
- L17: **module-mutable-state** — `let cachedToken: { value: string; expiresAt: number } | undefined`
- L18: **module-mutable-state** — `let statusRequest: { channel: string; promise: Promise<TwitchStatusResult> } | undefined`

### lib/upload-files.ts

- L1: **node-api** — `path`

### lib/valorant-assets.ts

- L1: **filesystem** — `node:fs`
- L2: **node-api** — `node:path`
- L15: **process-global** — `process.cwd`

### lib/valorant-ranking.ts

- L51: **module-mutable-state** — `let activeKey: string | undefined`
- L52: **module-mutable-state** — `let activeLoader = createRankingLoader()`

### lib/valorant-runtime-key.ts

- L3: **runtime-global** — `globalThis`
- L3: **runtime-global** — `globalThis`
- L5: **process-global** — `process.env`
- L5: **process-global** — `process.env`
- L6: **process-global** — `process.env`
- L8: **process-global** — `process.env`
- L11: **process-global** — `process.env`
- L11: **process-global** — `process.env`
- L13: **process-global** — `process.env`

### lib/valorant.ts

- L14: **process-global** — `process.env`

### next.config.ts

- L2: **node-api** — `os`
- L20: **process-global** — `process.env`
- L28: **process-global** — `process.env`

### scripts/audit-cloudflare.mjs

- L1: **node-api** — `node:child_process`
- L2: **node-api** — `node:crypto`
- L3: **filesystem** — `node:fs`
- L4: **node-api** — `node:module`
- L5: **node-api** — `node:path`
- L6: **node-api** — `node:url`
- L10: **module-initialization** — `Set`
- L130: **process-global** — `process.argv`
- L137: **process-global** — `process.argv`
- L137: **process-global** — `process.argv`

### scripts/backup-sqlite.ts

- L15: **sqlite-native** — `better-sqlite3`
- L16: **node-api** — `crypto`
- L17: **filesystem** — `fs`
- L18: **filesystem** — `fs/promises`
- L19: **node-api** — `path`
- L21: **process-global** — `process.cwd`
- L22: **process-global** — `process.cwd`
- L27: **process-global** — `process.env`
- L34: **process-global** — `process.env`
- L38: **process-global** — `process.env`
- L42: **process-global** — `process.env`
- L46: **process-global** — `process.env`
- L62: **sql-pragma** — `db.pragma`
- L63: **sql-pragma** — `db.pragma`
- L139: **deferred-work** — `setTimeout`
- L153: **process-global** — `process.env`
- L172: **process-global** — `process.argv`
- L193: **process-global** — `process.argv`
- L196: **process-global** — `process.exitCode`

### scripts/collect-stats-dev.ts

- L11: **filesystem** — `fs`
- L12: **node-api** — `path`
- L13: **sqlite-native** — `better-sqlite3`
- L19: **process-global** — `process.env`
- L20: **process-global** — `process.exit`
- L22: **process-global** — `process.env`
- L58: **module-initialization** — `RateLimiter`
- L70: **deferred-work** — `setTimeout`
- L76: **process-global** — `process.cwd`
- L155: **process-global** — `process.stdout`
- L167: **process-global** — `process.argv`
- L169: **process-global** — `process.cwd`
- L170: **sql-prepare** — `db.prepare`
- L170: **sql-text** — `SELECT data FROM teams`
- L181: **process-global** — `process.exit`
- L214: **process-global** — `process.exit`

### scripts/collect-stats-prod.ts

- L12: **filesystem** — `fs`
- L13: **node-api** — `path`
- L14: **sqlite-native** — `better-sqlite3`
- L20: **process-global** — `process.env`
- L21: **process-global** — `process.exit`
- L23: **process-global** — `process.env`
- L49: **deferred-work** — `setTimeout`
- L55: **process-global** — `process.cwd`
- L178: **process-global** — `process.argv`
- L180: **process-global** — `process.cwd`
- L181: **sql-prepare** — `db.prepare`
- L181: **sql-text** — `SELECT data FROM teams`
- L192: **process-global** — `process.exit`
- L213: **process-global** — `process.exit`

### scripts/gen-password-hash.ts

- L3: **process-global** — `process.argv`
- L7: **process-global** — `process.exit`

### scripts/generate-session-secret.ts

- L1: **node-api** — `node:crypto`

### scripts/load-env.ts

- L4: **filesystem** — `fs`
- L5: **node-api** — `path`
- L8: **process-global** — `process.env`
- L9: **process-global** — `process.cwd`

### scripts/restore-sqlite.ts

- L11: **sqlite-native** — `better-sqlite3`
- L12: **node-api** — `crypto`
- L13: **filesystem** — `fs`
- L14: **filesystem** — `fs/promises`
- L15: **node-api** — `path`
- L17: **process-global** — `process.env`
- L17: **process-global** — `process.cwd`
- L22: **sql-pragma** — `db.pragma`
- L32: **process-global** — `process.argv`
- L87: **process-global** — `process.exitCode`

### scripts/seed-data.ts

- L2: **node-api** — `node:util`

### scripts/start-e2e.ts

- L2: **filesystem** — `node:fs`
- L3: **node-api** — `node:path`
- L4: **node-api** — `node:util`
- L5: **node-api** — `node:child_process`
- L8: **process-global** — `process.cwd`
- L13: **process-global** — `process.cwd`
- L14: **process-global** — `process.execPath`
- L16: **process-global** — `process.env`
- L26: **process-global** — `process.exit`
- L29: **process-global** — `process.on`

### scripts/start-valorant-sandbox.ts

- L2: **node-api** — `node:crypto`
- L3: **node-api** — `node:path`
- L4: **node-api** — `node:child_process`
- L9: **process-global** — `process.env`
- L9: **process-global** — `process.cwd`
- L10: **process-global** — `process.env`
- L12: **process-global** — `process.env`
- L13: **process-global** — `process.env`
- L14: **process-global** — `process.env`
- L15: **process-global** — `process.env`
- L16: **process-global** — `process.env`
- L17: **process-global** — `process.env`
- L33: **process-global** — `process.env`
- L34: **process-global** — `process.execPath`
- L34: **process-global** — `process.cwd`
- L35: **process-global** — `process.env`
- L35: **process-global** — `process.env`
- L37: **process-global** — `process.exit`
- L38: **process-global** — `process.on`

### scripts/sync-ddragon.ts

- L5: **process-global** — `process.exit`

### scripts/sync-valorant.ts

- L1: **filesystem** — `node:fs`
- L2: **filesystem** — `node:fs/promises`
- L3: **node-api** — `node:path`
- L4: **node-api** — `node:crypto`
- L5: **node-api** — `node:stream`
- L6: **node-api** — `node:stream/promises`
- L47: **process-global** — `process.argv`
- L47: **process-global** — `process.cwd`
- L54: **process-global** — `process.argv`
- L55: **process-global** — `process.argv`
- L99: **process-global** — `process.argv`
- L99: **process-global** — `process.exitCode`

### scripts/test-riot-api.ts

- L3: **process-global** — `process.env`
- L6: **process-global** — `process.exit`
- L9: **process-global** — `process.env`
- L15: **process-global** — `process.stdout`
- L31: **process-global** — `process.argv`
- L34: **process-global** — `process.exit`
- L176: **process-global** — `process.exit`

### scripts/test-valorant-api.ts

- L5: **process-global** — `process.env`
- L5: **process-global** — `process.env`
- L5: **process-global** — `process.env`
- L5: **process-global** — `process.env`

### scripts/verify-tournament-migration.ts

- L1: **sqlite-native** — `better-sqlite3`
- L2: **filesystem** — `node:fs`
- L3: **node-api** — `node:path`
- L4: **node-api** — `node:util`
- L8: **process-global** — `process.argv`
- L17: **sql-text** — `SELECT MAX(version) AS version FROM schema_migrations`
- L37: **process-global** — `process.exitCode`
