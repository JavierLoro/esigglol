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
    expect(tournament.TOURNAMENT_BASE).toBe('https://europe.api.riotgames.com/lol/tournament-stub/v5')
  })

  it('uses the production endpoint when explicitly enabled', async () => {
    vi.resetModules()
    process.env.TOURNAMENT_API_MODE = 'production'
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'

    const tournament = await import('@/lib/tournament')
    expect(tournament.TOURNAMENT_BASE).toBe('https://europe.api.riotgames.com/lol/tournament/v5')
  })
})
