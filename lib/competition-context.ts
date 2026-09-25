import { AsyncLocalStorage } from 'node:async_hooks'

export const LEGACY_TOURNAMENT_ID = 'legacy-lol'
const context = new AsyncLocalStorage<string>()
export const currentTournamentId = () => context.getStore() ?? LEGACY_TOURNAMENT_ID
export function inTournament<T>(id: string, action: () => T): T {
  return context.run(id, action)
}
