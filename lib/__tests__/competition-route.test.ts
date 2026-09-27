import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { currentTournamentId } from '../competition-context'

vi.mock('../auth', () => ({ requireAdminSession: async () => null, getTeamSessionFromCookies: async () => null }))

describe('competition HTTP boundary', () => {
  let wrap: typeof import('../competition-route').competitionRoute
  let competitions: typeof import('../competitions')
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    competitions = await import('../competitions')
    wrap = (await import('../competition-route')).competitionRoute
  })
  const handler = async (_request: Request) => { void _request; return Response.json({ tournamentId: currentTournamentId() }) }
  it('requires explicit admin context and resolves it per request', async () => {
    expect((await wrap(handler)(new NextRequest('http://localhost/api/admin/equipos'))).status).toBe(400)
    const response = await wrap(handler)(new NextRequest('http://localhost/api/admin/equipos?tournament=legacy-lol'))
    expect(await response.json()).toEqual({ tournamentId: 'legacy-lol' })
  })
  it('hides drafts from public reads, rejects Valorant codes, and locks archived mutations', async () => {
    const draft = competitions.saveTournament({ name: 'Private', slug: 'private', game: 'valorant', platform: 'pc', region: 'eu', status: 'draft' })
    const url = `http://localhost/api/data/equipos?tournament=${draft.id}`
    expect((await wrap(handler, 'public')(new NextRequest(url))).status).toBe(404)
    expect((await wrap(handler, 'admin')(new NextRequest(url))).status).toBe(200)
    expect((await wrap(handler, 'lol')(new NextRequest(url))).status).toBe(422)
    competitions.saveTournament({ ...draft, status: 'archived' })
    expect((await wrap(handler, 'public')(new NextRequest(url))).status).toBe(404)
    expect((await wrap(handler, 'public-phases')(new NextRequest(url))).status).toBe(200)
    expect((await wrap(handler, 'admin')(new NextRequest(url, { method: 'POST' }))).status).toBe(409)
  })
})
