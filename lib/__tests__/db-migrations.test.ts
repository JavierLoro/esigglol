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
        version: 2,
        name: 'add-migration-test-table',
        up(database) {
          applied.push(2)
          database.exec('CREATE TABLE migration_test (id INTEGER PRIMARY KEY)')
        },
      },
    ]

    runMigrations(db, futureMigrations)
    runMigrations(db, futureMigrations)

    expect(applied).toEqual([2])
    expect(db.prepare('SELECT version, name FROM schema_migrations').all()).toEqual([
      { version: 1, name: 'initial-schema' },
      { version: 2, name: 'add-migration-test-table' },
    ])
  })
})

