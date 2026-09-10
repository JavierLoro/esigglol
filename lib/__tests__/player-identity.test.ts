import { describe, expect, it } from 'vitest'
import { normalizeRiotId, reconcileCachedPlayers } from '../player-identity'
import type { PlayerRow, Team } from '../types'

const cached: PlayerRow = {
  playerId: 'player-1', summonerName: 'Old#EUW', puuid: 'puuid-1', profileIconId: 1,
  level: 10, tier: 'GOLD', rank: 'IV', lp: 2, wins: 3, losses: 4, winrate: 43,
  teamId: 'team-1', teamName: 'Alpha', teamLogo: '', primaryRole: 'Mid',
}

const team = (id: string, name: string, summonerName: string): Team => ({
  id, name, logo: `/${id}.png`,
  players: [{ id: 'player-1', summonerName, primaryRole: 'Top' }],
})

describe('stable player identity', () => {
  it('normalizes casing and whitespace around the Riot tag', () => {
    expect(normalizeRiotId(' Player  # EUW ')).toBe('player#euw')
  })

  it('keeps cache and PUUID on rename and casing changes', () => {
    expect(reconcileCachedPlayers([cached], [team('team-1', 'Alpha', 'New#euw')])).toEqual([
      expect.objectContaining({ playerId: 'player-1', summonerName: 'New#euw', puuid: 'puuid-1' }),
    ])
  })

  it('moves cached stats with the player id to another team', () => {
    expect(reconcileCachedPlayers([cached], [team('team-2', 'Beta', 'Old#EUW')])).toEqual([
      expect.objectContaining({ teamId: 'team-2', teamName: 'Beta', primaryRole: 'Top' }),
    ])
  })

  it('drops cache entries for deleted players', () => {
    expect(reconcileCachedPlayers([cached], [{ id: 'team-1', name: 'Alpha', logo: '', players: [] }])).toEqual([])
  })

  it('adopts stable ids for legacy cache entries by normalized Riot ID', () => {
    const legacy = { ...cached, playerId: undefined } as unknown as PlayerRow
    expect(reconcileCachedPlayers([legacy], [team('team-1', 'Alpha', ' old # euw ')])[0].playerId).toBe('player-1')
  })
})
