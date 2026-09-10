import { bracketSizeError, isPowerOfTwoAtLeastFour } from './bracket-sizes'
import type { Phase, PhaseType } from './types'

export interface GroupsValidationInput {
  groups?: ReadonlyArray<{ id: string; teamIds: ReadonlyArray<string> }>
  advanceCount?: number
}

/** Returns the teams that may participate in matches for a configured phase. */
export function getPhaseTeamIds(phase: Phase): string[] {
  const config = phase.config
  switch (phase.type) {
    case 'groups': {
      return [...new Set((config.groups ?? []).flatMap(group => group.teamIds))]
    }
    case 'swiss':
      return config.swissTeamIds ?? []
    case 'elimination':
    case 'final-four':
    case 'upper-lower':
      return config.bracketTeamIds ?? []
  }
}

/** Returns the configuration errors shared by the admin client and API. */
export function validateGroupsConfig(config: GroupsValidationInput): string[] {
  const groups = config.groups ?? []
  const errors: string[] = []
  const groupIds = new Set<string>()
  const teamGroups = new Map<string, string>()

  if (groups.length === 0) {
    errors.push('Añade al menos un grupo con 2 equipos')
  }

  for (const group of groups) {
    const groupTeamIds = new Set<string>()
    if (groupIds.has(group.id)) {
      errors.push(`El id de grupo «${group.id}» está repetido`)
    }
    groupIds.add(group.id)

    if (group.teamIds.length < 2) {
      errors.push(`El grupo «${group.id}» debe tener al menos 2 equipos`)
    }

    for (const teamId of group.teamIds) {
      if (groupTeamIds.has(teamId)) {
        errors.push(`El equipo «${teamId}» está repetido en el grupo «${group.id}»`)
      }
      groupTeamIds.add(teamId)
      const previousGroup = teamGroups.get(teamId)
      if (previousGroup !== undefined && previousGroup !== group.id) {
        errors.push(`El equipo «${teamId}» pertenece a varios grupos (${previousGroup} y ${group.id})`)
      }
      teamGroups.set(teamId, group.id)
    }

    const advanceCount = config.advanceCount ?? 2
    if (advanceCount >= group.teamIds.length) {
      errors.push(`advanceCount debe ser menor que el tamaño del grupo «${group.id}»`)
    }
  }

  return errors
}

export interface PhaseParticipantsInput extends GroupsValidationInput {
  swissTeamIds?: ReadonlyArray<string>
  bracketTeamIds?: ReadonlyArray<string>
  lowerBracketTeamIds?: ReadonlyArray<string>
}

/** Validates participant cardinality and structure for every phase format. */
export function validatePhaseParticipants(type: PhaseType, config: PhaseParticipantsInput): string[] {
  if (type === 'groups') return validateGroupsConfig(config)

  const teamIds = type === 'swiss' ? (config.swissTeamIds ?? []) : (config.bracketTeamIds ?? [])
  const errors: string[] = []
  if (new Set(teamIds).size !== teamIds.length) errors.push('Un equipo no puede aparecer más de una vez')
  const sizeError = bracketSizeError(type, new Set(teamIds).size)
  if (sizeError) errors.push(sizeError)
  if (type === 'upper-lower') {
    const participantIds = new Set(teamIds)
    const lowerIds = config.lowerBracketTeamIds ?? []
    const uniqueLowerIds = new Set(lowerIds)
    if (uniqueLowerIds.size !== lowerIds.length) errors.push('Un equipo no puede aparecer más de una vez en Lower')
    if (lowerIds.some(teamId => !participantIds.has(teamId))) errors.push('Todos los equipos de Lower deben estar seleccionados en la fase')

    const upperCount = participantIds.size - uniqueLowerIds.size
    const lowerCount = uniqueLowerIds.size
    if (lowerCount === 0) {
      if (!isPowerOfTwoAtLeastFour(upperCount)) errors.push('Si todos empiezan en Upper, su cantidad debe ser una potencia de 2 desde 4')
    } else if (!isPowerOfTwoAtLeastFour(upperCount) || upperCount !== lowerCount * 2) {
      errors.push('El reparto inicial debe tener una potencia de 2 en Upper y exactamente la mitad en Lower (4+2, 8+4, 16+8...)')
    }
  }
  return errors
}
