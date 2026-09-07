import { describe, expect, it } from 'vitest'
import { validateAndNormalizeMatch } from '../match-coherence'
import type { GameData, Match, Phase } from '../types'

const game = (winner: GameData['winner']): GameData => ({
  duration: '30:00', winner, team1Players: [], team2Players: [],
})
const phase: Phase = {
  id: 'p1', name: 'Test', type: 'groups', status: 'active', order: 0,
  config: { bo: 3 },
}
const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'm1', phaseId: 'p1', round: 1, team1Id: 'a', team2Id: 'b',
  result: null, riotMatchIds: [], ...overrides,
})

describe('coherencia de partidas y series', () => {
  it('conserva un hueco intermedio como null y deriva el marcador', () => {
    const checked = validateAndNormalizeMatch(match({
      games: [game('team1'), null, game('team2')],
      riotMatchIds: ['r1', null, 'r3'],
    }), phase)
    expect(checked.ok).toBe(true)
    if (checked.ok) {
      expect(checked.match.games).toHaveLength(3)
      expect(checked.match.result).toEqual({ team1Score: 1, team2Score: 1 })
      expect(checked.match.riotMatchIds).toEqual(['r1', null, 'r3'])
    }
  })

  it('permite borrar la partida intermedia sin crear un array disperso', () => {
    const checked = validateAndNormalizeMatch(match({ games: [game('team1'), null] }), phase)
    expect(checked.ok).toBe(true)
    if (checked.ok) expect(checked.match.games).toEqual([game('team1'), null])
  })

  it('rechaza un marcador contradictorio con las partidas válidas', () => {
    const checked = validateAndNormalizeMatch(match({
      games: [game('team1'), game('team1'), null],
      result: { team1Score: 0, team2Score: 2 }, winnerId: 'b',
    }), phase)
    expect(checked).toEqual({ ok: false, error: 'El marcador de la serie no coincide con las partidas registradas' })
  })

  it('rechaza más partidas que las contempladas por el BO', () => {
    const checked = validateAndNormalizeMatch(match({ games: [game('team1'), game('team1'), game('team1'), game('team1')] }), phase)
    expect(checked).toEqual({ ok: false, error: 'El BO3 no puede tener más de 3 partidas' })
  })

  it('no deriva ganador durante un parcial, pero sí al alcanzar las victorias necesarias', () => {
    const partial = validateAndNormalizeMatch(match({
      games: [game('team1')], result: { team1Score: 1, team2Score: 0 }, winnerId: undefined,
    }), phase)
    expect(partial).toEqual(expect.objectContaining({ ok: true }))
    if (partial.ok) expect(partial.match.winnerId).toBeUndefined()

    const final = validateAndNormalizeMatch(match({
      games: [game('team1'), game('team1')], result: { team1Score: 2, team2Score: 0 },
    }), phase)
    expect(final).toEqual(expect.objectContaining({ ok: true }))
    if (final.ok) expect(final.match.winnerId).toBe('a')
  })
})
