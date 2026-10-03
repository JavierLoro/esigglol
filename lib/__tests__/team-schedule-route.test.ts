import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { inTournament } from '../competition-context'
import type { Match, Phase, Team, Tournament } from '../types'

const cookies = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => cookies.has(name) ? { value: cookies.get(name) } : undefined }) }))

describe('team match scheduling with real sessions and isolated SQLite', () => {
  let route: typeof import('@/app/api/team/matches/[id]/schedule/route')
  let portalRoute: typeof import('@/app/api/team/route')
  let auth: typeof import('../auth')
  let data: typeof import('../data')
  let portal: typeof import('../team-portal-data')
  let competitions: typeof import('../competitions')
  let tournament: Tournament
  let teams: Team[]
  let phase: Phase
  let match: Match
  let count = 0
  const date = '2026-11-12T18:30:00+01:00'
  const patch = (id = match.id, body: unknown = { version: match.version, scheduledAt: date }, query = '') => route.PATCH(
    new NextRequest(`http://localhost/api/team/matches/${id}/schedule${query}`, { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  )
  const read = () => inTournament(tournament.id, () => data.getMatchById(match.id)!)
  const login = async (team = teams[0], version = 1) => cookies.set('team_session', await auth.createTeamSession(team.id, version))

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-team-schedule-session-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = '$2b$04$test-only-placeholder'
    route = await import('@/app/api/team/matches/[id]/schedule/route')
    portalRoute = await import('@/app/api/team/route')
    auth = await import('../auth')
    data = await import('../data')
    portal = await import('../team-portal-data')
    competitions = await import('../competitions')
  })
  beforeEach(async () => {
    cookies.clear()
    tournament = competitions.saveTournament({ name: 'Scheduling', slug: `schedule-${++count}`, game: count % 2 ? 'lol' : 'valorant', status: 'published', region: 'eu', platform: 'pc' })
    inTournament(tournament.id, () => {
      teams = ['A', 'B', 'C'].map(name => portal.createTeamWithAccess({ id: `${tournament.id}-${name}`, name, logo: '', players: [] }, 'test-hash', 'test-encrypted'))
      phase = data.createPhase({ id: `${tournament.id}-phase`, name: 'Grupos', type: 'groups', status: 'active', order: 1, config: { bo: 3, groups: [{ id: 'g', teamIds: teams.map(team => team.id) }] } })
      const created = data.createMatches([{ id: `${tournament.id}-match`, phaseId: phase.id, round: 1, team1Id: teams[0].id, team2Id: teams[1].id, result: null, riotMatchIds: [], ...(tournament.game === 'lol' ? { tournamentCodes: ['test-code'], tournamentCallbackToken: 'test-callback' } : {}) }])[0]
      match = data.getMatchById(created.id)!
    })
    await login()
  })

  it('lists only own published pending matches and does not return internal match fields', async () => {
    inTournament(tournament.id, () => {
      const hidden = data.createPhase({ ...phase, id: `${phase.id}-hidden`, type: 'swiss', config: { bo: 3, confirmedRounds: [1] } })
      const privateBracket = data.createPhase({ ...phase, id: `${phase.id}-bracket`, type: 'elimination', config: { bo: 3, confirmedBracket: false } })
      data.createMatches([
        { ...match, id: 'other', team1Id: teams[2].id },
        { ...match, id: 'finished', result: { team1Score: 2, team2Score: 0 }, winnerId: teams[0].id },
        { ...match, id: 'bye', winnerId: teams[0].id },
        { ...match, id: 'hidden-round', phaseId: hidden.id, round: 2 },
        { ...match, id: 'hidden-bracket', phaseId: privateBracket.id },
        { ...match, id: 'scheduled', scheduledAt: date, round: 2 },
        { ...match, id: 'scheduled-later', scheduledAt: '2026-11-12T17:45:00Z', round: 2 },
        { ...match, id: 'tbd', team2Id: 'TBD' },
      ])
    })
    const response = await portalRoute.GET(new NextRequest('http://localhost/api/team'))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const body = await response.json()
    expect(body.matches.map((item: Match) => item.id)).toEqual(['scheduled', 'scheduled-later', match.id, 'tbd'])
    expect(body.matches[2]).toEqual({ id: match.id, version: 1, round: 1, phaseName: 'Grupos', opponentName: 'B' })
    expect(body.matches[3].opponentName).toBe('Por determinar')
    for (const id of ['other', 'finished', 'bye', 'hidden-round', 'hidden-bracket']) expect((await patch(id)).status).toBe(404)
  })

  it('lets both participants set, update and clear the shared date while preserving everything else', async () => {
    expect((await patch()).status).toBe(200)
    expect(read()).toEqual({ ...match, version: 2, scheduledAt: date })
    await login(teams[1])
    expect((await patch(match.id, { version: 2, scheduledAt: '2026-11-14T16:00:00Z' })).status).toBe(200)
    expect((await patch(match.id, { version: 3, scheduledAt: null })).status).toBe(200)
    expect(read()).toEqual({ ...match, version: 4 })
  })

  it('rejects unauthenticated, administrator-only, revoked and disabled sessions', async () => {
    cookies.clear()
    expect((await patch()).status).toBe(401)
    cookies.set('admin_session', await auth.createSession())
    expect((await patch()).status).toBe(401)
    await login(teams[0], 99)
    expect((await patch()).status).toBe(403)
    await login()
    inTournament(tournament.id, () => portal.setTeamAccessEnabled(teams[0].id, false))
    expect((await patch()).status).toBe(403)
    expect((await portalRoute.GET(new NextRequest('http://localhost/api/team'))).status).toBe(403)
  })

  it('isolates teams and tournaments, even with a forged tournament query', async () => {
    await login(teams[2])
    expect((await patch()).status).toBe(404)
    await login()
    const other = competitions.saveTournament({ name: 'Other', slug: `other-${count}`, game: 'valorant', status: 'published', region: 'eu', platform: 'pc' })
    inTournament(other.id, () => {
      const foreignTeams = ['X', 'Y'].map(name => data.createTeam({ id: `foreign-${name}`, name, logo: '', players: [] }))
      data.createPhase({ ...phase, id: 'foreign-phase', tournamentId: other.id, game: 'valorant', config: { bo: 3, groups: [{ id: 'foreign-g', teamIds: foreignTeams.map(team => team.id) }] } })
      data.createMatches([{ ...match, id: 'foreign', phaseId: 'foreign-phase', tournamentId: other.id, game: 'valorant', team1Id: foreignTeams[0].id, team2Id: foreignTeams[1].id, tournamentCodes: undefined, tournamentCallbackToken: undefined }])
    })
    expect((await patch('foreign', { version: 1, scheduledAt: date }, `?tournament=${other.id}`)).status).toBe(404)
    expect((await patch(match.id, { version: 1, scheduledAt: date }, `?tournament=${other.id}`)).status).toBe(200)
  })

  it('validates the date and accepts no fields other than scheduling and version', async () => {
    for (const scheduledAt of ['', 'tomorrow', '2026-02-30T18:00:00Z', '2026-11-12T18:00', 1]) expect((await patch(match.id, { version: 1, scheduledAt })).status).toBe(422)
    for (const body of [{ scheduledAt: date }, { version: 0, scheduledAt: date }, { version: 1 }, { version: 1, scheduledAt: date, result: { team1Score: 2, team2Score: 0 } }]) expect((await patch(match.id, body)).status).toBe(422)
    expect((await route.PATCH(new NextRequest('http://localhost/api/team/matches/x/schedule', { method: 'PATCH', body: '{' }), { params: Promise.resolve({ id: match.id }) })).status).toBe(400)
    expect(read()).toEqual(match)
  })

  it('rejects stale writes and matches completed, deleted or unpublished after loading', async () => {
    expect((await patch()).status).toBe(200)
    expect((await patch()).status).toBe(409)
    inTournament(tournament.id, () => data.updateMatches([{ ...read(), result: { team1Score: 2, team2Score: 0 }, winnerId: teams[0].id }]))
    expect((await patch()).status).toBe(404)
    inTournament(tournament.id, () => data.deleteMatches([match.id]))
    expect((await patch()).status).toBe(404)
  })

  it('blocks hidden and archived tournaments and withdrawn phase publication', async () => {
    inTournament(tournament.id, () => data.updatePhase({ ...phase, type: 'elimination', config: { bo: 3, confirmedBracket: false } }))
    expect((await patch()).status).toBe(404)
    competitions.saveTournament({ ...tournament, status: 'draft' })
    expect((await patch()).status).toBe(404)
    expect((await (await portalRoute.GET(new NextRequest('http://localhost/api/team'))).json()).matches).toEqual([])
    competitions.saveTournament({ ...tournament, status: 'archived' })
    expect((await patch()).status).toBe(409)
  })
})
