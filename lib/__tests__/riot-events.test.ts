import { publishRiotResult, subscribeToRiotResults } from '@/lib/riot-events'
import { describe, expect, it } from 'vitest'

describe('riot result notifications', () => {
  it('delivers events to active subscribers and stops after unsubscribe', () => {
    const received: string[] = []
    const unsubscribe = subscribeToRiotResults(event => received.push(event.gameId))
    const event = { matchId: 'match-1', gameId: '123', shortCode: 'CODE', receivedAt: '2026-01-01T00:00:00.000Z' }

    publishRiotResult(event)
    unsubscribe()
    publishRiotResult({ ...event, gameId: '456' })

    expect(received).toEqual(['123'])
  })
})
