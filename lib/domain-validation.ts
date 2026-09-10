import type { Match, Phase, Team } from './types'
import { getEffectiveBO } from './match-validation'
import { getPhaseTeamIds } from './phase-validation'
import { normalizeRiotId } from './player-identity'

export type DomainIssue = { path: (string | number)[]; message: string }

/**
 * Validates invariants which cannot be expressed by the request schemas alone
 * because they depend on the rest of the tournament state.
 */
export function validateTeams(teams: Team[]): DomainIssue[] {
  const issues: DomainIssue[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  const playerIds = new Set<string>()
  const summonerNames = new Set<string>()

  teams.forEach((team, index) => {
    if (ids.has(team.id)) issues.push({ path: [index, 'id'], message: 'El ID del equipo debe ser único' })
    ids.add(team.id)
    const normalizedName = team.name.trim().toLocaleLowerCase()
    if (names.has(normalizedName)) issues.push({ path: [index, 'name'], message: 'El nombre del equipo debe ser único' })
    names.add(normalizedName)

    team.players.forEach((player, playerIndex) => {
      if (playerIds.has(player.id)) issues.push({ path: [index, 'players', playerIndex, 'id'], message: 'El ID del jugador debe ser único entre equipos' })
      playerIds.add(player.id)
      const summonerName = normalizeRiotId(player.summonerName)
      if (summonerNames.has(summonerName)) issues.push({ path: [index, 'players', playerIndex, 'summonerName'], message: 'El Riot ID no puede repetirse entre equipos' })
      summonerNames.add(summonerName)
    })
  })
  return issues
}

export function validateMatch(
  match: Match,
  teams: Team[],
  phases: Phase[],
  allowedTbdFields: ReadonlySet<'team1Id' | 'team2Id'> = new Set(),
): DomainIssue[] {
  const issues: DomainIssue[] = []
  const teamIds = new Set(teams.map(team => team.id))
  const phase = phases.find(candidate => candidate.id === match.phaseId)

  if (!phase) issues.push({ path: ['phaseId'], message: 'La fase no existe' })
  const phaseTeamIds = phase ? getPhaseTeamIds(phase) : []
  for (const [path, teamId] of [['team1Id', match.team1Id], ['team2Id', match.team2Id]] as const) {
    if (teamId === 'TBD' && !allowedTbdFields.has(path)) {
      issues.push({ path: [path], message: 'TBD solo se permite en slots generados por el sistema' })
    }
    if (teamId !== 'TBD' && !teamIds.has(teamId)) issues.push({ path: [path], message: 'El equipo no existe' })
    if (teamId !== 'TBD' && phase && !phaseTeamIds.includes(teamId)) {
      issues.push({ path: [path], message: 'El equipo no participa en esta fase' })
    }
  }
  if (match.team1Id !== 'TBD' && match.team1Id === match.team2Id) {
    issues.push({ path: ['team2Id'], message: 'Un partido debe tener dos equipos distintos' })
  }

  if (match.result === null) {
    if (match.winnerId !== undefined) issues.push({ path: ['winnerId'], message: 'Un partido sin resultado no puede tener ganador' })
    return issues
  }

  const { team1Score, team2Score } = match.result
  const maxWins = Math.ceil(getEffectiveBO(phase ?? { config: { bo: 1 } } as Phase, match.round) / 2)
  if (team1Score > maxWins || team2Score > maxWins) {
    issues.push({ path: ['result'], message: `La puntuación no puede superar ${maxWins} victorias` })
  }
  if (team1Score === team2Score) {
    if (match.winnerId !== undefined) issues.push({ path: ['winnerId'], message: 'Un resultado empatado no puede tener ganador' })
  } else {
    const expectedWinner = team1Score > team2Score ? match.team1Id : match.team2Id
    const winningScore = Math.max(team1Score, team2Score)
    if (winningScore < maxWins && match.winnerId !== undefined) issues.push({ path: ['winnerId'], message: 'Un resultado parcial no puede tener ganador' })
    if (winningScore >= maxWins && match.winnerId === undefined) issues.push({ path: ['winnerId'], message: 'El ganador es obligatorio al completar la serie' })
    if (match.winnerId !== undefined && match.winnerId !== expectedWinner) issues.push({ path: ['winnerId'], message: 'El ganador debe coincidir con el resultado' })
  }
  if (match.winnerId !== undefined && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
    issues.push({ path: ['winnerId'], message: 'El ganador debe ser uno de los equipos del partido' })
  }
  return issues
}

export function issuesToMessage(issues: DomainIssue[]): string {
  return issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
}
