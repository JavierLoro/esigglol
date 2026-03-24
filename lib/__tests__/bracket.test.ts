import { describe, it, expect } from 'vitest'
import { advanceWinner } from '../bracket'
import type { Phase, Match, PhaseConfig } from '../types'

function makePhase(type: Phase['type'], config: Partial<PhaseConfig> = {}): Phase {
  return {
    id: 'phase-1',
    name: 'Test Phase',
    type,
    status: 'active',
    order: 0,
    config: { bo: 1, ...config },
  }
}

function makeMatch(overrides: Partial<Match> & { id: string; round: number }): Match {
  return {
    phaseId: 'phase-1',
    team1Id: 'TBD',
    team2Id: 'TBD',
    result: null,
    riotMatchIds: [],
    ...overrides,
  }
}

// ── Casos base ───────────────────────────────────────────────────────────────

describe('advanceWinner — casos base', () => {
  const phase = makePhase('elimination')

  it('no cambia nada si el match no tiene resultado', () => {
    const m = makeMatch({ id: 'm1', round: 1, team1Id: 'A', team2Id: 'B' })
    const result = advanceWinner(phase, [m], m)
    expect(result).toEqual([m])
  })

  it('no cambia nada si el match no tiene winnerId', () => {
    const m = makeMatch({
      id: 'm1', round: 1, team1Id: 'A', team2Id: 'B',
      result: { team1Score: 1, team2Score: 0 },
    })
    const result = advanceWinner(phase, [m], m)
    expect(result).toEqual([m])
  })

  it('no cambia nada si hay empate', () => {
    const m = makeMatch({
      id: 'm1', round: 1, team1Id: 'A', team2Id: 'B',
      result: { team1Score: 1, team2Score: 1 },
      winnerId: 'A',
    })
    const result = advanceWinner(phase, [m], m)
    expect(result).toEqual([m])
  })
})

// ── Elimination ──────────────────────────────────────────────────────────────

describe('advanceWinner — elimination', () => {
  const phase = makePhase('elimination')

  it('ganador de match 0 en R1 avanza como team1 de R2', () => {
    const matches = [
      makeMatch({ id: 'm1', round: 1, team1Id: 'A', team2Id: 'B', result: { team1Score: 2, team2Score: 0 }, winnerId: 'A' }),
      makeMatch({ id: 'm2', round: 1, team1Id: 'C', team2Id: 'D' }),
      makeMatch({ id: 'm3', round: 2 }), // final
    ]
    const result = advanceWinner(phase, matches, matches[0])
    expect(result[2].team1Id).toBe('A')
    expect(result[2].team2Id).toBe('TBD')
  })

  it('ganador de match 1 en R1 avanza como team2 de R2', () => {
    const matches = [
      makeMatch({ id: 'm1', round: 1, team1Id: 'A', team2Id: 'B' }),
      makeMatch({ id: 'm2', round: 1, team1Id: 'C', team2Id: 'D', result: { team1Score: 0, team2Score: 2 }, winnerId: 'D' }),
      makeMatch({ id: 'm3', round: 2 }),
    ]
    const result = advanceWinner(phase, matches, matches[1])
    expect(result[2].team1Id).toBe('TBD')
    expect(result[2].team2Id).toBe('D')
  })

  it('bracket de 4 equipos: semifinales → final', () => {
    const matches = [
      makeMatch({ id: 'm1', round: 1, team1Id: 'A', team2Id: 'B', result: { team1Score: 1, team2Score: 0 }, winnerId: 'A' }),
      makeMatch({ id: 'm2', round: 1, team1Id: 'C', team2Id: 'D', result: { team1Score: 0, team2Score: 1 }, winnerId: 'D' }),
      makeMatch({ id: 'm3', round: 2 }),
    ]
    let result = advanceWinner(phase, matches, matches[0])
    result = advanceWinner(phase, result, result[1])
    // Simular que m2 ya tiene resultado para el segundo advanceWinner
    result[1] = { ...result[1], result: { team1Score: 0, team2Score: 1 }, winnerId: 'D' }
    result = advanceWinner(phase, result, result[1])

    expect(result[2].team1Id).toBe('A')
    expect(result[2].team2Id).toBe('D')
  })
})

