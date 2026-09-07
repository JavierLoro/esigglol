import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync } from 'fs'
import { runMigrations } from './db-migrations'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'esigglol.db')

// Singleton: en Next.js el módulo se cachea entre requests en el mismo proceso
let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('busy_timeout = 5000')
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    runMigrations(_db)
  }
  return _db
}

export default getDb()
