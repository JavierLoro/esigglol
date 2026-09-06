import type { Match, Phase } from './types'

const BRACKET_TYPES = new Set<Phase['type']>(['elimination', 'final-four', 'upper-lower'])

/** Brackets are private until an administrator explicitly publishes them. */
export function isPhasePublished(phase: Phase): boolean {
  return !BRACKET_TYPES.has(phase.type) || phase.config.confirmedBracket === true
}

export function getPublishedTournamentData(phases: Phase[], matches: Match[]) {
  const publishedPhases = phases.filter(isPhasePublished)
  const publishedIds = new Set(publishedPhases.map(phase => phase.id))
  return {
    phases: publishedPhases,
    matches: matches.filter(match => publishedIds.has(match.phaseId)),
  }
}
