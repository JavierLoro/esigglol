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

/** Atomically delete an edition and return its uploads for unused-file cleanup. */
export function deleteTournament(id: string): string[] | undefined {
  return db.transaction(() => {
    if (!getTournament(id)) return undefined
    const teamIds = "SELECT id FROM teams WHERE json_extract(data, '$.tournamentId') = ?"
    const uploads = db.prepare(`
      SELECT json_extract(data, '$.logo') AS logo FROM teams WHERE id IN (${teamIds})
      UNION
      SELECT json_extract(payload, '$.logo') AS logo FROM team_change_requests
      WHERE team_id IN (${teamIds}) AND type = 'team_logo'
    `).all(id, id) as { logo: string | null }[]
    for (const table of ['player_champion_mastery', 'player_match_history']) {
      db.prepare(`DELETE FROM ${table} WHERE player_id IN (
        SELECT json_extract(player.value, '$.id') FROM teams, json_each(teams.data, '$.players') AS player
        WHERE json_extract(teams.data, '$.tournamentId') = ?
      )`).run(id)
    }
    for (const table of ['team_access', 'team_change_requests']) {
      db.prepare(`DELETE FROM ${table} WHERE team_id IN (${teamIds})`).run(id)
    }
    for (const table of ['matches', 'phases', 'teams']) {
      db.prepare(`DELETE FROM ${table} WHERE json_extract(data, '$.tournamentId') = ?`).run(id)
    }
    for (const table of ['player_stats', 'tournament_config']) {
      db.prepare(`DELETE FROM ${table} WHERE instr(key, ?) = 1`).run(`${id}:`)
    }
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(id)
    return uploads.flatMap(({ logo }) => logo ? [logo] : [])
  }).immediate()
}
