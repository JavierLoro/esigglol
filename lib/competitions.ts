import { randomUUID } from 'node:crypto'
import db from './db'
import { currentTournamentId } from './competition-context'
import type { Tournament } from './types'

export function getTournaments(includeHidden = false): Tournament[] {
  const rows = db.prepare('SELECT data FROM tournaments ORDER BY rowid').all() as { data: string }[]
  return rows.map(row => JSON.parse(row.data) as Tournament).filter(t => includeHidden || t.status === 'published')
}
export function getTournament(id = currentTournamentId()): Tournament | undefined {
  const row = db.prepare('SELECT data FROM tournaments WHERE id = ?').get(id) as { data: string } | undefined
  return row ? JSON.parse(row.data) : undefined
}
export function assertCompetitionWritable(id = currentTournamentId()): Tournament {
  const tournament = getTournament(id)
  if (!tournament) throw new Error('Torneo no encontrado')
  if (tournament.status === 'archived') throw new Error('El torneo está archivado; reábrelo para editar')
  return tournament
}
export function saveTournament(input: Omit<Tournament, 'id'> & { id?: string }): Tournament {
  return db.transaction(() => {
    const existing = input.id ? getTournament(input.id) : undefined
    if (input.id && !existing) throw new Error('Torneo no encontrado')
    if (existing && (existing.game !== input.game || existing.platform !== input.platform)) {
      for (const table of ['teams', 'phases']) {
        if (db.prepare(`SELECT 1 FROM ${table} WHERE json_extract(data, '$.tournamentId') = ? LIMIT 1`).get(existing.id)) {
          throw new Error('El juego y la plataforma no pueden cambiar con participantes o fases')
        }
      }
    }
    const tournament: Tournament = { ...input, id: input.id ?? randomUUID() }
    db.prepare('INSERT INTO tournaments (id, slug, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data')
      .run(tournament.id, tournament.slug, JSON.stringify(tournament))
    return tournament
  }).immediate()
}
