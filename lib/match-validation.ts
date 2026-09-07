import type { BOFormat, Match, MatchResult, Phase } from './types'

/** Returns the BO configured for a match, falling back to the phase default. */
export function getEffectiveBO(phase: Phase, round: number): BOFormat {
  return phase.config.roundBo?.[String(round)] ?? phase.config.bo
}

/**
 * Validates a series result against the BO of its round.
 * A result may be partial while games are being played, but neither side can
 * exceed the number of wins needed to close the series.
 */
export function validateMatchResult(
  phase: Phase,
  match: Pick<Match, 'round' | 'team1Id' | 'team2Id' | 'winnerId'>,
  result: MatchResult | null,
): string | null {
  if (result === null) {
    return match.winnerId ? 'Un partido sin resultado no puede tener ganador' : null
  }

  const bo = getEffectiveBO(phase, match.round)
  const maxWins = Math.ceil(bo / 2)
  if (result.team1Score > maxWins || result.team2Score > maxWins) {
    return `La puntuación no puede superar ${maxWins} victorias en BO${bo}`
  }

  if (match.winnerId !== undefined && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
    return 'El ganador debe ser uno de los equipos del partido'
  }

  if (result.team1Score === result.team2Score) {
    if (match.winnerId !== undefined) return 'Un resultado empatado no puede tener ganador'
    return null
  }

  const expectedWinner = result.team1Score > result.team2Score ? match.team1Id : match.team2Id
  const winningScore = Math.max(result.team1Score, result.team2Score)
  if (winningScore < maxWins && match.winnerId !== undefined) {
    return 'Un resultado parcial no puede tener ganador'
  }
  if (winningScore >= maxWins && match.winnerId === undefined) {
    return `El ganador es obligatorio al alcanzar ${maxWins} victorias en BO${bo}`
  }
  if (match.winnerId !== undefined && match.winnerId !== expectedWinner) {
    return 'El ganador no coincide con la puntuación'
  }

  return null
}
