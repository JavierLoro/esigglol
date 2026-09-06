import { describe, expect, it } from 'vitest'
import { getEffectiveBO, validateMatchResult } from '../match-validation'
import type { Phase } from '../types'

const phase: Phase = {
  id: 'phase-1', name: 'Test', type: 'swiss', status: 'active', order: 0,
  config: { bo: 3, roundBo: { '2': 1, '-1': 5 } },
}

const match = { round: 2, team1Id: 'A', team2Id: 'B' }

describe('BO efectivo por ronda', () => {
  it('usa roundBo y vuelve al BO de fase cuando no hay override', () => {
    expect(getEffectiveBO(phase, 2)).toBe(1)
    expect(getEffectiveBO(phase, 1)).toBe(3)
  })

  it('valida el límite del BO efectivo', () => {
    expect(validateMatchResult(phase, match, { team1Score: 1, team2Score: 0 })).toBeNull()
    expect(validateMatchResult(phase, match, { team1Score: 2, team2Score: 0 })).toContain('BO1')
  })

  it('rechaza ganador que no coincide con el resultado', () => {
    expect(validateMatchResult(phase, { ...match, round: 1, winnerId: 'B' }, { team1Score: 2, team2Score: 1 }))
      .toContain('no coincide')
  })

  it('permite empates sin ganador y rechaza empates con ganador', () => {
    expect(validateMatchResult(phase, { ...match, round: 1 }, { team1Score: 1, team2Score: 1 })).toBeNull()
    expect(validateMatchResult(phase, { ...match, round: 1, winnerId: 'A' }, { team1Score: 1, team2Score: 1 }))
      .toContain('empatado')
  })
})
