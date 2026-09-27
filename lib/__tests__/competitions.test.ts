import { beforeAll, describe, expect, it } from 'vitest'
import { inTournament } from '../competition-context'
import type { Match, Phase, Team, Tournament } from '../types'

describe('competition isolation with SQLite', () => {
  let data: typeof import('../data')
  let competitions: typeof import('../competitions')
  let portal: typeof import('../team-portal-data')
  let tournaments: Tournament[]
  const teams = new Map<string, Team[]>()
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    data = await import('../data')
    competitions = await import('../competitions')
    portal = await import('../team-portal-data')
    tournaments = ['lol', 'lol', 'valorant'].map((game, i) => competitions.saveTournament({ name: `Edition ${i}`, slug: `edition-${i}`, game: game as 'lol' | 'valorant', platform: 'pc', region: 'eu', status: 'published' }))
    for (const t of tournaments) inTournament(t.id, () => {
      teams.set(t.id, ['Alpha', 'Beta'].map((name, i) => portal.createTeamWithAccess({ id: `${t.id}-${i}`, name, logo: '', players: [{ id: `${t.id}-player-${i}`, summonerName: `Same${i}#EUW`, primaryRole: t.game === 'lol' ? 'Mid' : 'Flexible' }] }, 'hash', 'encrypted')))
    })
  })
  it('keeps repeated names, credentials, requests and caches in their edition', async () => {
    await Promise.all(tournaments.map(t => inTournament(t.id, async () => {
      await Promise.resolve()
      const own = teams.get(t.id)!
      expect(data.getTeams().map(t => t.id)).toEqual(own.map(t => t.id))
      const request = portal.createTeamChangeRequest(own[0].id, 'summoner_name', { summonerName: 'New#EUW' }, own[0].players[0].id)
      expect(portal.getTeamChangeRequests()).toHaveLength(1)
      expect(portal.getTeamChangeRequest(request.id)?.teamId).toBe(own[0].id)
      data.savePlayerStatsCache({ lastUpdated: t.id, players: [] })
      await Promise.resolve()
      expect(data.getPlayerStatsCache().lastUpdated).toBe(t.id)
    })))
  })
  it('rejects foreign reads, writes, participants, credentials and reused player records', () => {
    const [a, b] = tournaments
    const foreign = teams.get(b.id)![0]
    inTournament(a.id, () => {
      expect(data.getTeamById(foreign.id)).toBeUndefined()
      expect(() => data.updateTeam({ ...foreign, tournamentId: a.id })).toThrow('fuera del torneo')
      expect(() => data.deleteTeam(foreign.id, foreign.version!)).toThrow('fuera del torneo')
      expect(() => portal.setTeamAccessEnabled(foreign.id, false)).toThrow('fuera del torneo')
      expect(() => portal.createTeamChangeRequest(foreign.id, 'team_logo', { logo: '/x' })).toThrow('fuera del torneo')
      expect(() => data.createPhase({ id: 'foreign-phase', name: 'Bad', type: 'groups', status: 'upcoming', order: 1, config: { bo: 1, groups: [{ id: 'g', teamIds: [foreign.id] }] } })).toThrow('fuera del torneo')
      expect(() => data.createTeam({ ...foreign, id: 'copied-team', tournamentId: a.id })).toThrow('registro propio')
    })
  })
  it('supports manual Valorant maps and prevents edits after archiving', () => {
    const tournament = tournaments[2]
    let phase: Phase
    let match: Match
    inTournament(tournament.id, () => {
      const own = teams.get(tournament.id)!
      phase = data.createPhase({ id: 'val-phase', name: 'Groups', type: 'groups', status: 'upcoming', order: 1, config: { bo: 3, groups: [{ id: 'g', teamIds: own.map(t => t.id) }] } })
      ;[match] = data.createMatches([{ id: 'val-match', phaseId: phase.id, team1Id: own[0].id, team2Id: own[1].id, round: 1, result: { team1Score: 2, team2Score: 0 }, winnerId: own[0].id, riotMatchIds: [], maps: [{ map: 'Ascent', team1Rounds: 13, team2Rounds: 7 }, { team1Rounds: 15, team2Rounds: 13 }] }])
      expect(match.game).toBe('valorant')
      expect(() => data.updateMatches([{ ...match, maps: [{ team1Rounds: 7, team2Rounds: 13 }] }])).toThrow('marcador')
      expect(() => data.updateMatches([{ ...match, tournamentCodes: ['LOL'] }])).toThrow('incompatibles')
    })
    expect(() => competitions.saveTournament({ ...tournament, game: 'lol' })).toThrow('no pueden cambiar')
    competitions.saveTournament({ ...tournament, status: 'archived' })
    inTournament(tournament.id, () => {
      expect(data.getMatchById(match.id)?.maps).toHaveLength(2)
      expect(() => data.updateMatches([{ ...match, scheduledAt: new Date().toISOString() }])).toThrow('archivado')
      expect(() => data.deletePhase(phase.id, phase.version!)).toThrow('archivado')
    })
    competitions.saveTournament({ ...tournament, status: 'published' })
    inTournament(tournament.id, () => expect(data.updateMatches([{ ...match, scheduledAt: '2026-10-01T18:00:00Z' }])[0].version).toBe(2))
  })
  it('omits drafts from public tournament discovery', () => {
    const draft = competitions.saveTournament({ name: 'Hidden', slug: 'hidden', game: 'lol', platform: 'pc', region: 'eu', status: 'draft' })
    expect(competitions.getTournaments().some(t => t.id === draft.id)).toBe(false)
    expect(competitions.getTournaments(true).some(t => t.id === draft.id)).toBe(true)
  })
})
