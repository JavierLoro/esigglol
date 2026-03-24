import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'esigglol.db')

// Singleton: en Next.js el módulo se cachea entre requests en el mismo proceso
let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database): void {
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
}

export default getDb()
