import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { inTournament } from '../competition-context'

const testDir = path.join(process.cwd(), '.tmp', `logo-cleanup-${process.pid}`)

describe('shared logo cleanup', () => {
  let data: typeof import('../data')
  let portal: typeof import('../team-portal-data')
  let competitions: typeof import('../competitions')
  let cleanup: typeof import('../logo-cleanup')
  let db: typeof import('../db')

  beforeAll(async () => {
    process.env.DB_PATH = path.join(testDir, 'test.db')
    process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
    process.env.ADMIN_PASSWORD_HASH = 'test-placeholder'
    data = await import('../data')
    portal = await import('../team-portal-data')
    competitions = await import('../competitions')
    cleanup = await import('../logo-cleanup')
    db = await import('../db')
  })

  afterAll(() => {
    db?.default.close()
    rmSync(testDir, { recursive: true, force: true })
  })

  it('preserva logos de otros torneos y solicitudes pendientes; borra al desaparecer la última referencia', () => {
    const logo = '/api/uploads/shared-logo.png'
    const uploadPath = path.join(testDir, 'uploads', 'shared-logo.png')
    mkdirSync(path.dirname(uploadPath), { recursive: true })
    writeFileSync(uploadPath, 'logo')

    const first = competitions.saveTournament({ name: 'First', slug: 'first', game: 'lol', platform: 'pc', region: 'eu', status: 'published' })
    const second = competitions.saveTournament({ name: 'Second', slug: 'second', game: 'valorant', platform: 'pc', region: 'eu', status: 'published' })
    inTournament(first.id, () => data.createTeam({ id: 'logo-first', name: 'First', logo, players: [] }))
    inTournament(second.id, () => data.createTeam({ id: 'logo-second', name: 'Second', logo, players: [] }))

    inTournament(first.id, () => data.updateTeamLogo('logo-first', ''))
    cleanup.removeUnusedLogo(logo)
    expect(existsSync(uploadPath)).toBe(true)

    const request = inTournament(first.id, () => portal.createTeamChangeRequest('logo-first', 'team_logo', { logo }))
    inTournament(second.id, () => data.updateTeamLogo('logo-second', ''))
    cleanup.removeUnusedLogo(logo)
    expect(existsSync(uploadPath)).toBe(true)

    inTournament(first.id, () => portal.rejectTeamChangeRequest(request.id))
    cleanup.removeUnusedLogo(logo)
    expect(existsSync(uploadPath)).toBe(false)
  })
})
