import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getTeams: vi.fn(),
  createTeam: vi.fn(),
  generateId: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/team-credentials', () => ({ generateTeamPassword: vi.fn(), encryptTeamPassword: vi.fn() }))
vi.mock('@/lib/team-portal-data', () => ({ createTeamWithAccess: mocks.createTeam, ensureExistingTeamsHaveAccess: vi.fn() }))
vi.mock('@/lib/data', () => ({
  getTeams: mocks.getTeams,
  createTeam: mocks.createTeam,
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  StaleWriteError: class StaleWriteError extends Error {},
  generateId: mocks.generateId,
  getTeamReferences: vi.fn(),
}))

describe('POST /api/admin/equipos', () => {
  let POST: typeof import('@/app/api/admin/equipos/route').POST

  beforeAll(async () => {
    ;({ POST } = await import('@/app/api/admin/equipos/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.generateId.mockReturnValue('team-new')
  })

  it('no persiste ni altera los equipos cuando el nombre ya existe', async () => {
    const persisted: Team[] = [{ id: 'team-1', name: 'Alpha', logo: '', players: [] }]
    mocks.getTeams.mockReturnValue(persisted)

    const response = await POST(new Request('http://localhost/api/admin/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ' alpha ', logo: '', players: [] }),
    }) as Parameters<typeof POST>[0])

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: expect.stringContaining('El nombre del equipo debe ser único') })
    expect(mocks.createTeam).not.toHaveBeenCalled()
    expect(persisted).toEqual([{ id: 'team-1', name: 'Alpha', logo: '', players: [] }])
  })
})
