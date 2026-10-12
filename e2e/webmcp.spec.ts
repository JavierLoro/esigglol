import { expect, test, type Page } from '@playwright/test'
import type { Match, Phase, Team, Tournament } from '../lib/types'

test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {}),
  args: ['--enable-blink-features=WebMCP,WebMCPTesting'],
} })

interface NativeTool { name: string; annotations: { readOnlyHint: boolean }; inputSchema: Record<string, unknown> }
interface NativeContext {
  getTools(): Promise<NativeTool[]>
  executeTool(tool: NativeTool, input: unknown): Promise<string | null>
}
type ToolResult<T = unknown> = { ok: boolean; data: T; code?: string; error?: string }

async function toolNames(page: Page) {
  return page.evaluate(async () => {
    const context = (document as Document & { modelContext?: NativeContext }).modelContext
    return context ? (await context.getTools()).map(tool => tool.name) : []
  })
}

async function call<T>(page: Page, name: string, input: Record<string, unknown> = {}): Promise<ToolResult<T>> {
  await expect.poll(() => toolNames(page)).toContain(name)
  return page.evaluate(async ({ name, input }) => {
    const context = (document as Document & { modelContext: NativeContext }).modelContext
    const tool = (await context.getTools()).find(item => item.name === name)
    if (!tool) throw new Error(`Herramienta no registrada: ${name}`)
    // Chrome anterior a 155 recibe argumentos JSON; las versiones nuevas reciben un objeto.
    const version = Number(navigator.userAgent.match(/(?:Chrome|Chromium)\/(\d+)/)?.[1])
    const result = await context.executeTool(tool, version < 155 ? JSON.stringify(input) : input)
    return result === null ? { ok: true, data: { navigating: true } } : JSON.parse(result)
  }, { name, input })
}

async function login(page: Page) {
  expect((await page.request.post('/api/admin/login', { data: { password: 'e2e-admin-password' } })).ok()).toBeTruthy()
  await page.context().addCookies((await page.context().cookies()).map(cookie => ({ ...cookie, secure: false })))
}

async function createTournament(page: Page, game: 'lol' | 'valorant') {
  const response = await page.request.post('/api/admin/torneos', { data: {
    name: `WebMCP ${game}`, slug: `webmcp-${game}-${crypto.randomUUID()}`, game, platform: 'pc', region: 'eu', status: 'draft',
  } })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<Tournament>
}

