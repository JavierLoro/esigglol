import type { Match, Phase, PhaseStatus } from './types'

/** Returns true when the currently generated matches represent a finished phase. */
export function isPhaseComplete(phase: Phase, matches: Match[]): boolean {
  const phaseMatches = matches.filter(match => match.phaseId === phase.id)
  if (phaseMatches.length === 0 || phaseMatches.some(match => !match.result)) return false

  switch (phase.type) {
    case 'final-four':
      return phaseMatches.some(match => match.round === 2) &&
        (!phase.config.include3rdPlace || phaseMatches.some(match => match.round === 98))
    case 'upper-lower':
      return phaseMatches.some(match => match.round === 99)
    case 'elimination': {
      const lastRound = Math.max(...phaseMatches.map(match => match.round))
      return phaseMatches.filter(match => match.round === lastRound).length === 1
    }
    case 'groups':
    case 'swiss':
      return true
  }
}

/** Derives the lifecycle state from the results stored for a phase. */
export function derivePhaseStatus(phase: Phase, matches: Match[]): PhaseStatus {
  const phaseMatches = matches.filter(match => match.phaseId === phase.id)
  if (phaseMatches.some(match => match.result)) {
    return isPhaseComplete(phase, matches) ? 'completed' : 'active'
  }
  return 'upcoming'
}
