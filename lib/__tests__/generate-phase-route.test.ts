import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getPhaseById: vi.fn(),
  getMatches: vi.fn(),
  createMatches: vi.fn(),
  generateId: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/data', () => ({
  getPhaseById: mocks.getPhaseById,
  getMatches: mocks.getMatches,
  createMatches: mocks.createMatches,
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
    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST',
      body: JSON.stringify({ phaseId: 'phase-1', type: 'swiss' }),
    }))

    expect(response.status).toBe(422)
    expect(mocks.getPhaseById).not.toHaveBeenCalled()
  })

  it('genera partidos usando el tipo persistido de la fase', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Grupos', type: 'groups', status: 'upcoming', order: 1,
      config: { bo: 1, advanceCount: 1, groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }] },
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST',
      body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 1 })
    expect(mocks.createMatches).toHaveBeenCalledWith([expect.objectContaining({
      phaseId: 'phase-1', round: 1, team1Id: 'team-1', team2Id: 'team-2',
    })])
  })

  it('genera la final según la topología persistida, no según IDs aleatorios', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Final Four', type: 'final-four', status: 'active', order: 1,
      config: { bo: 3, bracketTeamIds: ['A', 'B', 'C', 'D'] },
    })
    mocks.getMatches.mockReturnValue([
      {
        id: 'aaa-random', phaseId: 'phase-1', round: 1, bracketPosition: 1,
        team1Id: 'C', team2Id: 'D', result: { team1Score: 0, team2Score: 2 }, winnerId: 'D', riotMatchIds: [],
      },
      {
        id: 'zzz-random', phaseId: 'phase-1', round: 1, bracketPosition: 0,
        team1Id: 'A', team2Id: 'B', result: { team1Score: 2, team2Score: 0 }, winnerId: 'A', riotMatchIds: [],
      },
    ])

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.createMatches).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ round: 2, bracketPosition: 0, team1Id: 'A', team2Id: 'D' }),
    ]))
  })

  it('persiste posiciones estables al crear varios partidos del bracket', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Final Four', type: 'final-four', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: ['A', 'B', 'C', 'D'] },
    })
    mocks.generateId
      .mockReturnValueOnce('zzz-random')
      .mockReturnValueOnce('aaa-random')

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.createMatches).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'zzz-random', bracketPosition: 0, team1Id: 'A', team2Id: 'B' }),
      expect.objectContaining({ id: 'aaa-random', bracketPosition: 1, team1Id: 'C', team2Id: 'D' }),
      expect.objectContaining({ round: 2, team1Id: 'TBD', team2Id: 'TBD' }),
    ]))
  })

  it('crea semifinales, final y tercer puesto de Final Four en una sola operación e idempotentemente', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Final Four', type: 'final-four', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: ['A', 'B', 'C', 'D'], include3rdPlace: true },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const request = () => new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    })
    const first = await POST(request())
    const second = await POST(request())

    expect(await first.json()).toEqual({ created: 4 })
    expect(await second.json()).toEqual({ created: 0, message: 'No hay partidos nuevos que generar' })
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ round: 1, bracketPosition: 0, team1Id: 'A', team2Id: 'B' }),
      expect.objectContaining({ round: 1, bracketPosition: 1, team1Id: 'C', team2Id: 'D' }),
      expect.objectContaining({ round: 2, team1Id: 'TBD', team2Id: 'TBD' }),
      expect.objectContaining({ round: 98, team1Id: 'TBD', team2Id: 'TBD' }),
    ]))
  })

  it('crea el Upper y todo el Lower de cuatro equipos en una sola operación e idempotentemente', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Doble eliminación', type: 'upper-lower', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: ['A', 'B', 'C', 'D'] },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const request = () => new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    })
    const first = await POST(request())
    const second = await POST(request())

    expect(await first.json()).toEqual({ created: 6 })
    expect(await second.json()).toEqual({ created: 0, message: 'No hay partidos nuevos que generar' })
    expect(stored.map(match => match.round)).toEqual(expect.arrayContaining([1, 1, 2, -1, -2, 99]))
    expect(stored.filter(match => Number(match.round) < 0)).toHaveLength(2)
  })

  it('genera una topología completa para cuatro equipos Upper y dos Lower', async () => {
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Doble eliminación escalonada', type: 'upper-lower', status: 'upcoming', order: 1,
      config: {
        bo: 3,
        bracketTeamIds: ['A', 'B', 'C', 'D', 'E', 'F'],
        lowerBracketTeamIds: ['E', 'F'],
      },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(await response.json()).toEqual({ created: 8 })
    expect(stored.filter(match => match.round === 1)).toHaveLength(2)
    expect(stored.filter(match => match.round === -1)).toEqual([
      expect.objectContaining({ bracketPosition: 0, team1Id: 'E', team2Id: 'TBD' }),
      expect.objectContaining({ bracketPosition: 1, team1Id: 'F', team2Id: 'TBD' }),
    ])
    expect(stored.map(match => match.round)).toEqual(expect.arrayContaining([2, -2, -3, 99]))
  })

  it('escala la topología a ocho equipos Upper y cuatro Lower', async () => {
    const upper = Array.from({ length: 8 }, (_, index) => `U${index + 1}`)
    const lower = Array.from({ length: 4 }, (_, index) => `L${index + 1}`)
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Doble eliminación de doce', type: 'upper-lower', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: [...upper, ...lower], lowerBracketTeamIds: lower },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(await response.json()).toEqual({ created: 18 })
    expect(stored.filter(match => match.round === 1)).toHaveLength(4)
    expect(stored.filter(match => match.round === -1)).toHaveLength(4)
    expect(stored.filter(match => match.round === -3)).toHaveLength(2)
    expect(stored.filter(match => match.round === -5)).toHaveLength(1)
    expect(stored.filter(match => match.round === 99)).toHaveLength(1)
  })

  it('genera sin descansos un Upper/Lower de dieciséis equipos en Upper', async () => {
    const teams = Array.from({ length: 16 }, (_, index) => `T${index + 1}`)
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Doble eliminación de dieciséis', type: 'upper-lower', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: teams },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(await response.json()).toEqual({ created: 30 })
    expect(stored.filter(match => match.round === 1)).toHaveLength(8)
    expect(stored.filter(match => match.round === 4)).toHaveLength(1)
    expect(stored.filter(match => match.round === -1)).toHaveLength(4)
    expect(stored.filter(match => match.round === -6)).toHaveLength(1)
    expect(stored.filter(match => match.round === 99)).toHaveLength(1)
  })

  it('genera sin descansos un reparto de dieciséis Upper y ocho Lower', async () => {
    const upper = Array.from({ length: 16 }, (_, index) => `U${index + 1}`)
    const lower = Array.from({ length: 8 }, (_, index) => `L${index + 1}`)
    mocks.getPhaseById.mockReturnValue({
      id: 'phase-1', name: 'Doble eliminación de veinticuatro', type: 'upper-lower', status: 'upcoming', order: 1,
      config: { bo: 3, bracketTeamIds: [...upper, ...lower], lowerBracketTeamIds: lower },
    })
    const stored: Array<Record<string, unknown>> = []
    mocks.getMatches.mockReturnValue(stored)
    mocks.createMatches.mockImplementation(items => { stored.push(...items); return items })
    let sequence = 0
    mocks.generateId.mockImplementation(() => `match-${++sequence}`)

    const response = await POST(new NextRequest('http://localhost/api/admin/fases/generate', {
      method: 'POST', body: JSON.stringify({ phaseId: 'phase-1' }),
    }))

    expect(await response.json()).toEqual({ created: 38 })
    expect(stored.filter(match => match.round === 1)).toHaveLength(8)
    expect(stored.filter(match => match.round === -1)).toHaveLength(8)
    expect(stored.filter(match => match.round === -7)).toHaveLength(1)
    expect(stored.filter(match => match.round === 99)).toHaveLength(1)
  })
})
