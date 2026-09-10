import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getTeams: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/team-credentials', () => ({ generateTeamPassword: vi.fn(), encryptTeamPassword: vi.fn() }))
vi.mock('@/lib/team-portal-data', () => ({ createTeamWithAccess: vi.fn(), ensureExistingTeamsHaveAccess: vi.fn() }))
vi.mock('@/lib/data', () => ({
  getTeams: mocks.getTeams,
  saveTeams: vi.fn(),
  generateId: vi.fn(),
  getTeamReferences: vi.fn(),
}))

describe('GET /api/admin/equipos cache contract', () => {
  let GET: typeof import('@/app/api/admin/equipos/route').GET

  beforeAll(async () => {
    ;({ GET } = await import('@/app/api/admin/equipos/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.getTeams.mockReturnValue([{ id: 'team-1', name: 'Actual', logo: '', players: [] }])
  })

  it('requiere sesión y marca la respuesta privada sin caché', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual([{ id: 'team-1', name: 'Actual', logo: '', players: [] }])
  })

  it('no devuelve datos si la sesión no es válida', async () => {
    mocks.requireAdminSession.mockResolvedValue(Response.json({ error: 'No autorizado' }, { status: 401 }))

    const response = await GET()

    expect(response.status).toBe(401)
    expect(mocks.getTeams).not.toHaveBeenCalled()
  })
})
