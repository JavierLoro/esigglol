import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { STRUCTURAL_PHASE_FIELDS } from '../phase-structure'
import type { Match, Phase } from '../types'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getPhases: vi.fn(),
  getMatches: vi.fn(),
  savePhases: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/data', () => ({
  getPhases: mocks.getPhases,
  getMatches: mocks.getMatches,
  savePhases: mocks.savePhases,
}))
vi.mock('@/lib/logger', () => ({ default: { child: () => ({ error: vi.fn() }) } }))

const phase: Phase = {
  id: 'phase-1', name: 'Fase', type: 'swiss', status: 'upcoming', order: 1,
  config: {
    bo: 1,
    swissSize: 8,
    swissTeamIds: ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6', 'team-7', 'team-8'],
    advanceWins: 2,
    eliminateLosses: 2,
    bracketTeamIds: ['team-1', 'team-2'],
  },
}
const match: Match = {
  id: 'match-1', phaseId: phase.id, round: 1, team1Id: 'team-1', team2Id: 'team-2', result: null, riotMatchIds: [],
}

function request(body: Phase) {
  return new NextRequest('http://localhost/api/admin/fases', { method: 'PUT', body: JSON.stringify(body) })
}

function postRequest(body: Omit<Phase, 'id'>) {
  return new NextRequest('http://localhost/api/admin/fases', { method: 'POST', body: JSON.stringify(body) })
}

describe('PUT /api/admin/fases structural lock', () => {
  let PUT: typeof import('@/app/api/admin/fases/route').PUT
  let POST: typeof import('@/app/api/admin/fases/route').POST

  beforeAll(async () => { ({ PUT, POST } = await import('@/app/api/admin/fases/route')) })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.getPhases.mockReturnValue([phase])
    mocks.getMatches.mockReturnValue([match])
  })

  it.each([
    ['type', { ...phase, type: 'elimination' as const }],
    ['order', { ...phase, order: 2 }],
    ['config.bo', { ...phase, config: { ...phase.config, bo: 3 as const } }],
    ['config.advanceCount', { ...phase, config: { ...phase.config, advanceCount: 1 } }],
    ['config.groups', { ...phase, config: { ...phase.config, groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }] } }],
    ['config.rounds', { ...phase, config: { ...phase.config, rounds: 4 } }],
    ['config.swissTeamIds', { ...phase, config: { ...phase.config, swissTeamIds: [...phase.config.swissTeamIds!].reverse() } }],
    ['config.swissSize', { ...phase, config: { ...phase.config, swissSize: 16 as const } }],
    ['config.advanceWins', { ...phase, config: { ...phase.config, advanceWins: 3 } }],
    ['config.eliminateLosses', { ...phase, config: { ...phase.config, eliminateLosses: 3 } }],
    ['config.roundBo', { ...phase, config: { ...phase.config, roundBo: { '1': 3 } } }],
    ['config.bracketTeamIds', { ...phase, config: { ...phase.config, bracketTeamIds: ['team-2', 'team-1'] } }],
    ['config.include3rdPlace', { ...phase, config: { ...phase.config, include3rdPlace: true } }],
  ] satisfies Array<[(typeof STRUCTURAL_PHASE_FIELDS)[number], Phase]>)('rejects %s when matches exist', async (field, updated) => {
    const response = await PUT(request(updated))

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ fields: [field] })
    expect(mocks.savePhases).not.toHaveBeenCalled()
  })

  it.each([
    ['name', { ...phase, name: 'Nuevo nombre' }],
    ['status', { ...phase, status: 'active' as const }],
  ])('allows %s when matches exist', async (_field, updated) => {
    const response = await PUT(request(updated))

    expect(response.status).toBe(200)
    expect(mocks.savePhases).toHaveBeenCalledWith([updated])
  })

  it('allows structural changes before matches are generated', async () => {
    mocks.getMatches.mockReturnValue([])
    const updated = { ...phase, config: { ...phase.config, bo: 3 as const } }

    const response = await PUT(request(updated))

    expect(response.status).toBe(200)
    expect(mocks.savePhases).toHaveBeenCalledWith([updated])
  })

  it('rechaza crear una fase sin participantes y no persiste nada', async () => {
    const invalid = { name: phase.name, type: 'elimination' as const, status: phase.status, order: phase.order, config: { bo: 1 as const } }

    const response = await POST(postRequest(invalid))

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: expect.any(Object) })
    expect(mocks.savePhases).not.toHaveBeenCalled()
  })
})
