import { describe, expect, it } from 'vitest'
import { createSwissPairings, getSwissConfirmationError, getSwissRecords, getSwissRoundError } from '../swiss'
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
