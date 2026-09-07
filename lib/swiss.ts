import type { Match } from './types'

export interface SwissRecord {
  wins: number
  losses: number
}

export interface SwissPair {
  team1Id: string
  team2Id: string
}

export interface SwissPairingResult {
  pairs: SwissPair[]
  unpairedTeamId?: string
}

/**
 * A draw is not a win or a loss in the Swiss standings. This is important for
 * partially entered BO scores: a 1-1 result must not move one team to the
 * next win/loss pool.
 */
export function getSwissRecords(matches: Match[], teamIds: string[]): Record<string, SwissRecord> {
  const records: Record<string, SwissRecord> = {}
  for (const teamId of teamIds) records[teamId] = { wins: 0, losses: 0 }

  for (const match of matches) {
    if (!match.result || match.result.team1Score === match.result.team2Score) continue

    const winner = match.result.team1Score > match.result.team2Score ? match.team1Id : match.team2Id
    const loser = winner === match.team1Id ? match.team2Id : match.team1Id
    if (records[winner]) records[winner].wins++
    if (records[loser]) records[loser].losses++
  }

  return records
}

function opponentKey(team1Id: string, team2Id: string): string {
  return [team1Id, team2Id].sort().join('|')
}

function pairTeams(
  teams: string[],
  records: Record<string, SwissRecord>,
  played: Set<string>,
  allowRematches: boolean,
): SwissPair[] | null {
  if (teams.length === 0) return []
  const [first, ...rest] = teams
  const candidates = rest
    .filter(candidate => allowRematches || !played.has(opponentKey(first, candidate)))
    .sort((a, b) => {
      const aRecord = records[a]
      const bRecord = records[b]
      const aGap = Math.abs(aRecord.wins - records[first].wins) + Math.abs(aRecord.losses - records[first].losses)
      const bGap = Math.abs(bRecord.wins - records[first].wins) + Math.abs(bRecord.losses - records[first].losses)
      return aGap - bGap || a.localeCompare(b)
    })

  for (const candidate of candidates) {
    const remainder = rest.filter(teamId => teamId !== candidate)
    const result = pairTeams(remainder, records, played, allowRematches)
    if (result) return [{ team1Id: first, team2Id: candidate }, ...result]
  }
  return null
}

/**
 * Creates deterministic pairings, keeping equal W-L records together when
 * possible and never rematching teams while a valid no-rematch solution exists.
 */
export function createSwissPairings(
  teamIds: string[],
  matches: Match[],
  records = getSwissRecords(matches, teamIds),
): SwissPairingResult {
  const played = new Set(
    matches.map(match => opponentKey(match.team1Id, match.team2Id)),
  )
  const active = teamIds.filter(teamId => records[teamId]?.wins !== undefined)
    .sort((a, b) => {
      const aRecord = records[a]
      const bRecord = records[b]
      return bRecord.wins - aRecord.wins || aRecord.losses - bRecord.losses || a.localeCompare(b)
    })

  const pairs = pairTeams(active, records, played, false) ?? []
  const paired = new Set(pairs.flatMap(pair => [pair.team1Id, pair.team2Id]))
  const unpairedTeamId = active.find(teamId => !paired.has(teamId))
  return unpairedTeamId ? { pairs, unpairedTeamId } : { pairs }
}

export function getSwissRoundError(
  phaseMatches: Match[],
  requestedRound: number,
  confirmedRounds: number[] = [],
): string | null {
  if (!Number.isInteger(requestedRound) || requestedRound < 1) return 'La ronda suiza debe ser un entero positivo.'

  const rounds = [...new Set(phaseMatches.map(match => match.round))].sort((a, b) => a - b)
  const lastRound = rounds.at(-1)
  if (lastRound === undefined) return requestedRound === 1 ? null : 'La primera ronda debe generarse antes.'
  if (requestedRound !== lastRound + 1) {
    return `La siguiente ronda disponible es la ${lastRound + 1}.`
  }
  if (!confirmedRounds.includes(lastRound)) {
    return `La ronda ${lastRound} debe confirmarse antes de generar la siguiente.`
  }

  const previousMatches = phaseMatches.filter(match => match.round === lastRound)
  if (previousMatches.some(match => !match.result || !match.winnerId || match.result.team1Score === match.result.team2Score)) {
    return `La ronda ${lastRound} debe tener todos sus resultados sin empates antes de generar la siguiente.`
  }
  return null
}

export function getSwissConfirmationError(
  phaseMatches: Match[],
  confirmedRounds: number[],
): string | null {
  const rounds = [...new Set(phaseMatches.map(match => match.round))].sort((a, b) => a - b)
  const confirmed = [...new Set(confirmedRounds)].sort((a, b) => a - b)
  for (let index = 0; index < confirmed.length; index++) {
    const round = confirmed[index]
    if (round !== index + 1) return 'Las rondas suizas deben confirmarse en orden, sin saltos.'
    if (!rounds.includes(round)) return `No se puede confirmar la ronda ${round} porque aún no existe.`
  }
  return null
}
