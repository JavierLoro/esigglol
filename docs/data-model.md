# Modelo de datos — ESIgg.lol

Base de datos SQLite (`./data/esigglol.db`), modo WAL, foreign keys activadas.

---

## Tablas

### `teams`

Almacena equipos. El JSON blob contiene todos los campos del tipo `Team`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | TEXT PRIMARY KEY | ID generado (`team-<ts>-<rand>`) |
| `data` | TEXT NOT NULL | JSON serializado (`Team`) |

**Estructura JSON (`Team`):**
```ts
{
  id: string
  name: string
  logo: string           // ruta relativa a /public (e.g. "/uploads/logo.png")
  players: Player[]
}

// Player
{
  id: string
  summonerName: string   // "Nick#TAG"
  primaryRole: Role      // 'Top'|'Jungle'|'Mid'|'Bot'|'Support'|'Fill'|'Suplente'
  secondaryRole?: Role   // excluye 'Suplente'
}
```

**Nota:** No hay índice en `id` (es PK, ya indexada automáticamente).

---

### `phases`

Almacena fases del torneo ordenadas.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | TEXT PRIMARY KEY | ID generado (`phase-<ts>-<rand>`) |
| `order_` | INTEGER NOT NULL DEFAULT 0 | Orden de visualización (ASC) |
| `data` | TEXT NOT NULL | JSON serializado (`Phase`) |

**Estructura JSON (`Phase`):**
```ts
{
  id: string
  name: string
  type: 'groups' | 'swiss' | 'upper-lower' | 'final-four' | 'elimination'
  status: 'upcoming' | 'active' | 'completed'
  order: number
  config: PhaseConfig
}

// PhaseConfig (campos relevantes por tipo)
{
  bo: 1 | 2 | 3 | 5                          // formato BO por defecto
  // groups:
  advanceCount?: number                        // equipos que pasan por grupo
  groups?: Array<{ id: string; teamIds: string[] }>
  // swiss:
  rounds?: number                              // máximo de rondas
  swissTeamIds?: string[]
  swissSize?: 8 | 16
  advanceWins?: number
  eliminateLosses?: number
  roundBo?: Record<string, 1|2|3|5>           // BO por ronda (clave = string del número)
  confirmedRounds?: number[]                   // rondas visibles al público
  // elimination / final-four / upper-lower:
  bracketTeamIds?: string[]
  include3rdPlace?: boolean                    // solo final-four
  confirmedBracket?: boolean                   // visible al público
}
```

---

### `matches`

Almacena partidos vinculados a una fase.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | TEXT PRIMARY KEY | ID generado (`match-<ts>-<rand>`) |
| `phase_id` | TEXT NOT NULL | Referencia a `phases.id` |
| `data` | TEXT NOT NULL | JSON serializado (`Match`) |

**Índice:** `idx_matches_phase_id ON matches(phase_id)`

**Estructura JSON (`Match`):**
```ts
{
  id: string
  phaseId: string
  round: number               // convenciones: ver docs/tournament-formats.md
  team1Id: string             // teamId o 'TBD'
  team2Id: string             // teamId o 'TBD'
  result: {
    team1Score: number
    team2Score: number
  } | null                    // null = pendiente
  winnerId?: string
  riotMatchIds: string[]      // IDs de partidas en Riot API
  games?: GameData[]          // datos parseados por screenshot (index = game number)
  scheduledAt?: string        // ISO date string
  tournamentCodes?: string[]  // uno por game del BO
}

// GameData
{
  duration: string            // "36:22"
  date?: string               // "03/18/2026"
  winner: 'team1' | 'team2'
  team1Players: GamePlayerData[]
  team2Players: GamePlayerData[]
}

// GamePlayerData
{
  summonerName: string
  championName: string        // DDragon key (e.g. "Yone", "MonkeyKing")
  level: number
  kills: number; deaths: number; assists: number
  cs: number; gold: number
  items: string[]             // hasta 8 (6 items + trinket + boots)
  keystone: string            // nombre del rune principal
}
```

