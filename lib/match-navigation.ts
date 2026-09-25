import type { Match, Team } from './types'

export function getPublicMatchHref(match: Match, teams: Team[]): string {
  const context = match.tournamentId ? `tournament=${encodeURIComponent(match.tournamentId)}&game=${match.game ?? 'lol'}` : ''
  const detail = `/partidos/${match.id}${context ? `?${context}` : ''}`
  if (match.result !== null || match.game === 'valorant') return detail

  const availableTeamIds = new Set(teams.map(team => team.id))
  const canCompare = match.team1Id !== match.team2Id
    && availableTeamIds.has(match.team1Id)
    && availableTeamIds.has(match.team2Id)

  if (!canCompare) return detail

  return `/comparar?t1=${encodeURIComponent(match.team1Id)}&t2=${encodeURIComponent(match.team2Id)}${context ? `&${context}` : ''}`
}
