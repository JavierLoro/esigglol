import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { migrations, runMigrations, type Migration } from '../db-migrations'

const openDatabases: Database.Database[] = []

function openDatabase(): Database.Database {
  const db = new Database(':memory:')
  openDatabases.push(db)
  return db
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close()
})

describe('SQLite migrations', () => {
  it('baselines an existing database without deleting its data', () => {
    const db = openDatabase()
    db.exec(`
      CREATE TABLE teams (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      INSERT INTO teams (id, data) VALUES ('team-1', '{"name":"Existing"}');
    `)

    runMigrations(db)

    expect(db.prepare('SELECT data FROM teams WHERE id = ?').get('team-1')).toEqual({
      data: '{"name":"Existing"}',
    })
    expect(db.prepare('SELECT version, name FROM schema_migrations').all()).toEqual([
      { version: 1, name: 'initial-schema' },
      { version: 2, name: 'stable-player-identity' },
      { version: 3, name: 'entity-versions' },
      { version: 4, name: 'team-portal' },
    ])
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'matches'").get()).toEqual({
      name: 'matches',
    })
  })

  it('does not rerun migrations that are already applied', () => {
    const db = openDatabase()
    let executions = 0
    const migration: Migration = {
      version: 1,
      name: 'counter',
      up() {
        executions += 1
      },
    }

    runMigrations(db, [migration])
    runMigrations(db, [migration])

    expect(executions).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: 1 })
  })

  it('rolls back both schema changes and bookkeeping when a migration fails', () => {
    const db = openDatabase()
    const migration: Migration = {
      version: 1,
      name: 'failing-migration',
      up(database) {
        database.exec('CREATE TABLE should_rollback (id INTEGER PRIMARY KEY)')
        throw new Error('boom')
      },
    }

    expect(() => runMigrations(db, [migration])).toThrow('boom')
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'").get()).toBeUndefined()
    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: 0 })
  })

  it('applies later migrations in version order', () => {
    const db = openDatabase()
    const applied: number[] = []
    const futureMigrations: Migration[] = [
      ...migrations,
      {
        version: 5,
        name: 'add-migration-test-table',
        up(database) {
          applied.push(3)
          database.exec('CREATE TABLE migration_test (id INTEGER PRIMARY KEY)')
        },
      },
    ]

    runMigrations(db, futureMigrations)
    runMigrations(db, futureMigrations)

    expect(applied).toEqual([3])
    expect(db.prepare('SELECT version, name FROM schema_migrations').all()).toEqual([
      { version: 1, name: 'initial-schema' },
      { version: 2, name: 'stable-player-identity' },
      { version: 3, name: 'entity-versions' },
      { version: 4, name: 'team-portal' },
      { version: 5, name: 'add-migration-test-table' },
    ])
  })

  it('migrates mastery, history and ranking cache to the stable player id', () => {
    const db = openDatabase()
    runMigrations(db, [migrations[0]])
    db.prepare('INSERT INTO teams (id, data) VALUES (?, ?)').run('team-1', JSON.stringify({
      id: 'team-1', name: 'Alpha', logo: '',
      players: [{ id: 'player-1', summonerName: ' Player # EUW ', primaryRole: 'Mid' }],
    }))
    db.prepare('INSERT INTO player_champion_mastery VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('player#euw', 1, 'Annie', 7, 100, 1, '2026-01-01')
    db.prepare('INSERT INTO player_match_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('PLAYER#EUW', 'EUW1_1', 1, 'Annie', 'MID', 1, 2, 3, 1, 1, 420)
    db.prepare("INSERT INTO player_stats (key, data) VALUES ('cache', ?)").run(JSON.stringify({
      lastUpdated: null, players: [{ summonerName: 'player#euw' }],
    }))

    runMigrations(db)

    expect(db.prepare('SELECT player_id FROM player_champion_mastery').get()).toEqual({ player_id: 'player-1' })
    expect(db.prepare('SELECT player_id FROM player_match_history').get()).toEqual({ player_id: 'player-1' })
    const cache = JSON.parse((db.prepare("SELECT data FROM player_stats WHERE key = 'cache'").get() as { data: string }).data)
    expect(cache.players[0].playerId).toBe('player-1')
  })
})

