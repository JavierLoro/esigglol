import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { inTournament } from '../competition-context'
import type { Tournament } from '../types'

const auth = vi.hoisted(() => ({ deny: vi.fn(async (): Promise<Response | null> => null) }))
vi.mock('../auth', () => ({ requireAdminSession: auth.deny }))
vi.mock('../logo-cleanup', () => ({ removeUnusedLogo: vi.fn() }))

describe('tournament deletion', () => {
  let competitions: typeof import('../competitions')
  let data: typeof import('../data')
  let portal: typeof import('../team-portal-data')
  let db: typeof import('../db').default
  let DELETE: typeof import('@/app/api/admin/torneos/route').DELETE
  const tables = ['tournaments', 'teams', 'phases', 'matches', 'team_access', 'team_change_requests', 'player_stats', 'player_champion_mastery', 'player_match_history', 'tournament_config']
  const snapshot = () => Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]))
  const request = (body: unknown) => new NextRequest('http://localhost/api/admin/torneos', { method: 'DELETE', body: JSON.stringify(body) })

  function seed(game: Tournament['game'], status: Tournament['status'] = 'published') {
    const tournament = competitions.saveTournament({ name: 'Delete fixture', slug: `fixture-${game}-${crypto.randomUUID()}`, game, platform: 'pc', region: 'eu', status: 'published' })
    inTournament(tournament.id, () => {
      const team = portal.createTeamWithAccess({ id: `${tournament.id}-team`, name: 'Same name', logo: '/shared-logo.png', players: [{ id: `${tournament.id}-player`, summonerName: 'Same#EUW', primaryRole: game === 'lol' ? 'Mid' : 'Flexible' }] }, 'test-hash', 'test-encrypted')
      const opponent = data.createTeam({ id: `${tournament.id}-opponent`, name: 'Opponent', logo: '', players: [] })
      const phase = data.createPhase({ id: `${tournament.id}-phase`, name: 'Groups', type: 'groups', status: 'upcoming', order: 1, config: { bo: 1, groups: [{ id: 'g', teamIds: [team.id, opponent.id] }] } })
      data.createMatches([{ id: `${tournament.id}-match`, phaseId: phase.id, round: 1, team1Id: team.id, team2Id: opponent.id, result: null, riotMatchIds: [] }])
      portal.createTeamChangeRequest(team.id, 'team_logo', { logo: '/pending-logo.png' })
      data.savePlayerStatsCache({ lastUpdated: null, players: [] })
      for (const suffix of ['overlay', 'config']) db.prepare('INSERT INTO tournament_config VALUES (?, ?)').run(`${tournament.id}:${suffix}`, '{}')
      const playerId = team.players[0].id
      db.prepare('INSERT INTO player_champion_mastery VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(playerId, 'Same#EUW', 1, 'Champion', 1, 1, 1, 'today')
      db.prepare('INSERT INTO player_match_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(playerId, 'Same#EUW', 'shared-match', 1, 'Champion', 'Mid', 1, 1, 1, 1, 'today', 1)
    })
    return competitions.saveTournament({ ...tournament, status })
  }

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    competitions = await import('../competitions')
    data = await import('../data')
    portal = await import('../team-portal-data')
    db = (await import('../db')).default
    DELETE = (await import('@/app/api/admin/torneos/route')).DELETE
    seed('lol'); seed('valorant')
    db.prepare('INSERT INTO tournament_config VALUES (?, ?)').run('site-branding', '{"subtitle":"Preserve"}')
    db.prepare('INSERT INTO tournament_config VALUES (?, ?)').run('riot-api-key', '"test-placeholder"')
  })

  it.each(['lol', 'valorant'] as const)('deletes %s editions in any status and preserves all unrelated data', async game => {
    for (const status of ['draft', 'published', 'archived'] as const) {
      const before = snapshot()
      const tournament = seed(game, status)
      const response = await DELETE(request({ id: tournament.id }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      expect(snapshot()).toEqual(before)
    }
  })

  it('rejects unauthorized, malformed and unknown deletions without changing data', async () => {
    const before = snapshot()
    auth.deny.mockResolvedValueOnce(new Response(null, { status: 401 }))
    expect((await DELETE(request({ id: 'legacy-lol' }))).status).toBe(401)
    for (const body of [null, {}, { id: '' }, { id: 1 }, { id: 'legacy-lol', extra: true }]) expect((await DELETE(request(body))).status).toBe(422)
    expect((await DELETE(new NextRequest('http://localhost/api/admin/torneos', { method: 'DELETE', body: '{' }))).status).toBe(422)
    expect((await DELETE(request({ id: 'missing' }))).status).toBe(404)
    expect(snapshot()).toEqual(before)
  })

  it('rolls back every related deletion if any database write fails', async () => {
    const tournament = seed('lol')
    const before = snapshot()
    db.exec("CREATE TEMP TRIGGER fail_delete BEFORE DELETE ON phases BEGIN SELECT RAISE(ABORT, 'test failure'); END")
    try {
      expect((await DELETE(request({ id: tournament.id }))).status).toBe(500)
      expect(snapshot()).toEqual(before)
    } finally { db.exec('DROP TRIGGER fail_delete') }
  })

  it('can delete the original edition and the last tournament', async () => {
    for (const tournament of competitions.getTournaments(true)) expect((await DELETE(request({ id: tournament.id }))).status).toBe(200)
    expect(competitions.getTournaments(true)).toEqual([])
    for (const table of tables.filter(table => table !== 'tournament_config')) expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual([])
    expect(db.prepare('SELECT key FROM tournament_config ORDER BY key').all()).toEqual([{ key: 'riot-api-key' }, { key: 'site-branding' }])
  })
})
