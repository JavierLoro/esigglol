import type Database from 'better-sqlite3'

/**
 * A schema migration is deliberately a small synchronous function because the
 * application uses better-sqlite3. The migration and its bookkeeping row are
 * committed together by runMigrations.
 */
export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

/**
 * The first migration is also the baseline for databases created before the
 * migration system existed. Every statement is idempotent, so opening an
 * existing database preserves its rows while registering schema version 1.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teams (
          id    TEXT PRIMARY KEY,
          data  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS phases (
          id     TEXT PRIMARY KEY,
          order_ INTEGER NOT NULL DEFAULT 0,
          data   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS matches (
          id       TEXT PRIMARY KEY,
          phase_id TEXT NOT NULL,
          data     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS player_stats (
          key  TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS player_champion_mastery (
          summoner_name  TEXT    NOT NULL,
          champion_id    INTEGER NOT NULL,
          champion_name  TEXT    NOT NULL,
          mastery_level  INTEGER NOT NULL,
          mastery_points INTEGER NOT NULL,
          last_played_at INTEGER NOT NULL,
          updated_at     TEXT    NOT NULL,
          PRIMARY KEY (summoner_name, champion_id)
        );

        CREATE TABLE IF NOT EXISTS player_match_history (
          summoner_name TEXT    NOT NULL,
          match_id      TEXT    NOT NULL,
          champion_id   INTEGER NOT NULL,
          champion_name TEXT    NOT NULL,
          position      TEXT    NOT NULL,
          kills         INTEGER NOT NULL,
          deaths        INTEGER NOT NULL,
          assists       INTEGER NOT NULL,
          win           INTEGER NOT NULL,
          played_at     INTEGER NOT NULL,
          queue_id      INTEGER NOT NULL,
          PRIMARY KEY (summoner_name, match_id)
        );

        CREATE TABLE IF NOT EXISTS tournament_config (
          key  TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_matches_phase_id ON matches(phase_id);
        CREATE INDEX IF NOT EXISTS idx_player_match_history_summoner ON player_match_history(summoner_name);
        CREATE INDEX IF NOT EXISTS idx_player_champion_mastery_summoner ON player_champion_mastery(summoner_name);
      `)
    },
  },
  {
    version: 2,
    name: 'stable-player-identity',
    up(db) {
      db.exec(`
        ALTER TABLE player_champion_mastery ADD COLUMN player_id TEXT;
        ALTER TABLE player_match_history ADD COLUMN player_id TEXT;
      `)

      const normalize = (value: string) => value.trim().replace(/\s*#\s*/g, '#').toLocaleLowerCase()
      const playerIds = new Map<string, string>()
      const teams = db.prepare('SELECT data FROM teams').all() as Array<{ data: string }>
      for (const row of teams) {
        const team = JSON.parse(row.data) as { players?: Array<{ id: string; summonerName: string }> }
        for (const player of team.players ?? []) playerIds.set(normalize(player.summonerName), player.id)
      }

      const masteryRows = db.prepare('SELECT DISTINCT summoner_name FROM player_champion_mastery').all() as Array<{ summoner_name: string }>
      const historyRows = db.prepare('SELECT DISTINCT summoner_name FROM player_match_history').all() as Array<{ summoner_name: string }>
      const updateMastery = db.prepare('UPDATE player_champion_mastery SET player_id = ? WHERE summoner_name = ?')
      const updateHistory = db.prepare('UPDATE player_match_history SET player_id = ? WHERE summoner_name = ?')
      for (const row of masteryRows) updateMastery.run(playerIds.get(normalize(row.summoner_name)) ?? row.summoner_name, row.summoner_name)
      for (const row of historyRows) updateHistory.run(playerIds.get(normalize(row.summoner_name)) ?? row.summoner_name, row.summoner_name)

      db.exec(`
        CREATE TABLE player_champion_mastery_v2 (
          player_id TEXT NOT NULL, summoner_name TEXT NOT NULL,
          champion_id INTEGER NOT NULL, champion_name TEXT NOT NULL,
          mastery_level INTEGER NOT NULL, mastery_points INTEGER NOT NULL,
          last_played_at INTEGER NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY (player_id, champion_id)
        );
        INSERT OR REPLACE INTO player_champion_mastery_v2
          SELECT player_id, summoner_name, champion_id, champion_name, mastery_level,
                 mastery_points, last_played_at, updated_at
          FROM player_champion_mastery;
        DROP TABLE player_champion_mastery;
        ALTER TABLE player_champion_mastery_v2 RENAME TO player_champion_mastery;

        CREATE TABLE player_match_history_v2 (
          player_id TEXT NOT NULL, summoner_name TEXT NOT NULL,
          match_id TEXT NOT NULL, champion_id INTEGER NOT NULL,
          champion_name TEXT NOT NULL, position TEXT NOT NULL,
          kills INTEGER NOT NULL, deaths INTEGER NOT NULL, assists INTEGER NOT NULL,
          win INTEGER NOT NULL, played_at INTEGER NOT NULL, queue_id INTEGER NOT NULL,
          PRIMARY KEY (player_id, match_id)
        );
        INSERT OR REPLACE INTO player_match_history_v2
          SELECT player_id, summoner_name, match_id, champion_id, champion_name, position,
                 kills, deaths, assists, win, played_at, queue_id
          FROM player_match_history;
        DROP TABLE player_match_history;
        ALTER TABLE player_match_history_v2 RENAME TO player_match_history;

        CREATE INDEX idx_player_champion_mastery_player ON player_champion_mastery(player_id);
        CREATE INDEX idx_player_match_history_player ON player_match_history(player_id);
      `)

      const cacheRow = db.prepare("SELECT data FROM player_stats WHERE key = 'cache'").get() as { data: string } | undefined
      if (cacheRow) {
        const cache = JSON.parse(cacheRow.data) as { players?: Array<{ playerId?: string; summonerName: string }> }
        for (const player of cache.players ?? []) player.playerId ??= playerIds.get(normalize(player.summonerName)) ?? player.summonerName
        db.prepare("UPDATE player_stats SET data = ? WHERE key = 'cache'").run(JSON.stringify(cache))
      }
    },
  },
]

