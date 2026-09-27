import { competitiveDetails } from './game-details'
import type { Match, MatchResult, Phase } from './types'
import { getEffectiveBO } from './match-validation'

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
  const details = competitiveDetails(match, phase?.game ?? match.game ?? 'lol')
  if (details.game === 'valorant') {
    const maps = details.maps ?? []
    if (maps.length > bo) return { ok: false, error: 'Demasiados mapas para la serie' }
    for (const map of maps) {
      const high = Math.max(map.team1Rounds, map.team2Rounds)
      const low = Math.min(map.team1Rounds, map.team2Rounds)
      if (![map.team1Rounds, map.team2Rounds].every(n => Number.isInteger(n) && n >= 0) || !((high === 13 && low <= 11) || (high >= 14 && high - low === 2))) return { ok: false, error: 'Resultado por mapa inválido: 13 rondas o prórroga con dos de ventaja' }
    }
    if (maps.length && (!match.result || maps.filter(m => m.team1Rounds > m.team2Rounds).length > match.result.team1Score || maps.filter(m => m.team2Rounds > m.team1Rounds).length > match.result.team2Score)) return { ok: false, error: 'Los mapas no coinciden con el marcador de serie' }
    return { ok: true, match }
  }
  if (match.maps?.length) return { ok: false, error: 'Los mapas de Valorant no pertenecen a LoL' }

  const winsNeeded = Math.ceil(getEffectiveBO(phase ?? { config: { bo: 1 } } as Phase, match.round) / 2)
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
  const derivedWinner = Math.max(derived.team1Score, derived.team2Score) < winsNeeded || derived.team1Score === derived.team2Score
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
