import type { Match, Team } from './types'

export function getPublicMatchHref(match: Match, teams: Team[]): string {
  if (match.result !== null) return `/partidos/${match.id}`

  const availableTeamIds = new Set(teams.map(team => team.id))
  const canCompare = match.team1Id !== match.team2Id
    && availableTeamIds.has(match.team1Id)
    && availableTeamIds.has(match.team2Id)

  if (!canCompare) return `/partidos/${match.id}`

  return `/comparar?t1=${encodeURIComponent(match.team1Id)}&t2=${encodeURIComponent(match.team2Id)}`
}
