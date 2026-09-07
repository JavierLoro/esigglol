import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getRefreshState: vi.fn(),
  getRefreshTarget: vi.fn(),
  runPlayerRefresh: vi.fn(),
  after: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/refresh', () => ({
  getRefreshState: mocks.getRefreshState,
  getRefreshTarget: mocks.getRefreshTarget,
  runPlayerRefresh: mocks.runPlayerRefresh,
}))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: mocks.after }
})

describe('POST /api/riot/refresh-stats/player', () => {
  let POST: typeof import('@/app/api/riot/refresh-stats/player/route').POST

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
    ;({ POST } = await import('@/app/api/riot/refresh-stats/player/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.getRefreshState.mockReturnValue({ running: false, keyExpired: false, lastUpdated: null })
    mocks.getRefreshTarget.mockReturnValue({ player: { summonerName: 'Player#EUW' }, team: { id: 'team-1' } })
  })

  it('rechaza la petición sin sesión admin', async () => {
    mocks.requireAdminSession.mockResolvedValue(Response.json({ error: 'No autorizado' }, { status: 401 }))
    const response = await POST(new Request('http://localhost/api/riot/refresh-stats/player', {
      method: 'POST', body: JSON.stringify({ summonerName: 'Player#EUW' }),
    }))
    expect(response.status).toBe(401)
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('valida el jugador y evita competir con otro refresh', async () => {
    const invalid = await POST(new Request('http://localhost/api/riot/refresh-stats/player', {
      method: 'POST', body: '{}',
    }))
    expect(invalid.status).toBe(400)

    mocks.getRefreshState.mockReturnValue({ running: true, keyExpired: false, lastUpdated: null })
    const running = await POST(new Request('http://localhost/api/riot/refresh-stats/player', {
      method: 'POST', body: JSON.stringify({ summonerName: 'Player#EUW' }),
    }))
    expect(running.status).toBe(409)
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('programa el refresh en background después de validar la sesión', async () => {
    let callback: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((fn: () => Promise<void>) => { callback = fn })
    const response = await POST(new Request('http://localhost/api/riot/refresh-stats/player', {
      method: 'POST', body: JSON.stringify({ summonerName: 'Player#EUW' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'started', summonerName: 'Player#EUW' })
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(callback).toBeDefined()
    await callback!()
    expect(mocks.runPlayerRefresh).toHaveBeenCalledWith('Player#EUW')
  })
})
