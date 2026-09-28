import db from './db'
import { currentTournamentId } from './competition-context'
import { assertCompetitionWritable } from './competitions'
import { getMatches, getPhases } from './data'
import { OverlayConfigSchema, overlayConfigError, type OverlayConfig } from './overlay'

export function getOverlayConfig(): OverlayConfig {
  const row = db.prepare('SELECT data FROM tournament_config WHERE key = ?').get(`${currentTournamentId()}:overlay`) as { data: string } | undefined
  return row ? OverlayConfigSchema.parse(JSON.parse(row.data)) : { matchId: null, summary: null }
}

export function saveOverlayConfig(config: OverlayConfig): string | null {
  return db.transaction(() => {
    assertCompetitionWritable()
    const error = overlayConfigError(config, getPhases(), getMatches())
    if (error) return error
    db.prepare('INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)')
      .run(`${currentTournamentId()}:overlay`, JSON.stringify(config))
    return null
  }).immediate()
}
