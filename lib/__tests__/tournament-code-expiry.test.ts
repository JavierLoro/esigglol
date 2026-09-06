import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ default: { prepare: vi.fn() } }))
vi.mock('../data', () => ({ getRiotApiKey: () => 'test-key' }))

describe('tournament code expiry checks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves Riot status 404 so expired codes can be regenerated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('code not found', { status: 404 }),
    ))

    const { getCodeDetails, TournamentApiError } = await import('../tournament')
    await expect(getCodeDetails('EUW-EXPIRED')).rejects.toMatchObject({
      status: 404,
      name: 'TournamentApiError',
    })
    await expect(getCodeDetails('EUW-EXPIRED')).rejects.toBeInstanceOf(TournamentApiError)
  })

  it('returns details for active codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"gameId":123}', { status: 200 }),
    ))

    const { getCodeDetails } = await import('../tournament')
    await expect(getCodeDetails('EUW-ACTIVE')).resolves.toEqual({ gameId: 123 })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/codes/EUW-ACTIVE'),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Riot-Token': 'test-key' }) }),
    )
  })
})
