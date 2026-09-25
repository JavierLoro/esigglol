import { describe, expect, it, vi } from 'vitest'
import { ValorantClient, checkValorantAccess, competitiveProfile, rankComparable, retainOfficialData, VALORANT_PERSONAL_DATA_PUBLIC } from '../valorant'
import { validateAndNormalizeMatch } from '../match-coherence'
import type { Match, Phase } from '../types'

describe('official Valorant API', () => {
  it('does not send a request without its independent credential', async () => {
    const fetcher = vi.fn()
    expect((await new ValorantClient('', fetcher).content()).availability).toBe('missing-key')
    expect(fetcher).not.toHaveBeenCalled()
    expect(VALORANT_PERSONAL_DATA_PUBLIC).toBe(false)
  })
  it.each([[401, 'unauthorized'], [403, 'forbidden'], [429, 'rate-limited'], [404, 'not-found'], [503, 'temporary-error']] as const)('reports HTTP %s without leaking secrets or upstream bodies', async (status, availability) => {
    const client = new ValorantClient('secret', vi.fn().mockResolvedValue(new Response('sensitive body', { status, headers: { 'Retry-After': '30' } })))
    const result = await client.content()
    expect(result).toMatchObject({ availability, httpStatus: status, retryAfter: '30', source: 'Riot Games' })
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(JSON.stringify(result)).not.toContain('sensitive')
  })
  it('validates every endpoint using official-shaped fixtures and fixed EU routing', async () => {
    const fixtures = [
      { puuid: 'p', gameName: 'Player', tagLine: 'EUW' },
      { version: '1', acts: [{ id: 'act', name: 'Act', isActive: true, type: 'act' }], maps: [{ id: 'map', name: 'Ascent' }] },
      { puuid: 'p', history: [{ matchId: 'm', gameStartTimeMillis: 1, queueId: 'competitive' }] },
      { matchInfo: { matchId: 'm', mapId: 'map' }, players: [{ puuid: 'p', teamId: 'Blue', competitiveTier: 21 }] },
      { actId: 'act', totalPlayers: 1, players: [{ puuid: 'p', leaderboardRank: 7, rankedRating: 100 }] },
    ]
    const transport = vi.fn<typeof fetch>()
    for (const fixture of fixtures) transport.mockResolvedValueOnce(Response.json(fixture))
    const client = new ValorantClient('key', transport)
    expect((await client.account('A / B', 'EUW')).data?.puuid).toBe('p')
    expect((await client.content()).data?.acts[0].id).toBe('act')
    expect((await client.history('p')).data?.history[0].matchId).toBe('m')
    expect((await client.match('m')).data?.players[0].competitiveTier).toBe(21)
    const result = await client.leaderboard('act')
    const profile = competitiveProfile('player', 'p', 'act', result)
    expect(profile).toMatchObject({ availability: 'available', rankedRating: 100, actId: 'act' })
    expect(competitiveProfile('missing', 'absent', 'act', result).availability).toBe('unavailable')
    expect(competitiveProfile('old', 'p', 'other-act', result).availability).toBe('unavailable')
    expect(rankComparable([{ ...profile, playerId: 'old', actId: 'previous' }, profile], 'act')[0].playerId).toBe('player')
    expect(String(transport.mock.calls[0][0])).toContain('europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/A%20%2F%20B/EUW')
    expect(String(transport.mock.calls[4][0])).toContain('eu.api.riotgames.com/val/ranked/v1/')
  })
  it('retains the timestamp of previous data on failures and rejects malformed payloads', async () => {
    const client = new ValorantClient('key', vi.fn().mockResolvedValue(Response.json({})))
    expect((await client.content()).availability).toBe('invalid-data')
    const retained = retainOfficialData({ source: 'Riot Games', fetchedAt: 'old', availability: 'available', data: { value: 1 } }, { source: 'Riot Games', fetchedAt: 'new', availability: 'forbidden' })
    expect(retained).toMatchObject({ data: { value: 1 }, fetchedAt: 'old', lastAttemptAt: 'new', availability: 'forbidden' })
    expect((await new ValorantClient('key', vi.fn().mockRejectedValue(new Error('network'))).content()).availability).toBe('temporary-error')
    expect(await checkValorantAccess({}, new ValorantClient(''))).toEqual([expect.objectContaining({ endpoint: 'content', availability: 'missing-key' })])
  })
})

describe('Valorant series and rounds', () => {
  const phase: Phase = { id: 'p', game: 'valorant', name: 'Groups', type: 'groups', status: 'active', order: 1, config: { bo: 3 } }
  const base: Match = { id: 'm', phaseId: 'p', round: 1, team1Id: 'a', team2Id: 'b', result: { team1Score: 2, team2Score: 0 }, riotMatchIds: [] }
  it('accepts manual series without maps and coherent optional map detail', () => {
    expect(validateAndNormalizeMatch(base, phase).ok).toBe(true)
    expect(validateAndNormalizeMatch({ ...base, maps: [{ team1Rounds: 13, team2Rounds: 11 }, { team1Rounds: 16, team2Rounds: 14 }] }, phase).ok).toBe(true)
  })
  it('rejects conflicting winners, unfinished maps, excess maps and invalid overtime', () => {
    for (const rounds of [[12, 10], [13, 12], [15, 12], [0, 13]]) expect(validateAndNormalizeMatch({ ...base, maps: [{ team1Rounds: rounds[0], team2Rounds: rounds[1] }] }, phase).ok).toBe(false)
    expect(validateAndNormalizeMatch({ ...base, maps: Array.from({ length: 4 }, () => ({ team1Rounds: 13, team2Rounds: 0 })) }, phase).ok).toBe(false)
  })
})
