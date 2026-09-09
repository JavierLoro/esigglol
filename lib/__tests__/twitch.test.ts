import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadStatus() {
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
  process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
  process.env.TWITCH_CHANNEL = 'esiuclm'
  vi.resetModules()
  return (await import('@/lib/twitch')).getTwitchStatus
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('Twitch live status', () => {
  it('is neutral and makes no request when credentials are unavailable', async () => {
    delete process.env.TWITCH_CLIENT_ID
    delete process.env.TWITCH_CLIENT_SECRET
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const getTwitchStatus = await loadStatus()

    await expect(getTwitchStatus()).resolves.toMatchObject({ status: 'unknown' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only reports live when Helix returns a stream and reuses the short cache', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-id'
    process.env.TWITCH_CLIENT_SECRET = 'client-secret'
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'stream-1', type: 'live' }] }))
    const getTwitchStatus = await loadStatus()

    await expect(getTwitchStatus()).resolves.toMatchObject({ status: 'live' })
    await expect(getTwitchStatus()).resolves.toMatchObject({ status: 'live' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports offline for an empty Helix result', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-id'
    process.env.TWITCH_CLIENT_SECRET = 'client-secret'
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ data: [] }))
    const getTwitchStatus = await loadStatus()

    await expect(getTwitchStatus()).resolves.toMatchObject({ status: 'offline' })
  })

  it('falls back to unknown when Twitch fails', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-id'
    process.env.TWITCH_CLIENT_SECRET = 'client-secret'
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))
    const getTwitchStatus = await loadStatus()

    await expect(getTwitchStatus()).resolves.toMatchObject({ status: 'unknown' })
  })
})
