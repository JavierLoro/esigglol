import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { adminRequest, AdminRequestError, isOk } from '../admin-client'
import { createTeamInput, matchForAgent, phaseForAgent, saveResultInput, scheduleMatchInput, teamForAgent, tournamentForAgent, updateTeamInput } from '../admin-webmcp'
import { assertWebMCPNavigation, assertWebMCPTournament, registerWebMCPTools, webMCPTool, WebMCPError, type WebMCPTool } from '../webmcp'
import type { Match, Phase, Team, Tournament } from '../types'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const signal = () => new AbortController().signal
const invoke = async (tool: WebMCPTool, input: unknown = {}) => JSON.parse(await tool.execute(input, { signal: signal() }))

describe('contratos WebMCP del admin', () => {
  it('rechaza escrituras incompletas y campos ajenos a la operación', () => {
    expect(createTeamInput.safeParse({ tournamentId: 'a', name: 'Equipo', password: 'not-a-real-secret' }).success).toBe(false)
    expect(createTeamInput.safeParse({ tournamentId: 'a', name: 'Equipo', players: [{ id: 'p', summonerName: 'Nick#EUW' }] }).success).toBe(false)
    expect(updateTeamInput.safeParse({ tournamentId: 'a', id: 't', version: 1 }).success).toBe(false)
    expect(updateTeamInput.safeParse({ tournamentId: 'a', id: 't', version: 0, name: 'Equipo' }).success).toBe(false)
    expect(updateTeamInput.parse({ tournamentId: 'a', id: 't', version: 1, name: 'Equipo' }).players).toBeUndefined()
    expect(saveResultInput.safeParse({ tournamentId: 'a', id: 'm', version: 1 }).success).toBe(false)
    expect(saveResultInput.safeParse({ tournamentId: 'a', id: 'm', version: 1, result: { team1Score: -1, team2Score: 0 } }).success).toBe(false)
    expect(scheduleMatchInput.safeParse({ tournamentId: 'a', id: 'm', version: 1, scheduledAt: '2026-10-14T18:00:00' }).success).toBe(false)
    expect(scheduleMatchInput.safeParse({ tournamentId: 'a', id: 'm', version: 1, scheduledAt: '2026-10-14T18:00:00+02:00' }).success).toBe(true)
  })

  it('excluye secretos, datos externos y propiedades futuras, también en objetos anidados', () => {
    const forbidden = { password: 'not-a-real-secret', apiKey: 'not-a-real-secret', tournamentCallbackToken: 'not-a-real-secret' }
    const tournament: Tournament = { id: 'a', name: 'A', slug: 'a', game: 'lol', platform: 'pc', region: 'eu', status: 'draft', ...forbidden }
    const team: Team = { id: 't', version: 1, name: 'Team', logo: '', players: [{ id: 'p', summonerName: 'Nick#EUW', primaryRole: 'Top', ...forbidden }], ...forbidden }
    const phase: Phase = { id: 'f', version: 1, name: 'Fase', type: 'groups', status: 'upcoming', order: 0, config: { bo: 1, advanceCount: 1, groups: [{ id: 'g', teamIds: ['t', 'u'], ...forbidden }], ...forbidden }, ...forbidden }
    const match: Match = { id: 'm', version: 1, phaseId: 'f', round: 1, team1Id: 't', team2Id: 'u', result: { team1Score: 1, team2Score: 0, ...forbidden }, maps: [{ team1Rounds: 13, team2Rounds: 7, ...forbidden }], riotMatchIds: [], tournamentCodes: ['not-a-real-secret'], ...forbidden }
    const output = JSON.stringify([tournamentForAgent(tournament), teamForAgent(team), phaseForAgent(phase), matchForAgent(match)])
    expect(output).not.toContain('not-a-real-secret')
    expect(output).not.toContain('tournamentCodes')
    expect(output).toContain('Nick#EUW')
    expect(output).toContain('team1Score')
  })

  it('comprueba el torneo explícito y no usa una edición por defecto', () => {
    vi.stubGlobal('window', { location: { search: '?tournament=a' } })
    expect(() => assertWebMCPTournament('a', 'a')).not.toThrow()
    expect(() => assertWebMCPTournament('a', 'b')).toThrow(WebMCPError)
    expect(() => assertWebMCPTournament(undefined, 'a')).toThrow(WebMCPError)
    vi.stubGlobal('window', { location: { search: '' } })
    expect(() => assertWebMCPTournament('a', 'a')).toThrow(WebMCPError)
  })

  it('permite cancelar navegación ante formularios pendientes', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    expect(() => assertWebMCPNavigation()).not.toThrow()
    target.addEventListener('admin-webmcp-navigate', event => event.preventDefault())
    expect(() => assertWebMCPNavigation()).toThrow('cambios pendientes')
  })
})

