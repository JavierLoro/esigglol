import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { runMigrations } from '../lib/db-migrations'

async function main() {
  const sourcePath = path.resolve(process.argv[2] ?? 'data/esigglol.db')
  const destination = path.resolve('.tmp', `migration-verification-${Date.now()}.db`)
  mkdirSync(path.dirname(destination), { recursive: true })
  const source = new Database(sourcePath, { readonly: true })
  await source.backup(destination)
  source.close()
  const copy = new Database(destination)
  const tables = ['teams', 'phases', 'matches', 'team_access', 'team_change_requests', 'player_stats', 'player_champion_mastery', 'player_match_history', 'tournament_config']
  const before = new Map(tables.map(table => [table, copy.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Record<string, unknown>[]]))
  const oldVersion = (copy.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }).version
  runMigrations(copy)
  for (const table of tables) {
    const expected = before.get(table)!.map(row => {
      if (oldVersion >= 5) return row
      if (['teams', 'phases', 'matches'].includes(table)) return { ...row, data: JSON.stringify({ ...JSON.parse(String(row.data)), tournamentId: 'legacy-lol', game: 'lol' }) }
      if (table === 'player_stats' && row.key === 'cache') return { ...row, key: 'legacy-lol:cache' }
      if (table === 'tournament_config' && row.key !== 'riot-api-key') return { ...row, key: `legacy-lol:${row.key}` }
      return row
    })
    const normalize = (rows: Record<string, unknown>[]) => rows.map(row => ({ ...row, ...(typeof row.data === 'string' ? { data: JSON.parse(row.data) } : {}) }))
    const after = copy.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Record<string, unknown>[]
    if (!isDeepStrictEqual(normalize(expected), normalize(after))) throw new Error(`Migration changed unexpected data in ${table}`)
    console.log(`${table}: ${after.length} rows preserved`)
  }
  const integrity = copy.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') throw new Error('SQLite integrity check failed')
  copy.close()
  console.log(`Verified copy: ${destination}`)
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1 })
