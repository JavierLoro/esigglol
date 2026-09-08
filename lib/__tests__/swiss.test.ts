import { describe, expect, it } from 'vitest'
import { createSwissPairings, getSwissConfirmationError, getSwissRecords, getSwissRoundError } from '../swiss'
import type { SwissRecord } from '../swiss'
import type { Match } from '../types'

function match(overrides: Partial<Match>): Match {
  return {
    id: overrides.id ?? 'm1',
    phaseId: 'phase-1',
    round: overrides.round ?? 1,
    team1Id: overrides.team1Id ?? 'A',
    team2Id: overrides.team2Id ?? 'B',
    result: overrides.result ?? null,
    riotMatchIds: [],
    ...overrides,
  }
}

describe('Swiss pairings', () => {
  it('does not turn a draw into a win or a loss', () => {
    const records = getSwissRecords([
      match({ team1Id: 'A', team2Id: 'B', result: { team1Score: 1, team2Score: 1 } }),
    ], ['A', 'B'])

    expect(records).toEqual({ A: { wins: 0, losses: 0 }, B: { wins: 0, losses: 0 } })
  })

  it('keeps equal records together and avoids rematches', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const previous = teams.slice(0, 4).map((team, index) => match({
      id: `m${index}`,
      team1Id: team,
      team2Id: teams[index + 4],
      result: { team1Score: 1, team2Score: 0 },
    }))

    const result = createSwissPairings(teams, previous)
    expect(result.unpairedTeamId).toBeUndefined()
    expect(result.pairs).toHaveLength(4)
    expect(new Set(result.pairs.flatMap(pair => [pair.team1Id, pair.team2Id])).size).toBe(8)
    expect(result.pairs.every(pair => !previous.some(previousMatch =>
      new Set([previousMatch.team1Id, previousMatch.team2Id]).size ===
        new Set([pair.team1Id, pair.team2Id]).size &&
      [previousMatch.team1Id, previousMatch.team2Id].every(teamId =>
        [pair.team1Id, pair.team2Id].includes(teamId)),
    ))).toBe(true)
  })

  it('reports an odd active pool instead of creating an invalid bye silently', () => {
    const result = createSwissPairings(['A', 'B', 'C'], [])
    expect(result.unpairedTeamId).toBeDefined()
    expect(result.pairs).toHaveLength(1)
  })

  it.each([8, 16])('pairs every team exactly once in a field of %i', teamCount => {
    const teams = Array.from({ length: teamCount }, (_, index) => `T${String(index + 1).padStart(2, '0')}`)
    const result = createSwissPairings(teams, [])

    expect(result.unpairedTeamId).toBeUndefined()
    expect(result.pairs).toHaveLength(teamCount / 2)
    expect(new Set(result.pairs.flatMap(pair => [pair.team1Id, pair.team2Id])).size).toBe(teamCount)
  })

  it('floats teams between odd record buckets', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const records: Record<string, SwissRecord> = {
      A: { wins: 2, losses: 0 }, B: { wins: 2, losses: 0 }, C: { wins: 2, losses: 0 },
      D: { wins: 1, losses: 1 }, E: { wins: 1, losses: 1 }, F: { wins: 1, losses: 1 },
      G: { wins: 0, losses: 2 }, H: { wins: 0, losses: 2 },
    }
    const result = createSwissPairings(teams, [], records)

    expect(result.pairs).toHaveLength(4)
    expect(new Set(result.pairs.flatMap(pair => [pair.team1Id, pair.team2Id])).size).toBe(8)
    expect(result.pairs.some(pair => records[pair.team1Id].wins !== records[pair.team2Id].wins)).toBe(true)
  })

  it('uses a rematch only when every complete pairing requires one', () => {
    const previous = [
      match({ id: 'm1', team1Id: 'A', team2Id: 'B' }),
      match({ id: 'm2', team1Id: 'A', team2Id: 'C' }),
      match({ id: 'm3', team1Id: 'A', team2Id: 'D' }),
    ]
    const result = createSwissPairings(['A', 'B', 'C', 'D'], previous)

    expect(result.pairs).toHaveLength(2)
    expect(result.hasRematches).toBe(true)
  })
})

describe('Swiss round sequence', () => {
  it('requires the first round before any later round', () => {
    expect(getSwissRoundError([], 2)).toContain('primera ronda')
  })

  it('does not allow generating a round twice or skipping one', () => {
    const rounds = [match({ id: 'm1', round: 1 })]
    expect(getSwissRoundError(rounds, 1)).toContain('siguiente ronda')
    expect(getSwissRoundError(rounds, 3)).toContain('siguiente ronda')
  })

  it('requires the previous round to be confirmed', () => {
    const rounds = [match({ id: 'm1', round: 1, result: { team1Score: 1, team2Score: 0 }, winnerId: 'A' })]
    expect(getSwissRoundError(rounds, 2)).toContain('confirmarse')
    expect(getSwissRoundError(rounds, 2, [1])).toBeNull()
  })

  it('requires every previous match to have a decisive result', () => {
    const rounds = [match({ id: 'm1', round: 1, result: { team1Score: 1, team2Score: 1 } })]
    expect(getSwissRoundError(rounds, 2, [1])).toContain('sin empates')
  })

  it('only permits confirming existing rounds without gaps', () => {
    const rounds = [match({ id: 'm1', round: 1 })]
    expect(getSwissConfirmationError(rounds, [2])).toContain('orden')
    expect(getSwissConfirmationError(rounds, [1, 2])).toContain('aún no existe')
    expect(getSwissConfirmationError(rounds, [1])).toBeNull()
  })
})
