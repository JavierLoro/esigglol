import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getPhaseById: vi.fn(),
  getMatches: vi.fn(),
  saveMatches: vi.fn(),
  generateId: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/data', () => ({
  getPhaseById: mocks.getPhaseById,
  getMatches: mocks.getMatches,
  saveMatches: mocks.saveMatches,
  generateId: mocks.generateId,
}))
vi.mock('@/lib/logger', () => ({ default: { child: () => ({ error: vi.fn() }) } }))

describe('POST /api/admin/fases/generate', () => {
  let POST: typeof import('@/app/api/admin/fases/generate/route').POST

  beforeAll(async () => {
    ;({ POST } = await import('@/app/api/admin/fases/generate/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.getMatches.mockReturnValue([])
    mocks.generateId.mockReturnValue('match-generated')
  })

  it('rechaza el tipo del contrato aunque contradiga el tipo persistido', async () => {
    const response = await POST(new Request('http://localhost/api/admin/fases/generate', {
      method: 'POST',
      body: JSON.stringify({ phaseId: 'phase-1', type: 'swiss' }),
    }))

    expect(response.status).toBe(422)
    expect(mocks.getPhaseById).not.toHaveBeenCalled()
  })

  it('genera partidos usando el tipo persistido de la fase', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Grupos', type: 'groups', status: 'upcoming', order: 1,
      config: { bo: 1, groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }] },
    })

    const response = await POST(new Request('http://localhost/api/admin/fases/generate', {
      method: 'POST',
      body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 1 })
    expect(mocks.saveMatches).toHaveBeenCalledWith([expect.objectContaining({
      phaseId: 'phase-1', round: 1, team1Id: 'team-1', team2Id: 'team-2',
    })])
  })
})
