import { describe, expect, it } from 'vitest'
import { findTeamReferences } from '@/lib/data'
import type { Match, Phase } from '@/lib/types'

const phase = (config: Phase['config']): Phase => ({
  id: 'phase-1',
  name: 'Fase',
  type: 'groups',
  status: 'upcoming',
  order: 0,
  config,
})

const match = (team1Id: string, team2Id: string): Match => ({
  id: `match-${team1Id}-${team2Id}`,
  phaseId: 'phase-1',
  round: 1,
  team1Id,
  team2Id,
  result: null,
  riotMatchIds: [],
})

describe('findTeamReferences', () => {
  it('finds teams in every phase configuration and match slot', () => {
    const phases = [
      phase({ bo: 1, groups: [{ id: 'group-1', teamIds: ['team-a'] }] }),
      { ...phase({ bo: 1, swissTeamIds: ['team-a'] }), id: 'phase-2' },
      { ...phase({ bo: 1, bracketTeamIds: ['team-a'] }), id: 'phase-3' },
    ]

    expect(findTeamReferences('team-a', phases, [match('team-a', 'team-b')])).toEqual({
      phaseIds: ['phase-1', 'phase-2', 'phase-3'],
      matchIds: ['match-team-a-team-b'],
    })
  })

  it('does not report unrelated phases or matches', () => {
    const phases = [phase({ bo: 1, groups: [{ id: 'group-1', teamIds: ['team-b'] }] })]

    expect(findTeamReferences('team-a', phases, [match('team-b', 'TBD')])).toEqual({
      phaseIds: [],
      matchIds: [],
    })
  })
})