for (const game of ['lol', 'valorant'] as const) test(`${game}: WebMCP nativo guarda equipos, horarios y resultados y actualiza el bracket`, async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  const tournament = await createTournament(page, game)
  const scope = `?tournament=${tournament.id}&game=${game}`
  const input = { tournamentId: tournament.id }
  await page.goto(`/admin/equipos${scope}`)
  const context = await call<{ tournament: Tournament }>(page, 'admin_context')
  expect(context.data.tournament.id).toBe(tournament.id)
  expect((await call<Tournament[]>(page, 'admin_list_tournaments')).data.some(item => item.id === tournament.id)).toBe(true)

  const teams: Team[] = []
  for (const name of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
    const result = await call<Team>(page, 'admin_create_team', { ...input, name })
    expect(result.ok, result.error).toBe(true)
    teams.push(result.data)
    await expect(page.getByRole('button', { name: new RegExp(`${name}.*0 jugadores`) })).toBeVisible()
  }
  const players = [{ id: `player-${tournament.id}`, summonerName: 'Academia#EUW', primaryRole: game === 'lol' ? 'Top' : 'Duelista', secondaryRole: game === 'lol' ? 'Jungle' : 'Iniciador', rosterStatus: 'starter' }]
  const first = teams[0]
  const roster = await call<Team>(page, 'admin_update_team', { ...input, id: first.id, version: first.version, players })
  expect(roster.ok, roster.error).toBe(true)
  const rename = await call<Team>(page, 'admin_update_team', { ...input, id: first.id, version: roster.data.version, name: 'Alpha renovado' })
  expect(rename.ok, rename.error).toBe(true)
  expect(rename.data.players).toEqual(players)
  await expect(page.getByRole('button', { name: /Alpha renovado.*1 jugadores/ })).toBeVisible()
  expect((await call(page, 'admin_update_team', { ...input, id: first.id, version: first.version, name: 'Obsoleto' })).code).toBe('CONFLICT')
  expect((await call(page, 'admin_update_team', { ...input, id: first.id, version: rename.data.version, password: 'not-a-real-secret' })).code).toBe('INVALID_INPUT')
  expect((await call(page, 'admin_list_teams', { tournamentId: 'legacy-lol' })).code).toBe('WRONG_TOURNAMENT')

  const details = page.getByRole('button', { name: /Alpha renovado.*1 jugadores/ })
  await details.click()
  await page.getByLabel('Nombre del equipo Alpha renovado', { exact: true }).fill('Edición manual')
  expect((await call(page, 'admin_update_team', { ...input, id: first.id, version: rename.data.version, name: 'Pisar formulario' })).code).toBe('PENDING_CHANGES')
  expect((await call(page, 'admin_open_section', { ...input, section: 'partidos' })).code).toBe('PENDING_CHANGES')
  expect((await call<Team>(page, 'admin_get_team', { ...input, id: first.id })).data.name).toBe('Alpha renovado')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible()
  const manual = await call<Team>(page, 'admin_get_team', { ...input, id: first.id })
  expect(manual.data.name).toBe('Edición manual')

  const phaseResponse = await page.request.post(`/api/admin/fases${scope}`, { data: {
    name: 'Final Four WebMCP', type: 'final-four', status: 'upcoming', order: 1,
    config: { bo: 1, bracketTeamIds: teams.map(team => team.id), include3rdPlace: false, confirmedBracket: true },
  } })
  expect(phaseResponse.ok()).toBeTruthy()
  const phase: Phase = await phaseResponse.json()
  expect((await page.request.post(`/api/admin/fases/generate${scope}`, { data: { phaseId: phase.id } })).ok()).toBeTruthy()

  await Promise.all([
    page.waitForURL(new RegExp(`/admin/partidos[?]tournament=${tournament.id}`)),
    call(page, 'admin_open_section', { ...input, section: 'partidos' }).catch(error => {
      if (!/Execution context was destroyed/.test(String(error))) throw error
    }),
  ])
  await expect.poll(() => toolNames(page)).toContain('admin_schedule_match')
  expect(await toolNames(page)).not.toContain('admin_update_team')
  const all = (await call<Match[]>(page, 'admin_list_matches', input)).data
  const semis = all.filter(match => match.round === 1)
  expect(semis).toHaveLength(2)
  const scheduled = await call<Match>(page, 'admin_schedule_match', { ...input, id: semis[0].id, version: semis[0].version, scheduledAt: '2026-10-14T18:00:00+02:00' })
  expect(scheduled.ok, scheduled.error).toBe(true)
  expect(scheduled.data.scheduledAt).toBe('2026-10-14T16:00:00.000Z')
  await expect(page.getByLabel(`Fecha y hora del partido en ${phase.name}, ronda 1`).first().locator('time')).toHaveAttribute('datetime', '2026-10-14T16:00:00.000Z')
  const badResult = await call(page, 'admin_save_result', { ...input, id: semis[0].id, version: scheduled.data.version, result: { team1Score: 4, team2Score: 0 } })
  expect(badResult).toMatchObject({ ok: false, code: 'VALIDATION' })
  const saved = await call<Match>(page, 'admin_save_result', {
    ...input, id: semis[0].id, version: scheduled.data.version, result: { team1Score: 1, team2Score: 0 },
    ...(game === 'valorant' ? { maps: [{ map: 'Ascent', team1Rounds: 13, team2Rounds: 7 }] } : {}),
  })
  expect(saved.ok, saved.error).toBe(true)
  expect(saved.data.winnerId).toBe(semis[0].team1Id)
  await expect(page.getByLabel(`Marcador de Edición manual en ${phase.name}, ronda 1`)).toHaveValue('1')
  const second = await call<Match>(page, 'admin_save_result', { ...input, id: semis[1].id, version: semis[1].version, result: { team1Score: 0, team2Score: 1 } })
  expect(second.ok, second.error).toBe(true)
  const final = (await call<Match[]>(page, 'admin_list_matches', input)).data.find(match => match.round === 2)!
  expect(final.team1Id).toBe(semis[0].team1Id)
  expect(final.team2Id).toBe(semis[1].team2Id)
  await expect(page.getByLabel(`Equipo 1 del partido en ${phase.name}, ronda 2`)).toHaveValue(final.team1Id)
  const finished = await call<Match>(page, 'admin_save_result', { ...input, id: final.id, version: final.version, result: { team1Score: 1, team2Score: 0 } })
  expect(finished.ok, finished.error).toBe(true)
  expect((await call<Phase[]>(page, 'admin_list_phases', input)).data.find(item => item.id === phase.id)?.status).toBe('completed')
  const unscheduled = await call<Match>(page, 'admin_schedule_match', { ...input, id: semis[0].id, version: saved.data.version, scheduledAt: null })
  expect(unscheduled.ok, unscheduled.error).toBe(true)
  expect(unscheduled.data.scheduledAt).toBeUndefined()

  const groupResponse = await page.request.post(`/api/admin/fases${scope}`, { data: {
    name: 'Grupos WebMCP', type: 'groups', status: 'upcoming', order: 2,
    config: { bo: 3, advanceCount: 2, groups: [{ id: 'g', teamIds: teams.map(team => team.id) }] },
  } })
  expect(groupResponse.ok()).toBeTruthy()
  const group: Phase = await groupResponse.json()
  await page.reload()
  const created = await call<Match>(page, 'admin_create_match', { ...input, phaseId: group.id, round: 1, team1Id: teams[0].id, team2Id: teams[1].id })
  expect(created.ok, created.error).toBe(true)
  await expect(page.getByLabel(`Equipo 1 del partido en ${group.name}, ronda 1`)).toHaveValue(teams[0].id)
  const partial = await call<Match>(page, 'admin_save_result', { ...input, id: created.data.id, version: created.data.version, result: { team1Score: 1, team2Score: 0 } })
  expect(partial.ok, partial.error).toBe(true)
  expect(partial.data.winnerId).toBeUndefined()
  await page.getByLabel(`Marcador de Edición manual en ${group.name}, ronda 1`).fill('2')
  expect((await call(page, 'admin_schedule_match', { ...input, id: created.data.id, version: partial.data.version, scheduledAt: null })).code).toBe('PENDING_CHANGES')
  await page.reload()
  const cleared = await call<Match>(page, 'admin_save_result', { ...input, id: created.data.id, version: partial.data.version, result: null })
  expect(cleared.ok, cleared.error).toBe(true)
  expect(cleared.data.result).toBeNull()

  if (game === 'lol') {
    const fixture = await page.request.put(`/api/admin/partidos${scope}`, { data: {
      ...cleared.data, result: { team1Score: 1, team2Score: 0 }, riotMatchIds: [],
      games: [{ duration: '25:00', winner: 'team1', team1Players: [], team2Players: [] }],
      tournamentCallbackToken: 'webmcp-test-only-marker', tournamentCodes: ['webmcp-test-only-marker'],
    } })
    expect(fixture.ok()).toBeTruthy()
    const withGames: Match = await fixture.json()
    const safe = await call<Match>(page, 'admin_get_match', { ...input, id: withGames.id })
    expect(JSON.stringify(safe)).not.toContain('webmcp-test-only-marker')
    expect((await call(page, 'admin_save_result', { ...input, id: withGames.id, version: withGames.version, result: null })).code).toBe('VALIDATION')
    const preserved = await call<Match>(page, 'admin_schedule_match', { ...input, id: withGames.id, version: withGames.version, scheduledAt: '2026-10-15T12:00:00Z' })
    expect(preserved.ok, preserved.error).toBe(true)
    expect(JSON.stringify(preserved)).not.toContain('webmcp-test-only-marker')
    const persisted: Match = (await page.request.get(`/api/admin/partidos${scope}`).then(response => response.json())).find((match: Match) => match.id === withGames.id)
    expect(persisted.games).toEqual(withGames.games)
    expect(persisted.tournamentCallbackToken).toBe('webmcp-test-only-marker')
  }

  const other = await createTournament(page, game)
  const otherTeamResponse = await page.request.post(`/api/admin/equipos?tournament=${other.id}`, { data: { name: 'Otro torneo', players: [] } })
  const otherTeam: Team = await otherTeamResponse.json()
  await page.reload()
  await page.getByLabel('Edición activa').selectOption(other.id)
  await expect(page).toHaveURL(new RegExp(`tournament=${other.id}`))
  expect((await call(page, 'admin_list_matches', input)).code).toBe('WRONG_TOURNAMENT')
  await page.goto(`/admin/equipos${scope}`)
  expect((await call(page, 'admin_update_team', { ...input, id: otherTeam.id, version: otherTeam.version, name: 'No permitido' })).code).toBe('NOT_FOUND')
  expect((await page.request.get(`/api/admin/equipos?tournament=${other.id}`).then(response => response.json()))[0].name).toBe('Otro torneo')

  expect((await page.request.post('/api/admin/torneos', { data: { ...tournament, status: 'archived' } })).ok()).toBeTruthy()
  const beforeArchive = await call<Team>(page, 'admin_get_team', { ...input, id: teams[0].id })
  expect((await call(page, 'admin_update_team', { ...input, id: teams[0].id, version: beforeArchive.data.version, name: 'Archivado' })).code).toBe('CONFLICT')
  await page.reload()
  await expect.poll(() => toolNames(page)).toContain('admin_get_team')
  expect(await toolNames(page)).not.toContain('admin_update_team')
  expect(await toolNames(page)).not.toContain('admin_create_team')
  await expect(page.getByRole('button', { name: 'Añadir equipo' })).toBeDisabled()
  await page.goto(`/admin/partidos${scope}`)
  await expect.poll(() => toolNames(page)).toContain('admin_get_match')
  expect(await toolNames(page)).not.toContain('admin_save_result')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  expect(await toolNames(page)).toEqual([])
})

