import type { Match, MatchResult, Phase } from './types'

export function getMatchBo(phase: Phase | undefined, match: Match): number {
  return phase?.config.roundBo?.[String(match.round)] ?? phase?.config.bo ?? 1
}

export function resultFromGames(match: Match): MatchResult | null {
  const games = (match.games ?? []).filter((game): game is NonNullable<typeof game> => game !== null)
  if (games.length === 0) return null
  return {
    team1Score: games.filter(game => game.winner === 'team1').length,
    team2Score: games.filter(game => game.winner === 'team2').length,
  }
}

/** Returns a normalized, JSON-safe match or an actionable validation error. */
export function validateAndNormalizeMatch(match: Match, phase: Phase | undefined):
  | { ok: true; match: Match }
  | { ok: false; error: string } {
  const bo = getMatchBo(phase, match)
  const games = match.games?.map(game => game ?? null)
  const riotMatchIds = (match.riotMatchIds ?? []).map(id => id || null)
  if ((games?.length ?? 0) > bo || riotMatchIds.length > bo) {
    return { ok: false, error: `El BO${bo} no puede tener más de ${bo} partidas` }
  }

  const derived = resultFromGames({ ...match, games })
  if (!derived) return { ok: true, match: { ...match, games, riotMatchIds } }

  const supplied = match.result
  if (supplied && (supplied.team1Score !== derived.team1Score || supplied.team2Score !== derived.team2Score)) {
    return { ok: false, error: 'El marcador de la serie no coincide con las partidas registradas' }
  }
  const derivedWinner = derived.team1Score === derived.team2Score
    ? undefined
    : derived.team1Score > derived.team2Score ? match.team1Id : match.team2Id
  if (match.winnerId && match.winnerId !== derivedWinner) {
    return { ok: false, error: 'El ganador de la serie no coincide con las partidas registradas' }
  }
  return {
    ok: true,
    match: { ...match, games, riotMatchIds, result: derived, winnerId: derivedWinner },
  }
}
