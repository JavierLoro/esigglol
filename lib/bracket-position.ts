import type { Match } from './types'

/**
 * Returns matches in their persisted bracket topology.
 *
 * Older records have no bracketPosition. Their database order is retained as
 * a compatibility fallback; random match IDs are never used as seeding data.
 */
export function orderBracketMatches(matches: Match[]): Match[] {
  return matches
    .map((match, storedIndex) => ({ match, storedIndex }))
    .sort((a, b) => {
      const aPosition = a.match.bracketPosition ?? a.storedIndex
      const bPosition = b.match.bracketPosition ?? b.storedIndex
      return aPosition - bPosition || a.storedIndex - b.storedIndex
    })
    .map(({ match }) => match)
}
