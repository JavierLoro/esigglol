import { describe, expect, it } from 'vitest'
import { getPublishedTournamentData, isPhasePublished } from '../publication'
import type { Match, Phase } from '../types'

function phase(type: Phase['type'], confirmedBracket?: boolean): Phase {
  return {
    id: type,
    name: type,
    type,
    status: 'upcoming',
    order: 1,
    config: { bo: 1, confirmedBracket },
  }
}

function match(phaseId: string): Match {
  return { id: `match-${phaseId}`, phaseId, round: 1, team1Id: 'a', team2Id: 'b', result: null, riotMatchIds: [] }
}

describe('publication de fases', () => {
  it('solo publica brackets confirmados y siempre publica fases no bracket', () => {
    expect(isPhasePublished(phase('elimination'))).toBe(false)
    expect(isPhasePublished(phase('elimination', true))).toBe(true)
    expect(isPhasePublished(phase('groups'))).toBe(true)
  })

  it('filtra fases y partidos privados de la respuesta pública', () => {
    const phases = [phase('groups'), phase('elimination'), phase('final-four', true)]
    const result = getPublishedTournamentData(phases, phases.map(p => match(p.id)))
    expect(result.phases.map(p => p.id)).toEqual(['groups', 'final-four'])
    expect(result.matches.map(m => m.phaseId)).toEqual(['groups', 'final-four'])
  })
})
