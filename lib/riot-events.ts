export interface RiotResultEvent {
  matchId: string
  gameId: string
  shortCode: string
  receivedAt: string
}

type Listener = (event: RiotResultEvent) => void

// The app runs as a single Node process, so an in-memory subscriber registry
// is enough for the admin live notification channel. Subscribers are removed
// when their SSE request is aborted.
const listeners = new Set<Listener>()

export function subscribeToRiotResults(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishRiotResult(event: RiotResultEvent): void {
  for (const listener of listeners) listener(event)
}
