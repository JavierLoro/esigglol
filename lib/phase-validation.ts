export interface GroupsValidationInput {
  groups?: ReadonlyArray<{ id: string; teamIds: ReadonlyArray<string> }>
  advanceCount?: number
}

/** Returns the configuration errors shared by the admin client and API. */
export function validateGroupsConfig(config: GroupsValidationInput): string[] {
  const groups = config.groups ?? []
  const errors: string[] = []
  const groupIds = new Set<string>()
  const teamGroups = new Map<string, string>()

  for (const group of groups) {
    if (groupIds.has(group.id)) {
      errors.push(`El id de grupo «${group.id}» está repetido`)
    }
    groupIds.add(group.id)

    if (group.teamIds.length < 2) {
      errors.push(`El grupo «${group.id}» debe tener al menos 2 equipos`)
    }

    for (const teamId of group.teamIds) {
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
