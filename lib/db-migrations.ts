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
      migration.up(db)
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
      ).run(migration.version, migration.name)
    })
    applyMigration()
  }
}
