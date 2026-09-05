import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTeams: vi.fn(),
  getPlayerStatsCache: vi.fn(),
  savePlayerStatsCache: vi.fn(),
  getPlayerStats: vi.fn(),
  getChampionMastery: vi.fn(),
  getMatchIds: vi.fn(),
  getMatchDetails: vi.fn(),
  savePlayerMastery: vi.fn(),
  savePlayerMatches: vi.fn(),
  getStoredMatchIds: vi.fn(),
  ensureProfileIcon: vi.fn(),
}))

vi.mock('@/lib/data', () => ({
  getTeams: mocks.getTeams,
  getPlayerStatsCache: mocks.getPlayerStatsCache,
  savePlayerStatsCache: mocks.savePlayerStatsCache,
}))
vi.mock('@/lib/riot', () => ({
  getPlayerStats: mocks.getPlayerStats,
  getChampionMastery: mocks.getChampionMastery,
  getMatchIds: mocks.getMatchIds,
  getMatchDetails: mocks.getMatchDetails,
  RiotApiKeyError: class RiotApiKeyError extends Error {},
}))
vi.mock('@/lib/data-riot', () => ({
  savePlayerMastery: mocks.savePlayerMastery,
  savePlayerMatches: mocks.savePlayerMatches,
  getStoredMatchIds: mocks.getStoredMatchIds,
}))
vi.mock('@/lib/ddragon', () => ({ ensureProfileIcon: mocks.ensureProfileIcon }))

describe('refresh individual de jugadores', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getTeams.mockReturnValue([{
      id: 'team-1', name: 'Equipo 1', logo: '',
      players: [{ id: 'player-1', summonerName: 'Player One#EUW', primaryRole: 'Mid' }],
    }])
    mocks.getPlayerStatsCache.mockReturnValue({
      lastUpdated: '2026-01-01T00:00:00.000Z',
      players: [{
        summonerName: 'Other#EUW', puuid: 'old', profileIconId: 1, level: 10,
        tier: 'GOLD', rank: 'IV', lp: 0, wins: 1, losses: 1, winrate: 50,
        teamId: 'team-2', teamName: 'Equipo 2', teamLogo: '', primaryRole: 'Top',
      }],
    })
    mocks.getPlayerStats.mockResolvedValue({
      summonerName: 'Player One#EUW', puuid: 'new-puuid', profileIconId: 2,
      level: 42, tier: 'DIAMOND', rank: 'II', lp: 80, wins: 20, losses: 10, winrate: 67,
    })
    mocks.getChampionMastery.mockResolvedValue([])
    mocks.getMatchIds.mockResolvedValue([])
    mocks.getStoredMatchIds.mockReturnValue(new Set())
    mocks.ensureProfileIcon.mockResolvedValue(undefined)
  })

  it('normaliza el Riot ID al localizar el jugador configurado', async () => {
    const { getRefreshTarget } = await import('@/lib/refresh')
    expect(getRefreshTarget('  player one # euw ')).toMatchObject({
      player: { summonerName: 'Player One#EUW' },
      team: { id: 'team-1' },
    })
    expect(getRefreshTarget('unknown#EUW')).toBeNull()
  })

  it('actualiza solo la fila solicitada y conserva el resto de la cache', async () => {
    const { runPlayerRefresh } = await import('@/lib/refresh')
    const row = await runPlayerRefresh('player one#euw')

    expect(row).toMatchObject({ summonerName: 'Player One#EUW', tier: 'DIAMOND', teamId: 'team-1' })
    expect(mocks.savePlayerStatsCache).toHaveBeenCalledWith(expect.objectContaining({
      players: expect.arrayContaining([
        expect.objectContaining({ summonerName: 'Other#EUW' }),
        expect.objectContaining({ summonerName: 'Player One#EUW', tier: 'DIAMOND' }),
      ]),
    }))
  })

  it('rechaza una segunda ejecución mientras el refresh está en curso', async () => {
    let release!: () => void
    mocks.getPlayerStats.mockReturnValue(new Promise(resolve => {
      release = () => resolve({
        summonerName: 'Player One#EUW', puuid: '', profileIconId: 2,
        level: 42, tier: 'DIAMOND', rank: 'II', lp: 80, wins: 20, losses: 10, winrate: 67,
      })
    }))

    const { runPlayerRefresh } = await import('@/lib/refresh')
    const first = runPlayerRefresh('Player One#EUW')
    await expect(runPlayerRefresh('Player One#EUW')).rejects.toThrow('actualización en curso')
    release()
    await first
  })
})
