import { describe, expect, it } from 'vitest'
import { recalculateBracket } from '../bracket'
import type { Match, Phase, PhaseConfig } from '../types'

const phase = (type: Phase['type'], config: Partial<PhaseConfig> = {}): Phase => ({
  id: 'p', name: 'Phase', type, status: 'active', order: 0, config: { bo: 1, ...config },
})
const match = (id: string, round: number, team1Id = 'TBD', team2Id = 'TBD'): Match => ({
  id, phaseId: 'p', round, team1Id, team2Id, result: null, riotMatchIds: [],
})
const win = (match: Match, winnerId: string): Match => ({
  ...match, result: winnerId === match.team1Id ? { team1Score: 1, team2Score: 0 } : { team1Score: 0, team2Score: 1 }, winnerId,
})

describe('recalculateBracket', () => {
  it('corrige elimination e invalida una final disputada con el ganador anterior', () => {
    const matches = [
      win(match('s1', 1, 'A', 'B'), 'B'),
      { ...win(match('s2', 1, 'C', 'D'), 'C'), bracketPosition: 1 },
      win(match('f', 2, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('elimination'), matches)
    expect(result[2]).toMatchObject({ team1Id: 'B', team2Id: 'C', result: null })
    expect(result[2].winnerId).toBeUndefined()
  })

  it('limpia final y tercer puesto al retirar el resultado de una semifinal de Final Four', () => {
    const matches = [
      match('s1', 1, 'A', 'B'),
      win(match('s2', 1, 'C', 'D'), 'D'),
      win(match('f', 2, 'A', 'D'), 'A'),
      win(match('third', 98, 'B', 'C'), 'B'),
    ]
    const result = recalculateBracket(phase('final-four', { include3rdPlace: true }), matches)
    expect(result[2]).toMatchObject({ team1Id: 'TBD', team2Id: 'D', result: null })
    expect(result[3]).toMatchObject({ team1Id: 'TBD', team2Id: 'C', result: null })
  })

  it('recalcula ambas ramas de Upper/Lower cuando cambia un ganador inicial', () => {
    const matches = [
      win(match('u1', 1, 'A', 'B'), 'B'),
      win(match('u2', 1, 'C', 'D'), 'C'),
      win(match('uf', 2, 'A', 'C'), 'A'),
      win(match('l1', -1, 'B', 'D'), 'B'),
      win(match('lf', -2, 'C', 'B'), 'C'),
      win(match('gf', 99, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('upper-lower', { bracketTeamIds: ['A', 'B', 'C', 'D'] }), matches)
    expect(result[2]).toMatchObject({ team1Id: 'B', team2Id: 'C', result: null })
    expect(result[3]).toMatchObject({ team1Id: 'A', team2Id: 'D', result: null })
    expect(result[4]).toMatchObject({ team1Id: 'TBD', team2Id: 'TBD', result: null })
    expect(result[5]).toMatchObject({ team1Id: 'TBD', team2Id: 'TBD', result: null })
  })

  it('mantiene coherentes los descendientes cuando falta un partido eliminado', () => {
    const matches = [
      { ...win(match('s2', 1, 'C', 'D'), 'C'), bracketPosition: 1 },
      win(match('f', 2, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('elimination'), matches)
    expect(result[1]).toMatchObject({ team1Id: 'TBD', team2Id: 'C', result: null })
  })
})