// ── Final-four ───────────────────────────────────────────────────────────────

describe('advanceWinner — final-four', () => {
  const phase = makePhase('final-four', { include3rdPlace: true })

  function makeFinalFourMatches(): Match[] {
    return [
      makeMatch({ id: 's1', round: 1, team1Id: 'A', team2Id: 'B' }),
      makeMatch({ id: 's2', round: 1, team1Id: 'C', team2Id: 'D' }),
      makeMatch({ id: 'f1', round: 2 }),   // final
      makeMatch({ id: 't1', round: 98 }),   // 3er puesto
    ]
  }

  it('ganador de semi 1 va a final como team1, perdedor a 3er puesto como team1', () => {
    const matches = makeFinalFourMatches()
    matches[0].result = { team1Score: 2, team2Score: 0 }
    matches[0].winnerId = 'A'

    const result = advanceWinner(phase, matches, matches[0])
    expect(result[2].team1Id).toBe('A')  // final
    expect(result[3].team1Id).toBe('B')  // 3er puesto
  })

  it('ganador de semi 2 va a final como team2, perdedor a 3er puesto como team2', () => {
    const matches = makeFinalFourMatches()
    matches[1].result = { team1Score: 1, team2Score: 2 }
    matches[1].winnerId = 'D'

    const result = advanceWinner(phase, matches, matches[1])
    expect(result[2].team2Id).toBe('D')  // final
    expect(result[3].team2Id).toBe('C')  // 3er puesto
  })
})

// ── Upper-lower (4 equipos) ──────────────────────────────────────────────────

describe('advanceWinner — upper-lower 4 equipos', () => {
  const phase = makePhase('upper-lower', { bracketTeamIds: ['A', 'B', 'C', 'D'] })

  function makeUL4Matches(): Match[] {
    return [
      makeMatch({ id: 'u1', round: 1, team1Id: 'A', team2Id: 'B' }),
      makeMatch({ id: 'u2', round: 1, team1Id: 'C', team2Id: 'D' }),
      makeMatch({ id: 'u3', round: 2 }),    // upper final
      makeMatch({ id: 'l1', round: -1 }),    // lower R1
      makeMatch({ id: 'l2', round: -2 }),    // lower final
      makeMatch({ id: 'gf', round: 99 }),    // grand final
    ]
  }

  it('R1: ganador → upper R2, perdedor → lower R-1', () => {
    const matches = makeUL4Matches()
    matches[0].result = { team1Score: 1, team2Score: 0 }
    matches[0].winnerId = 'A'

    const result = advanceWinner(phase, matches, matches[0])
    expect(result[2].team1Id).toBe('A')  // upper final team1
    expect(result[3].team1Id).toBe('B')  // lower R-1 team1
  })

  it('R2 (upper final): ganador → grand final team1, perdedor → lower R-2', () => {
    const matches = makeUL4Matches()
    matches[2].team1Id = 'A'
    matches[2].team2Id = 'D'
    matches[2].result = { team1Score: 2, team2Score: 1 }
    matches[2].winnerId = 'A'

    const result = advanceWinner(phase, matches, matches[2])
    expect(result[5].team1Id).toBe('A')  // grand final team1
    // perdedor va a lower final
    expect(result[4].team1Id).toBe('D')
  })

  it('R-1 (lower R1): ganador → lower R-2', () => {
    const matches = makeUL4Matches()
    matches[3].team1Id = 'B'
    matches[3].team2Id = 'C'
    matches[3].result = { team1Score: 0, team2Score: 1 }
    matches[3].winnerId = 'C'

    const result = advanceWinner(phase, matches, matches[3])
    expect(result[4].team1Id).toBe('C')  // lower final
  })

  it('R-2 (lower final): ganador → grand final team2', () => {
    const matches = makeUL4Matches()
    matches[4].team1Id = 'D'
    matches[4].team2Id = 'C'
    matches[4].result = { team1Score: 2, team2Score: 0 }
    matches[4].winnerId = 'D'

    const result = advanceWinner(phase, matches, matches[4])
    expect(result[5].team2Id).toBe('D')  // grand final team2
  })
})
