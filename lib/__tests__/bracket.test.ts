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

// ── Upper-lower (8 equipos) ──────────────────────────────────────────────────

describe('advanceWinner — upper-lower 8 equipos', () => {
  const phase = makePhase('upper-lower', { bracketTeamIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] })

  function makeUL8Matches() {
    return [
      // Upper R1 (×4)
      makeMatch({ id: 'u1a', round: 1, team1Id: 'A', team2Id: 'B' }),
      makeMatch({ id: 'u1b', round: 1, team1Id: 'C', team2Id: 'D' }),
      makeMatch({ id: 'u1c', round: 1, team1Id: 'E', team2Id: 'F' }),
      makeMatch({ id: 'u1d', round: 1, team1Id: 'G', team2Id: 'H' }),
      // Upper R2 (×2)
      makeMatch({ id: 'u2a', round: 2 }),
      makeMatch({ id: 'u2b', round: 2 }),
      // Upper final R3 (×1)
      makeMatch({ id: 'u3', round: 3 }),
      // Lower R1 (×2)
      makeMatch({ id: 'l1a', round: -1 }),
      makeMatch({ id: 'l1b', round: -1 }),
      // Lower R2 (×2)
      makeMatch({ id: 'l2a', round: -2 }),
      makeMatch({ id: 'l2b', round: -2 }),
      // Lower semi R-3 (×1)
      makeMatch({ id: 'l3', round: -3 }),
      // Lower final R-4 (×1)
      makeMatch({ id: 'l4', round: -4 }),
      // Grand final R99
      makeMatch({ id: 'gf', round: 99 }),
    ]
  }

  it('R1: ganador → upper R2 (por índice), perdedor → lower R-1 (por índice)', () => {
    const matches = makeUL8Matches()
    matches[0].result = { team1Score: 1, team2Score: 0 }
    matches[0].winnerId = 'A'

    const result = advanceWinner(phase, matches, matches[0])
    const r2 = result.filter(m => m.round === 2).sort((a, b) => a.id.localeCompare(b.id))
    const rNeg1 = result.filter(m => m.round === -1).sort((a, b) => a.id.localeCompare(b.id))
    expect(r2[0].team1Id).toBe('A')   // u1a(idx=0) → r2[0].team1
    expect(rNeg1[0].team1Id).toBe('B') // perdedor → lower R-1[0].team1
  })

  it('R3 (upper final): ganador → R99 team1, perdedor → R-4 (NO a R-3)', () => {
    const matches = makeUL8Matches()
    matches[6].team1Id = 'A'
    matches[6].team2Id = 'C'
    matches[6].result = { team1Score: 2, team2Score: 1 }
    matches[6].winnerId = 'A'

    const result = advanceWinner(phase, matches, matches[6])
    const r99  = result.find(m => m.round === 99)!
    const rNeg4 = result.find(m => m.round === -4)!
    const rNeg3 = result.find(m => m.round === -3)!

    expect(r99.team1Id).toBe('A')    // ganador → grand final team1
    expect(rNeg4.team1Id).toBe('C')  // perdedor → R-4 (lower final)
    expect(rNeg3.team1Id).toBe('TBD') // R-3 no debe ser tocado por R3
    expect(rNeg3.team2Id).toBe('TBD')
  })

  it('R-2: ganadores van a R-3', () => {
    const matches = makeUL8Matches()
    matches[9].team1Id = 'B'
    matches[9].team2Id = 'D'
    matches[9].result = { team1Score: 1, team2Score: 0 }
    matches[9].winnerId = 'B'

    const result = advanceWinner(phase, matches, matches[9])
    const rNeg3 = result.find(m => m.round === -3)!
    expect(rNeg3.team1Id).toBe('B')
  })

  it('R-4 (lower final): ganador → R99 team2', () => {
    const matches = makeUL8Matches()
    matches[12].team1Id = 'C'
    matches[12].team2Id = 'B'
    matches[12].result = { team1Score: 0, team2Score: 2 }
    matches[12].winnerId = 'B'

    const result = advanceWinner(phase, matches, matches[12])
    const r99 = result.find(m => m.round === 99)!
    expect(r99.team2Id).toBe('B')
  })
})