test('retira herramientas nativas al expirar la sesión y no las ofrece al admin de equipo', async ({ page }) => {
  await login(page)
  await page.goto('/admin/equipos?tournament=legacy-lol&game=lol')
  await expect.poll(() => toolNames(page)).toContain('admin_list_teams')
  await page.context().clearCookies()
  const denied = page.waitForResponse(response => response.url().includes('/api/admin/equipos?') && response.status() === 401)
  await call(page, 'admin_list_teams', { tournamentId: 'legacy-lol' }).catch(error => {
    // Chrome 151 cancela la llamada en curso al retirar su registro y devuelve UnknownError.
    if (!/AbortError|UnknownError: The operation failed for an unknown transient reason/.test(String(error))) throw error
  })
  await denied
  await expect.poll(() => toolNames(page)).toEqual([])
  await expect(page.getByRole('alert').filter({ hasText: 'Sesión expirada' })).toBeVisible()
  await page.goto('/equipo/login')
  expect(await toolNames(page)).toEqual([])
})

test('sin WebMCP el panel conserva el guardado manual', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'modelContext', { configurable: true, value: undefined }))
  await login(page)
  const tournament = await createTournament(page, 'lol')
  await page.goto(`/admin/equipos?tournament=${tournament.id}&game=lol`)
  expect(await toolNames(page)).toEqual([])
  await page.getByRole('button', { name: 'Añadir equipo' }).click()
  await page.getByLabel('Nombre del equipo nuevo', { exact: true }).fill('Equipo manual')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Equipo manual.*0 jugadores/ })).toBeVisible()
})
