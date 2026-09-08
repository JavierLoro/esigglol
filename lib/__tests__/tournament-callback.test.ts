import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  matches: [] as Array<{
    id: string
    tournamentCodes: string[]
    tournamentCallbackToken: string
    riotMatchIds: string[]
  }>,
}))
const saveMatches = vi.hoisted(() => vi.fn())
const publishRiotResult = vi.hoisted(() => vi.fn())

vi.mock('../data', () => ({
  getMatches: () => state.matches,
  saveMatches,
}))
vi.mock('../riot-events', () => ({ publishRiotResult }))

import { POST } from '@/app/api/tournament/callback/route'

function callbackRequest(metadata: string, gameId = 123): Request {
  return new Request('http://localhost/api/tournament/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortCode: 'CODE-1', metaData: metadata, gameId }),
  })
}

describe('Riot Tournament callback', () => {
  beforeEach(() => {
    saveMatches.mockReset()
    publishRiotResult.mockReset()
    state.matches = [{
      id: 'match-1',
      tournamentCodes: ['CODE-1'],
      tournamentCallbackToken: 'secret-token',
      riotMatchIds: [],
    }]
  })

  it('persists a game when code and metadata match', async () => {
    const response = await POST(callbackRequest(JSON.stringify({
      matchId: 'match-1',
      callbackToken: 'secret-token',
    })) as never)

    expect(response.status).toBe(200)
    expect(state.matches[0].riotMatchIds).toEqual(['123'])
    expect(saveMatches).toHaveBeenCalledOnce()
    expect(publishRiotResult).toHaveBeenCalledOnce()
  })

  it('ignores callbacks with invalid metadata', async () => {
    const response = await POST(callbackRequest(JSON.stringify({
      matchId: 'match-1',
      callbackToken: 'wrong-token',
    })) as never)

    expect(response.status).toBe(200)
    expect(state.matches[0].riotMatchIds).toEqual([])
    expect(saveMatches).not.toHaveBeenCalled()
  })

  it('is idempotent for repeated game IDs', async () => {
    state.matches[0].riotMatchIds.push('123')
    const response = await POST(callbackRequest(JSON.stringify({
      matchId: 'match-1',
      callbackToken: 'secret-token',
    })) as never)

    expect(response.status).toBe(200)
    expect(state.matches[0].riotMatchIds).toEqual(['123'])
    expect(saveMatches).not.toHaveBeenCalled()
  })
})
