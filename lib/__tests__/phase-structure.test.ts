import { describe, expect, it } from 'vitest'
import { changedStructuralPhaseFields, STRUCTURAL_PHASE_FIELDS } from '../phase-structure'
import type { Phase } from '../types'

const basePhase: Phase = {
  id: 'phase-1',
  name: 'Fase inicial',
  type: 'swiss',
  status: 'upcoming',
  order: 1,
  config: {
    bo: 1,
    advanceCount: 2,
    groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }],
    rounds: 3,
    swissTeamIds: ['team-1', 'team-2'],
    swissSize: 8,
    advanceWins: 2,
    eliminateLosses: 2,
    roundBo: { '1': 1 },
    bracketTeamIds: ['team-1', 'team-2'],
    include3rdPlace: false,
    confirmedRounds: [1],
    confirmedBracket: false,
  },
}

const structuralChanges: Record<(typeof STRUCTURAL_PHASE_FIELDS)[number], (phase: Phase) => Phase> = {
  type: phase => ({ ...phase, type: 'elimination' }),
  order: phase => ({ ...phase, order: 2 }),
  'config.bo': phase => ({ ...phase, config: { ...phase.config, bo: 3 } }),
  'config.advanceCount': phase => ({ ...phase, config: { ...phase.config, advanceCount: 1 } }),
  'config.groups': phase => ({ ...phase, config: { ...phase.config, groups: [{ id: 'B', teamIds: ['team-2', 'team-1'] }] } }),
  'config.rounds': phase => ({ ...phase, config: { ...phase.config, rounds: 4 } }),
  'config.swissTeamIds': phase => ({ ...phase, config: { ...phase.config, swissTeamIds: ['team-2', 'team-1'] } }),
  'config.swissSize': phase => ({ ...phase, config: { ...phase.config, swissSize: 16 } }),
  'config.advanceWins': phase => ({ ...phase, config: { ...phase.config, advanceWins: 3 } }),
  'config.eliminateLosses': phase => ({ ...phase, config: { ...phase.config, eliminateLosses: 3 } }),
  'config.roundBo': phase => ({ ...phase, config: { ...phase.config, roundBo: { '1': 3 } } }),
  'config.bracketTeamIds': phase => ({ ...phase, config: { ...phase.config, bracketTeamIds: ['team-2', 'team-1'] } }),
  'config.include3rdPlace': phase => ({ ...phase, config: { ...phase.config, include3rdPlace: true } }),
}

describe('phase structural fields', () => {
  it.each(STRUCTURAL_PHASE_FIELDS)('detects a change to %s', field => {
    expect(changedStructuralPhaseFields(basePhase, structuralChanges[field](basePhase))).toEqual([field])
  })

  it.each([
    ['name', { ...basePhase, name: 'Nuevo nombre' }],
    ['status', { ...basePhase, status: 'active' as const }],
    ['confirmedRounds', { ...basePhase, config: { ...basePhase.config, confirmedRounds: [1, 2] } }],
    ['confirmedBracket', { ...basePhase, config: { ...basePhase.config, confirmedBracket: true } }],
  ])('allows the non-structural field %s', (_field, nextPhase) => {
    expect(changedStructuralPhaseFields(basePhase, nextPhase as Phase)).toEqual([])
  })
})

