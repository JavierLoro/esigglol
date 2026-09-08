import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => new Map<string, string>())
const prepare = vi.hoisted(() => vi.fn((sql: string) => {
  if (sql.startsWith('SELECT')) {
    return { get: (key: string) => storage.has(key) ? { data: storage.get(key) } : undefined }
  }
  if (sql.startsWith('DELETE')) {
    return { run: (key: string) => storage.delete(key) }
  }
  return { run: (key: string, data: string) => storage.set(key, data) }
}))

vi.mock('../db', () => ({ default: { prepare } }))
vi.mock('../data', () => ({ getRiotApiKey: () => 'test-riot-key' }))

describe('tournament config persistence', () => {
  let getTournamentConfig: typeof import('../tournament').getTournamentConfig
  let saveTournamentConfig: typeof import('../tournament').saveTournamentConfig
  let deleteTournamentConfig: typeof import('../tournament').deleteTournamentConfig

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH ??= '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
    const tournament = await import('../tournament')
    getTournamentConfig = tournament.getTournamentConfig
    saveTournamentConfig = tournament.saveTournamentConfig
    deleteTournamentConfig = tournament.deleteTournamentConfig
  })

  afterEach(() => storage.clear())

  it('deletes only the tournament config row', () => {
    storage.set('riot-api-key', JSON.stringify('preserve-me'))
    saveTournamentConfig({ providerId: 12, tournamentId: 34 })

    deleteTournamentConfig()

    expect(getTournamentConfig()).toBeNull()
    expect(storage.get('riot-api-key')).toBe(JSON.stringify('preserve-me'))
  })

  it('is safe to call when no tournament is configured', () => {
    expect(() => deleteTournamentConfig()).not.toThrow()
    expect(getTournamentConfig()).toBeNull()
  })
})

describe('Tournament API endpoint', () => {
  it('uses the stub endpoint by default', async () => {
    vi.resetModules()
    delete process.env.TOURNAMENT_API_MODE
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'

    const tournament = await import('@/lib/tournament')
    expect(tournament.TOURNAMENT_BASE).toBe('https://euw1.api.riotgames.com/lol/tournament-stub/v5')
  })

  it('uses the production endpoint when explicitly enabled', async () => {
    vi.resetModules()
    process.env.TOURNAMENT_API_MODE = 'production'
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'

    const tournament = await import('@/lib/tournament')
    expect(tournament.TOURNAMENT_BASE).toBe('https://euw1.api.riotgames.com/lol/tournament/v5')
  })
})

describe('Tournament API contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TOURNAMENT_API_MODE
  })

  it('sends the v5 code fields and metadata using the official names', async () => {
    vi.resetModules()
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
    const fetchMock = vi.fn().mockResolvedValue(new Response('["CODE-1"]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { generateCodes } = await import('../tournament')
    await expect(generateCodes(42, 1, {
      allowedParticipants: ['puuid-1'],
      metadata: '{"matchId":"match-1"}',
    })).resolves.toEqual(['CODE-1'])

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(request.body))).toMatchObject({
      allowedParticipants: ['puuid-1'],
      enoughPlayers: true,
      metadata: '{"matchId":"match-1"}',
    })
  })

  it('reads lobby events from eventList', async () => {
    vi.resetModules()
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      eventList: [{ eventType: 'PlayerJoinedGameEvent', timestamp: '123', puuid: 'encrypted' }],
    }), { status: 200 })))

    const { getLobbyEvents } = await import('../tournament')
    await expect(getLobbyEvents('CODE-1')).resolves.toEqual([
      { eventType: 'PlayerJoinedGameEvent', timestamp: '123', puuid: 'encrypted' },
    ])
  })
})
