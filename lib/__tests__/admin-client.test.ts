import { describe, expect, it } from 'vitest'
import {
  adminRequest,
  AdminRequestError,
  errorMessage,
  isGeneratedMatchesResponse,
  isMatchArray,
  isNonEmptyMatchArray,
  isOk,
  isPhaseArray,
  isTeamArray,
  isTournamentCodesResponse,
} from '@/lib/admin-client'

function response(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, statusText: 'Error' }))
}

describe('adminRequest', () => {
  it.each([
    [401, 'Sesión expirada'],
    [422, 'validación'],
    [500, 'interno'],
  ])('expone errores HTTP %s sin aceptar el cuerpo como entidad', async (status, expected) => {
    const result = adminRequest(response(status, { error: 'fallo' }), isOk)
    await expect(result).rejects.toBeInstanceOf(AdminRequestError)
    await expect(result.catch(error => errorMessage(error))).resolves.toContain(expected)
  })

  it('valida la forma de respuestas correctas', async () => {
    await expect(adminRequest(response(200, { ok: true }), isOk)).resolves.toEqual({ ok: true })
    await expect(adminRequest(response(200, { error: 'no es entidad' }), isOk)).rejects.toThrow('formato válido')
  })

  it('clasifica errores de red', async () => {
    await expect(adminRequest(Promise.reject(new Error('offline')), isOk).catch(error => errorMessage(error))).resolves.toContain('conexión')
    expect(errorMessage(new AdminRequestError('validation', 'campo requerido'))).toContain('validación')
  })

  it('conserva el detalle de validación anidado de Zod', async () => {
    const result = adminRequest(response(422, {
      error: { formErrors: [], fieldErrors: { name: ['El nombre es obligatorio'] } },
    }), isOk)

    await expect(result.catch(error => errorMessage(error))).resolves.toBe('Error de validación: El nombre es obligatorio')
  })
})

describe('contratos de respuestas del panel admin', () => {
  const team = { id: 'team-1', name: 'Alpha', logo: '', players: [] }
  const phase = {
    id: 'phase-1',
    name: 'Eliminación',
    type: 'elimination',
    status: 'upcoming',
    order: 0,
    config: { bo: 1 },
  }
  const match = {
    id: 'match-1',
    phaseId: 'phase-1',
    round: 1,
    team1Id: 'team-1',
    team2Id: 'team-2',
    result: null,
    riotMatchIds: [],
  }

  it('rechaza entidades parciales antes de que lleguen al render', () => {
    expect(isTeamArray([team])).toBe(true)
    expect(isTeamArray([{ id: 'team-1', name: 'Roto' }])).toBe(false)
    expect(isPhaseArray([phase])).toBe(true)
    expect(isPhaseArray([{ id: 'phase-1', name: 'Roto' }])).toBe(false)
    expect(isMatchArray([match])).toBe(true)
    expect(isMatchArray([{ id: 'match-1' }])).toBe(false)
  })

  it('exige respuestas no vacías y contadores válidos para las mutaciones', () => {
    expect(isNonEmptyMatchArray([match])).toBe(true)
    expect(isNonEmptyMatchArray([])).toBe(false)
    expect(isGeneratedMatchesResponse({ created: 2 })).toBe(true)
    expect(isGeneratedMatchesResponse({ created: -1 })).toBe(false)
    expect(isGeneratedMatchesResponse({ created: 1.5 })).toBe(false)
    expect(isTournamentCodesResponse({ codes: ['EUW-1'], regenerated: false })).toBe(true)
    expect(isTournamentCodesResponse({ codes: [], regenerated: false })).toBe(false)
    expect(isTournamentCodesResponse({ codes: ['EUW-1'] })).toBe(false)
  })
})
