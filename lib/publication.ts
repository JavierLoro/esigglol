import type { Match, Phase } from './types'

const BRACKET_TYPES = new Set<Phase['type']>(['elimination', 'final-four', 'upper-lower'])

/** Brackets are private until an administrator explicitly publishes them. */
export function isPhasePublished(phase: Phase): boolean {
  return !BRACKET_TYPES.has(phase.type) || phase.config.confirmedBracket === true
}

/** Returns only matches whose owning phase is currently public. */
export function getPublishedMatches(phases: Phase[], matches: Match[]): Match[] {
  const publishedIds = new Set(phases.filter(isPhasePublished).map(phase => phase.id))
  return matches.filter(match => publishedIds.has(match.phaseId))
}

/** Resolves a match using the same policy used by every public listing. */
export function getPublishedMatch(
  matchId: string,
  phases: Phase[],
  matches: Match[],
): Match | undefined {
  return getPublishedMatches(phases, matches).find(match => match.id === matchId)
}

export function getPublishedTournamentData(phases: Phase[], matches: Match[]) {
  const publishedPhases = phases.filter(isPhasePublished)
  return {
    phases: publishedPhases,
    matches: getPublishedMatches(phases, matches),
  }
}
