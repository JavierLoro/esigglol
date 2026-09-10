import { beforeAll, describe, expect, it } from 'vitest'
import type { Match, Phase } from '../types'

describe('atomic entity mutations', () => {
  let data: typeof import('../data')

  beforeAll(async () => {
    process.env.DB_PATH = `.tmp/atomic-entities-${process.pid}.db`
    data = await import('../data')
  })

  it('rejects an interleaved stale update without losing another row', () => {
    const first = data.createTeam({ id: 'team-a', name: 'A', logo: '', players: [] })
    data.createTeam({ id: 'team-b', name: 'B', logo: '', players: [] })
    const staleSnapshot = { ...first }

    const saved = data.updateTeam({ ...first, name: 'A saved' })

    expect(() => data.updateTeam({ ...staleSnapshot, name: 'A stale' })).toThrow(data.StaleWriteError)
    expect(data.getTeamById('team-a')).toMatchObject({ name: 'A saved', version: saved.version })
    expect(data.getTeamById('team-b')).toMatchObject({ name: 'B' })
  })

  it('deletes a phase and its matches in one transaction', () => {
    const phase = data.createPhase({
      id: 'phase-a', name: 'Phase', type: 'elimination', status: 'upcoming', order: 1,
      config: { bo: 1, bracketTeamIds: ['team-a', 'team-b'] },
    } satisfies Phase)
    data.createMatches([{
      id: 'match-a', phaseId: phase.id, round: 1, team1Id: 'team-a', team2Id: 'team-b',
      result: null, riotMatchIds: [],
    } satisfies Match])

    expect(data.deletePhase(phase.id, phase.version!)).toBe(true)
    expect(data.getPhaseById(phase.id)).toBeUndefined()
    expect(data.getMatchesByPhase(phase.id)).toEqual([])
  })

  it('commits bracket and phase changes together and rejects stale snapshots', () => {
    const phase = data.createPhase({
      id: 'phase-b', name: 'Phase B', type: 'elimination', status: 'upcoming', order: 2,
      config: { bo: 1, bracketTeamIds: ['team-a', 'team-b'] },
    })
    const [match] = data.createMatches([{
      id: 'match-b', phaseId: phase.id, round: 1, team1Id: 'team-a', team2Id: 'team-b',
      result: null, riotMatchIds: [],
    }])

    data.commitTournamentChanges(
      [{ ...match, result: { team1Score: 1, team2Score: 0 }, winnerId: 'team-a' }],
      {},
      [{ ...phase, status: 'completed' }],
    )

    expect(data.getMatchById(match.id)).toMatchObject({ winnerId: 'team-a', version: 2 })
    expect(data.getPhaseById(phase.id)).toMatchObject({ status: 'completed', version: 2 })
    expect(() => data.commitTournamentChanges([{ ...match, scheduledAt: new Date().toISOString() }])).toThrow(data.StaleWriteError)
  })
})
