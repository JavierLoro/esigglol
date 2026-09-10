import { beforeAll, describe, expect, it } from 'vitest'

describe('team portal data', () => {
  let data: typeof import('../data')
  let portal: typeof import('../team-portal-data')

  beforeAll(async () => {
    process.env.DB_PATH = `.tmp/team-portal-${process.pid}.db`
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = 'test-placeholder'
    data = await import('../data')
    portal = await import('../team-portal-data')
  })

  it('creates one access record together with a team', () => {
    const team = portal.createTeamWithAccess({ id: 'portal-team-a', name: 'Portal A', logo: '', players: [] }, 'hash-a', 'secret-a')
    expect(team.version).toBe(1)
    expect(portal.getTeamAccessSecret(team.id)).toMatchObject({ enabled: true, passwordHash: 'hash-a', encryptedPassword: 'secret-a', sessionVersion: 1 })
  })

  it('only updates roles with the current team version', () => {
    portal.createTeamWithAccess({
      id: 'portal-team-b', name: 'Portal B', logo: '',
      players: [{ id: 'portal-player-b', summonerName: 'PlayerB#EUW', primaryRole: 'Fill' }],
    }, 'hash-b', 'secret-b')
    const updated = portal.updatePlayerRoles('portal-team-b', 'portal-player-b', 1, 'Mid', 'Support')
    expect(updated).toMatchObject({ version: 2, players: [{ primaryRole: 'Mid', secondaryRole: 'Support' }] })
    expect(() => portal.updatePlayerRoles('portal-team-b', 'portal-player-b', 1, 'Top')).toThrow(data.StaleWriteError)
  })

  it('approves player requests once and keeps Riot IDs globally unique', () => {
    const request = portal.createTeamChangeRequest('portal-team-a', 'new_player', {
      id: 'portal-player-a', summonerName: 'Fresh#EUW', primaryRole: 'Top',
    })
    expect(portal.approveTeamChangeRequest(request.id)?.team.players).toEqual([
      expect.objectContaining({ id: 'portal-player-a', summonerName: 'Fresh#EUW' }),
    ])
    expect(portal.approveTeamChangeRequest(request.id)).toBeUndefined()

    const duplicate = portal.createTeamChangeRequest('portal-team-b', 'new_player', {
      id: 'portal-player-c', summonerName: ' fresh # euw ', primaryRole: 'Jungle',
    })
    expect(() => portal.approveTeamChangeRequest(duplicate.id)).toThrow('El Riot ID no puede repetirse entre equipos')
  })

  it('invalidates sessions when access is regenerated or toggled', () => {
    expect(portal.getTeamAccessSecret('portal-team-a')?.sessionVersion).toBe(1)
    portal.replaceTeamAccess('portal-team-a', 'hash-next', 'secret-next')
    expect(portal.getTeamAccessSecret('portal-team-a')?.sessionVersion).toBe(2)
    portal.setTeamAccessEnabled('portal-team-a', false)
    expect(portal.getTeamAccessSecret('portal-team-a')).toMatchObject({ enabled: false, sessionVersion: 3 })
  })

  it('backfills existing teams once without replacing credentials', async () => {
    data.createTeam({ id: 'legacy-team', name: 'Legacy', logo: '', players: [] })
    expect(await portal.ensureExistingTeamsHaveAccess()).toBe(1)
    const first = portal.getTeamAccessSecret('legacy-team')
    expect(first).toMatchObject({ enabled: true, sessionVersion: 1 })
    expect(await portal.ensureExistingTeamsHaveAccess()).toBe(0)
    expect(portal.getTeamAccessSecret('legacy-team')?.encryptedPassword).toBe(first?.encryptedPassword)
  })
})