describe('registro y ejecución WebMCP', () => {
  it('valida entradas antes de ejecutar y devuelve errores utilizables sin falsas confirmaciones', async () => {
    const execute = vi.fn(async (input: { name: string }) => input)
    const tool = webMCPTool('write', 'Guarda un nombre', z.strictObject({ name: z.string().min(1) }), execute, false)
    expect(tool.annotations).toMatchObject({ readOnlyHint: false, consequentialHint: true })
    expect(await invoke(tool, { name: '', unexpected: true })).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(execute).not.toHaveBeenCalled()
    expect(await invoke(tool, { name: 'Equipo' })).toEqual({ ok: true, data: { name: 'Equipo' } })
    execute.mockRejectedValueOnce(new AdminRequestError('validation', 'Cambió en otra sesión', 409))
    expect(await invoke(tool, { name: 'Equipo' })).toMatchObject({ ok: false, code: 'CONFLICT' })
    execute.mockRejectedValueOnce(new WebMCPError('PENDING_CHANGES', 'Guarda primero'))
    expect(await invoke(tool, { name: 'Equipo' })).toEqual({ ok: false, code: 'PENDING_CHANGES', error: 'Guarda primero' })
  })

  it('retira herramientas al expirar la sesión', async () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const expired = vi.fn()
    target.addEventListener('admin-session-expired', expired)
    const tool = webMCPTool('read', 'Consulta', z.strictObject({}), async () => adminRequest(Promise.resolve(new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })), isOk))
    expect(await invoke(tool)).toMatchObject({ ok: false, code: 'SESSION' })
    expect(expired).toHaveBeenCalledOnce()
  })

  it('retira el registro y aborta llamadas pendientes sin permitir nuevas escrituras', async () => {
    const registered: WebMCPTool[] = []
    const registrationSignals: AbortSignal[] = []
    const tool = webMCPTool('write', 'Cambio', z.strictObject({}), async (_input, executionSignal) => {
      await new Promise<void>((_resolve, reject) => executionSignal.addEventListener('abort', () => reject(executionSignal.reason), { once: true }))
    }, false)
    const cleanup = registerWebMCPTools({ registerTool: (item, options) => { registered.push(item); registrationSignals.push(options.signal) } }, [tool])
    const pending = invoke(registered[0])
    expect(await invoke(registered[0])).toMatchObject({ ok: false, code: 'BUSY' })
    cleanup()
    expect(registrationSignals[0].aborted).toBe(true)
    expect(await pending).toMatchObject({ ok: false, code: 'CANCELLED' })
    expect(await invoke(registered[0])).toMatchObject({ ok: false, code: 'UNAVAILABLE' })
  })

  it('un fallo de registro no rompe el panel ni revela detalles internos', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tool = webMCPTool('read', 'Consulta', z.strictObject({}), async () => [])
    const cleanup = registerWebMCPTools({ registerTool: () => Promise.reject(new Error('not-a-real-secret')) }, [tool])
    await Promise.resolve()
    expect(warn).toHaveBeenCalledWith('No se pudo registrar WebMCP: read')
    cleanup()
  })

  it('admite navegadores que no pasan opciones de ejecución', async () => {
    let registered: WebMCPTool | undefined
    const tool = webMCPTool('read', 'Consulta', z.strictObject({}), async () => 'datos')
    const cleanup = registerWebMCPTools({ registerTool: item => { registered = item } }, [tool])
    expect(JSON.parse(await registered!.execute({}))).toEqual({ ok: true, data: 'datos' })
    cleanup()
  })
})
