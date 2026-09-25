import { notFound } from 'next/navigation'
import db from './db'
import { inTournament } from './competition-context'
import { getTournament, getTournaments } from './competitions'

export type CompetitionSearch = { tournament?: string; game?: string; t1?: string; t2?: string }
export function publicTournament(search: CompetitionSearch, allowArchived = false) {
  const tournament = search.tournament ? getTournament(search.tournament) : getTournaments().find(t => t.status === 'published' && t.game === (search.game ?? 'lol'))
  if (!tournament || tournament.status === 'draft' || (!allowArchived && tournament.status === 'archived') || (search.game && search.game !== 'all' && tournament.game !== search.game)) notFound()
  return tournament
}
export function publicEntityTournament(table: 'teams' | 'matches' | 'phases', id: string) {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as { data: string } | undefined
  if (!row) notFound()
  return publicTournament({ tournament: JSON.parse(row.data).tournamentId }, table === 'phases')
}
export { inTournament }