---

### `player_stats`

Caché de stats agregadas de todos los jugadores.

| Columna | Tipo | Descripción |
|---|---|---|
| `key` | TEXT PRIMARY KEY | Siempre `'cache'` (una sola fila) |
| `data` | TEXT NOT NULL | JSON serializado (`PlayerStatsCache`) |

**Estructura JSON:**
```ts
{
  lastUpdated: string | null  // ISO date o null si nunca se refrescó
  players: PlayerRow[]
}

// PlayerRow
{
  summonerName: string; puuid: string; profileIconId: number
  level: number
  tier: RiotTier; rank: RiotRank; lp: number
  wins: number; losses: number; winrate: number
  teamId: string; teamName: string; teamLogo: string
  primaryRole: string; secondaryRole?: string
  apiError?: boolean
}
```

---

### `player_champion_mastery`

Maestría de campeones por jugador (top 50 por defecto).

| Columna | Tipo | Descripción |
|---|---|---|
| `summoner_name` | TEXT NOT NULL | "Nick#TAG" |
| `champion_id` | INTEGER NOT NULL | ID numérico DDragon |
| `champion_name` | TEXT NOT NULL | Nombre DDragon (e.g. "Yone") |
| `mastery_level` | INTEGER NOT NULL | Nivel de maestría (1-7) |
| `mastery_points` | INTEGER NOT NULL | Puntos totales |
| `last_played_at` | INTEGER NOT NULL | Unix timestamp (ms) |
| `updated_at` | TEXT NOT NULL | ISO date de la última actualización |
| **PK** | — | `(summoner_name, champion_id)` |

**Índice:** `idx_player_champion_mastery_summoner ON player_champion_mastery(summoner_name)`

---

### `player_match_history`

Historial de partidas clasificatorias por jugador.

| Columna | Tipo | Descripción |
|---|---|---|
| `summoner_name` | TEXT NOT NULL | "Nick#TAG" |
| `match_id` | TEXT NOT NULL | ID de partida Riot (e.g. "EUW1_7123456789") |
| `champion_id` | INTEGER NOT NULL | ID numérico DDragon |
| `champion_name` | TEXT NOT NULL | Nombre DDragon |
| `position` | TEXT NOT NULL | Posición ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "UNKNOWN") |
| `kills` | INTEGER NOT NULL | |
| `deaths` | INTEGER NOT NULL | |
| `assists` | INTEGER NOT NULL | |
| `win` | INTEGER NOT NULL | 0 = derrota, 1 = victoria |
| `played_at` | INTEGER NOT NULL | Unix timestamp (ms) de inicio de partida |
| `queue_id` | INTEGER NOT NULL | 420 = ranked solo/duo |
| **PK** | — | `(summoner_name, match_id)` |

**Índice:** `idx_player_match_history_summoner ON player_match_history(summoner_name)`

---

### `tournament_config`

Configuración del Riot Tournament API y settings de runtime.

| Columna | Tipo | Descripción |
|---|---|---|
| `key` | TEXT PRIMARY KEY | Clave identificadora |
| `data` | TEXT NOT NULL | JSON serializado del valor |

**Claves conocidas:**

| Key | Tipo del valor | Descripción |
|---|---|---|
| `'tournament'` | `{ providerId: number; tournamentId: number }` | IDs registrados en Riot Tournament API |
| `'riot-api-key'` | `string` | API key de Riot (sobreescribe env var) |

---

## Relaciones y convenciones

- **No hay foreign keys declaradas** entre tablas (SQLite las tiene habilitadas pero no se usan en el schema). La integridad referencial se mantiene en la capa de aplicación.
- Los IDs de equipos (`team1Id`, `team2Id`) en `matches` pueden ser `'TBD'` para slots de bracket no resueltos.
- `order_` en `phases` se mantiene sincronizado con el campo `order` dentro del JSON blob.
- El JSON blob duplica el `id` y el `order`: la columna SQL existe para queries eficientes, el JSON para deserializar el objeto completo.