interface AppliedMigration {
  version: number
  name: string
}

function validateMigrations(available: readonly Migration[]): void {
  let previousVersion = 0
  const versions = new Set<number>()

  for (const migration of available) {
    if (!Number.isSafeInteger(migration.version) || migration.version <= 0) {
      throw new Error(`Invalid migration version: ${migration.version}`)
    }
    if (!migration.name.trim()) {
      throw new Error(`Migration ${migration.version} must have a name`)
    }
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    if (migration.version <= previousVersion) {
      throw new Error('Migrations must be ordered by ascending version')
    }
    versions.add(migration.version)
    previousVersion = migration.version
  }
}

function ensureMigrationTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function getAppliedMigrations(db: Database.Database): AppliedMigration[] {
  return db.prepare(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC',
  ).all() as AppliedMigration[]
}

/**
 * Applies every pending migration. Each migration's schema changes and its
 * bookkeeping row are one transaction, so a failed migration cannot leave a
 * partially-applied schema behind.
 */
export function runMigrations(
  db: Database.Database,
  available: readonly Migration[] = migrations,
): void {
  validateMigrations(available)
  ensureMigrationTable(db)

  const applied = getAppliedMigrations(db)
  const availableByVersion = new Map(available.map(migration => [migration.version, migration]))

  for (const [index, migration] of applied.entries()) {
    const definition = availableByVersion.get(migration.version)
    if (!definition) {
      throw new Error(
        `Database migration ${migration.version} (${migration.name}) is newer than this application`,
      )
    }
    if (definition.name !== migration.name) {
      throw new Error(
        `Migration ${migration.version} name changed from ${migration.name} to ${definition.name}`,
      )
    }
    if (available[index]?.version !== migration.version) {
      throw new Error(`Database migration history is missing a migration before version ${migration.version}`)
    }
  }

  const appliedVersions = new Set(applied.map(migration => migration.version))
  for (const migration of available) {
    if (appliedVersions.has(migration.version)) continue

    const applyMigration = db.transaction(() => {
      // Another Next.js worker may have applied it while this connection was
      // waiting for the write lock during parallel page collection.
      const existing = db.prepare('SELECT name FROM schema_migrations WHERE version = ?')
        .get(migration.version) as { name: string } | undefined
      if (existing) {
        if (existing.name !== migration.name) {
          throw new Error(`Migration ${migration.version} name changed from ${existing.name} to ${migration.name}`)
        }
        return
      }
      migration.up(db)
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
      ).run(migration.version, migration.name)
    })
    applyMigration.immediate()
  }
}
