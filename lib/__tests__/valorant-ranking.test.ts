import { describe, expect, it, vi } from 'vitest'
import { ValorantClient } from '../valorant'
import { createRankingLoader, valorantRank, visibleLadderPlayer, type RankingSnapshot } from '../valorant-ranking'

const ladder = { actId: 'a', totalPlayers: 1, players: [{ gameName: 'Player', tagLine: 'EUW', leaderboardRank: 3, rankedRating: 700, competitiveTier: 27, numberOfWins: 12 }] }
const content = (id: string) => ({ version: '1', acts: [{ id, name: 'Act', isActive: true, type: 'act' }], maps: [] })

describe('Valorant ranking without match access', () => {
  it('reads subsequent pages and stops on denied access with explicit partial coverage', async () => {
    const transport = vi.fn().mockResolvedValueOnce(Response.json(content('a')))
      .mockResolvedValueOnce(Response.json({ ...ladder, totalPlayers: 3 }))
      .mockResolvedValueOnce(Response.json({ ...ladder, totalPlayers: 3, players: [{ ...ladder.players[0], leaderboardRank: 4 }] }))
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '120' } }))
    const result = await createRankingLoader(new ValorantClient('key', transport))()
    expect(result.data?.players).toHaveLength(2)
    expect(result.complete).toBe(false)
    expect(result.retryAfter).toBe('120')
    expect(String(transport.mock.calls[2][0])).toContain('startIndex=1')
    expect(transport).toHaveBeenCalledTimes(4)
  })
  it('loads only content and ladder, preserves fields and shares concurrent requests', async () => {
    const transport = vi.fn().mockResolvedValueOnce(Response.json(content('a'))).mockResolvedValueOnce(Response.json(ladder))
    const load = createRankingLoader(new ValorantClient('key', transport))
    const [first, second] = await Promise.all([load(), load()])
    expect(first).toEqual(second)
    expect(first.data?.players[0]).toMatchObject(ladder.players[0])
    await load()
    expect(transport).toHaveBeenCalledTimes(2)
    expect(transport.mock.calls.every(([url]) => !url.includes('/val/match/'))).toBe(true)
  })
  it('retains previous timestamps after denial but never transfers data to a new act', async () => {
    let now = 0
    const transport = vi.fn().mockResolvedValueOnce(Response.json(content('a'))).mockResolvedValueOnce(Response.json(ladder))
      .mockResolvedValueOnce(Response.json(content('a'))).mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(Response.json(content('b'))).mockResolvedValueOnce(new Response('', { status: 403 }))
    const load = createRankingLoader(new ValorantClient('key', transport), () => now)
    const initial = await load()
    now += 700_000
    expect(await load()).toMatchObject({ availability: 'forbidden', data: initial.data, fetchedAt: initial.fetchedAt })
    now += 700_000
    expect((await load()).data).toBeUndefined()
  })
  it('matches only public identities and keeps unknown ranks unavailable', () => {
    const snapshot: RankingSnapshot = { source: 'Riot Games', availability: 'available', fetchedAt: 'now', data: ladder }
    expect(visibleLadderPlayer('player#euw', snapshot)?.numberOfWins).toBe(12)
    expect(visibleLadderPlayer('missing#EUW', snapshot)).toBeUndefined()
    expect(visibleLadderPlayer('player#EUW', { ...snapshot, data: { ...ladder, players: [{ ...ladder.players[0], isAnonymized: true }] } })).toBeUndefined()
    expect(valorantRank(27)).toBe('Radiante')
    expect(valorantRank(24)).toBe('Inmortal 1')
    expect(valorantRank(undefined)).toBe('No disponible')
    expect(valorantRank(0)).toBe('No disponible')
  })
})
