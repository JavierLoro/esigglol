import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { inTournament } from '../competition-context'
import type { Match, Phase, Tournament } from '../types'

const auth = vi.hoisted(() => ({ requireAdminSession: vi.fn() }))
vi.mock('../auth', () => auth)

describe('admin overlay API with isolated SQLite', () => {
  let route: typeof import('@/app/api/admin/overlay/route')
  let data: typeof import('../data')
  let competitions: typeof import('../competitions')
  let overlay: typeof import('../overlay-data')
  let tournaments: Tournament[]
  const matches: Match[] = []
  const phases: Phase[] = []
  const request = (id: string, body?: unknown) => new NextRequest(`http://localhost/api/admin/overlay?tournament=${id}`, body === undefined ? {} : { method: 'PUT', body: JSON.stringify(body) })
  beforeAll(async () => {
    route = await import('@/app/api/admin/overlay/route')
    data = await import('../data')
    competitions = await import('../competitions')
    overlay = await import('../overlay-data')
    tournaments = ['lol', 'valorant'].map((game, i) => competitions.saveTournament({ name: `OBS ${i}`, slug: `obs-${i}`, game: game as 'lol' | 'valorant', status: 'published', platform: 'pc', region: 'eu' }))
    for (const t of tournaments) inTournament(t.id, () => {
      const teams = ['A', 'B'].map(name => data.createTeam({ id: `${t.id}-${name}`, name, logo: '', players: [] }))
      const phase = data.createPhase({ id: `${t.id}-phase`, name: 'Final', order: 0, status: 'active', type: 'elimination', config: { bo: 3, bracketTeamIds: teams.map(t => t.id), confirmedBracket: true } })
      phases.push(phase)
      matches.push(data.createMatches([{ id: `${t.id}-match`, phaseId: phase.id, round: 1, team1Id: teams[0].id, team2Id: teams[1].id, result: null, riotMatchIds: [] }])[0])
    })
  })
  beforeEach(() => auth.requireAdminSession.mockResolvedValue(null))

  it('requires a global administrator and explicit existing tournament', async () => {
    auth.requireAdminSession.mockResolvedValue(Response.json({ error: 'No autorizado' }, { status: 401 }))
    expect((await route.GET(request(tournaments[0].id))).status).toBe(401)
    expect((await route.PUT(request(tournaments[0].id, { matchId: null }))).status).toBe(401)
    auth.requireAdminSession.mockResolvedValue(null)
    expect((await route.GET(new NextRequest('http://localhost/api/admin/overlay'))).status).toBe(400)
    expect((await route.GET(request('missing'))).status).toBe(404)
  })

  it('persists independent configurations and rejects foreign, malformed and unavailable references', async () => {
    const [a, b] = tournaments
    expect(await (await route.GET(request(a.id))).json()).toEqual({ matchId: null, summary: null })
    expect((await route.PUT(request(a.id, { matchId: matches[0].id }))).status).toBe(200)
    expect(await (await route.GET(request(b.id))).json()).toEqual({ matchId: null, summary: null })
    expect((await route.PUT(request(b.id, { matchId: matches[1].id }))).status).toBe(200)
    expect((await route.PUT(request(a.id, { matchId: matches[1].id }))).status).toBe(422)
    expect((await route.PUT(request(a.id, { matchId: null, summary: { phaseId: phases[1].id, section: 'round:1', page: 1 } }))).status).toBe(422)
    expect((await route.PUT(request(a.id, { matchId: 1 }))).status).toBe(422)
    expect((await route.PUT(new NextRequest(`http://localhost/api/admin/overlay?tournament=${a.id}`, { method: 'PUT', body: '{' }))).status).toBe(400)
    expect(await (await route.GET(request(a.id))).json()).toEqual({ matchId: matches[0].id })
    const visibility = { marcador: { tournament: true }, previa: { tournament: false, logos: true }, fase: { content: 'standings', page: true, history: true } }
    expect((await route.PUT(request(a.id, { matchId: matches[0].id, visibility }))).status).toBe(200)
    expect((await (await route.GET(request(a.id))).json()).visibility).toEqual(visibility)
    expect((await (await route.GET(request(b.id))).json()).visibility).toBeUndefined()
    for (const invalid of [{ previa: { logos: 'yes' } }, { fase: { content: 'none' } }, { fase: { history: 'yes' } }, { marcador: { maps: true } }]) {
      expect((await route.PUT(request(a.id, { matchId: matches[0].id, visibility: invalid }))).status).toBe(422)
    }
    expect((await route.PUT(request(a.id, { matchId: matches[0].id, accentColor: '#51d9f5', visibility }))).status).toBe(200)
    expect((await route.PUT(request(b.id, { matchId: matches[1].id, accentColor: '#AABBCC' }))).status).toBe(200)
    for (const accentColor of ['red', '#fff', '#12345678', '#gggggg', 'url(https://example.com)', '#123456;display:none', '', null, 42]) {
      expect((await route.PUT(request(a.id, { matchId: matches[0].id, accentColor }))).status).toBe(422)
    }
    expect(await (await route.GET(request(a.id))).json()).toEqual({ matchId: matches[0].id, accentColor: '#51d9f5', visibility })
    expect((await (await route.GET(request(b.id))).json()).accentColor).toBe('#AABBCC')
    inTournament(a.id, () => data.updatePhase({ ...phases[0], config: { ...phases[0].config, confirmedBracket: false } }))
    expect((await route.PUT(request(a.id, { matchId: matches[0].id }))).status).toBe(422)
    expect((await route.PUT(request(a.id, { matchId: null }))).status).toBe(200)
    expect((await (await route.GET(request(a.id))).json()).accentColor).toBeUndefined()
  })

  it('allows archived reads but blocks HTTP and repository writes', async () => {
    const t = tournaments[1]
    competitions.saveTournament({ ...t, status: 'archived' })
    expect((await route.GET(request(t.id))).status).toBe(200)
    expect((await route.PUT(request(t.id, { matchId: null }))).status).toBe(409)
    inTournament(t.id, () => expect(() => overlay.saveOverlayConfig({ matchId: null })).toThrow('archivado'))
  })
})
