import { describe, expect, it } from 'vitest'
import { getPublishedMatch, getPublishedMatches, getPublishedTournamentData, isPhasePublished } from '../publication'
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

const BRACKET_TYPES: Phase['type'][] = ['elimination', 'final-four', 'upper-lower']

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

  it.each(BRACKET_TYPES)('mantiene %s fuera de todas las consultas públicas antes de confirmar', type => {
    const draftPhase = phase(type, false)
    const draftMatch = match(draftPhase.id)

    expect(getPublishedMatches([draftPhase], [draftMatch])).toEqual([])
    expect(getPublishedMatch(draftMatch.id, [draftPhase], [draftMatch])).toBeUndefined()
    expect(getPublishedTournamentData([draftPhase], [draftMatch])).toEqual({ phases: [], matches: [] })
  })

  it.each(BRACKET_TYPES)('publica %s de forma consistente después de confirmar', type => {
    const confirmedPhase = phase(type, true)
    const confirmedMatch = match(confirmedPhase.id)

    expect(getPublishedMatches([confirmedPhase], [confirmedMatch])).toEqual([confirmedMatch])
    expect(getPublishedMatch(confirmedMatch.id, [confirmedPhase], [confirmedMatch])).toEqual(confirmedMatch)
    expect(getPublishedTournamentData([confirmedPhase], [confirmedMatch])).toEqual({
      phases: [confirmedPhase],
      matches: [confirmedMatch],
    })
  })

  it('no publica partidos huérfanos aunque su fase no pueda evaluarse', () => {
    expect(getPublishedMatches([], [match('missing')])).toEqual([])
  })
})
