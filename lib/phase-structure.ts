import type { Phase } from './types'

export const STRUCTURAL_PHASE_FIELDS = [
  'type',
  'order',
  'config.bo',
  'config.advanceCount',
  'config.groups',
  'config.rounds',
  'config.swissTeamIds',
  'config.swissSize',
  'config.advanceWins',
  'config.eliminateLosses',
  'config.roundBo',
  'config.bracketTeamIds',
  'config.include3rdPlace',
] as const

export type StructuralPhaseField = typeof STRUCTURAL_PHASE_FIELDS[number]

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]))
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])
    return [...keys].every(key => valuesEqual(leftRecord[key], rightRecord[key]))
  }
  return false
}

function structuralValue(phase: Phase, field: StructuralPhaseField): unknown {
  if (field === 'type' || field === 'order') return phase[field]
  return phase.config[field.slice('config.'.length) as keyof Phase['config']]
}

export function changedStructuralPhaseFields(current: Phase, next: Phase): StructuralPhaseField[] {
  return STRUCTURAL_PHASE_FIELDS.filter(field => !valuesEqual(structuralValue(current, field), structuralValue(next, field)))
}

