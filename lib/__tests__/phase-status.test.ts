import { describe, expect, it } from 'vitest'
import { derivePhaseStatus, isPhaseComplete } from '../phase-status'
import type { Match, Phase } from '../types'

const phase = (type: Phase['type'], config: Phase['config'] = { bo: 1 }): Phase => ({
  id: 'p1', name: 'Fase', type, status: 'upcoming', order: 1, config,
})
const match = (round: number, result: boolean): Match => ({
  id: `m${round}`, phaseId: 'p1', round, team1Id: 'a', team2Id: 'b',
  result: result ? { team1Score: 1, team2Score: 0 } : null,
  winnerId: result ? 'a' : undefined, riotMatchIds: [],
})

describe('phase status lifecycle', () => {
  it('keeps empty and pending phases upcoming', () => {
    expect(derivePhaseStatus(phase('groups'), [])).toBe('upcoming')
    expect(derivePhaseStatus(phase('groups'), [match(1, false)])).toBe('upcoming')
  })

  it('marks a partially played phase active and a completed group completed', () => {
    expect(derivePhaseStatus(phase('groups'), [match(1, true), match(2, false)])).toBe('active')
    expect(derivePhaseStatus(phase('groups'), [match(1, true), match(2, true)])).toBe('completed')
  })

  it('waits for the terminal bracket match', () => {
    const p = phase('elimination')
    expect(isPhaseComplete(p, [match(1, true), { ...match(2, false), id: 'm2' }])).toBe(false)
    expect(isPhaseComplete(p, [match(1, true)])).toBe(true)
  })

  it('requires the optional third-place match in a final four', () => {
    const p = phase('final-four', { bo: 1, include3rdPlace: true })
    expect(isPhaseComplete(p, [match(1, true), match(2, true)])).toBe(false)
    expect(isPhaseComplete(p, [match(1, true), match(2, true), match(98, true)])).toBe(true)
  })
})
