import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team, Phase } from '../types'

type Row = { data: string }

const selectTeamsMock = vi.fn<() => Row[]>()
const selectPhasesMock = vi.fn<() => Row[]>()
const runMock = vi.fn()
const transactionMock = vi.fn((fn: () => void) => () => fn())

vi.mock('../db', () => ({
  default: {
    prepare: vi.fn((sql: string) => {
      if (sql === 'SELECT data FROM teams') {
        return { all: selectTeamsMock }
      }
      if (sql === 'SELECT data FROM phases ORDER BY order_ ASC') {
        return { all: selectPhasesMock }
      }
      if (sql === 'INSERT OR REPLACE INTO phases (id, order_, data) VALUES (?, ?, ?)') {
        return { run: runMock }
      }
      if (sql === 'DELETE FROM teams') {
        return { run: runMock }
      }
      if (sql === 'INSERT INTO teams (id, data) VALUES (?, ?)') {
        return { run: runMock }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    }),
    transaction: transactionMock,
  },
}))

describe('data cache for teams/phases', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('reuses teams cache within TTL and reloads after saveTeams invalidation', async () => {
    selectTeamsMock
      .mockReturnValueOnce([{
        data: JSON.stringify({ id: 't1', name: 'Team 1', logoUrl: '', players: [] }),
      }])
      .mockReturnValueOnce([{
        data: JSON.stringify({ id: 't2', name: 'Team 2', logoUrl: '', players: [] }),
      }])

    const data = await import('../data')

    const first = data.getTeams()
    const second = data.getTeams()
    expect(second).toBe(first)
    expect(selectTeamsMock).toHaveBeenCalledTimes(1)

    const team: Team = { id: 't3', name: 'Team 3', logoUrl: '', players: [] }
    data.saveTeams([team])
    expect(transactionMock).toHaveBeenCalledTimes(1)

    const third = data.getTeams()
    expect(third).not.toBe(first)
    expect(third[0].id).toBe('t2')
    expect(selectTeamsMock).toHaveBeenCalledTimes(2)
  })

  it('reuses phases cache within TTL and reloads after savePhase invalidation', async () => {
    selectPhasesMock
      .mockReturnValueOnce([{
        data: JSON.stringify({ id: 'p1', name: 'Phase 1', type: 'groups', status: 'active', order: 1, config: { bo: 1 } }),
      }])
      .mockReturnValueOnce([{
        data: JSON.stringify({ id: 'p2', name: 'Phase 2', type: 'groups', status: 'active', order: 2, config: { bo: 1 } }),
      }])

    const data = await import('../data')
    const first = data.getPhases()
    const second = data.getPhases()
    expect(second).toBe(first)
    expect(selectPhasesMock).toHaveBeenCalledTimes(1)

    const phase: Phase = {
      id: 'pX',
      name: 'Phase X',
      type: 'groups',
      status: 'active',
      order: 10,
      config: { bo: 1 },
    }
    data.savePhase(phase)
    expect(runMock).toHaveBeenCalledTimes(1)

    const third = data.getPhases()
    expect(third).not.toBe(first)
    expect(third[0].id).toBe('p2')
    expect(selectPhasesMock).toHaveBeenCalledTimes(2)
  })

  it('expires teams cache after TTL window', async () => {
    vi.useFakeTimers()
    try {
      selectTeamsMock
        .mockReturnValueOnce([{
          data: JSON.stringify({ id: 't1', name: 'Team 1', logoUrl: '', players: [] }),
        }])
        .mockReturnValueOnce([{
          data: JSON.stringify({ id: 't2', name: 'Team 2', logoUrl: '', players: [] }),
        }])

      const data = await import('../data')
      const first = data.getTeams()
      vi.advanceTimersByTime(5_001)
      const second = data.getTeams()

      expect(second).not.toBe(first)
      expect(second[0].id).toBe('t2')
      expect(selectTeamsMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
