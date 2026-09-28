import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

test.use({ extraHTTPHeaders: { 'x-tournament-id': 'legacy-lol' } })

const password = 'e2e-admin-password'

interface Team {
  id: string
  name: string
}

interface Phase {
  id: string
  name: string
  type: 'elimination'
  status: 'upcoming'
  order: number
  config: { bo: 1; bracketTeamIds: string[]; confirmedBracket?: boolean }
}

interface Match {
  id: string
  phaseId: string
  round: number
  team1Id: string
  team2Id: string
  result: null | { team1Score: number; team2Score: number }
  winnerId?: string
  riotMatchIds: []
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByPlaceholder('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=legacy-lol&game=lol$/, { timeout: 30_000 })
}

async function createTeam(request: APIRequestContext, name: string): Promise<Team> {
  const response = await request.post('/api/admin/equipos', {
    data: { name, logo: '', players: [] },
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<Team>
}

async function createPhase(request: APIRequestContext, name: string, teamIds: string[]): Promise<Phase> {
  const response = await request.post('/api/admin/fases', {
    data: {
      name,
      type: 'elimination',
      status: 'upcoming',
      order: 1,
      config: { bo: 1, bracketTeamIds: teamIds },
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<Phase>
}

test('permite iniciar y cerrar sesión de administrador', async ({ page }) => {
  await page.goto('/admin/equipos')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Acceso admin' })).toBeVisible()
  await expect(page.getByText('Panel Admin')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)

  await page.getByPlaceholder('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=legacy-lol&game=lol$/)
  await expect(page.getByText('Panel Admin')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('personaliza el subtítulo y el canal de Twitch desde Apariencia', async ({ page }) => {
  await login(page)
  await page.goto('/admin/apariencia')
  await page.getByRole('textbox', { name: /Subtítulo/ }).fill('ESI Ciudad Real · Torneo Valorant')
  await page.getByRole('textbox', { name: 'Canal de Twitch' }).fill('esi_valorant')
  await page.getByRole('button', { name: 'Guardar banner' }).click()
  await expect(page.getByRole('status')).toContainText('Banner guardado')
  const branding = await page.request.get('/api/admin/apariencia')
  expect(await branding.json()).toMatchObject({ subtitle: 'ESI Ciudad Real · Torneo Valorant', channel: 'esi_valorant' })
  await page.goto('/')
  await expect(page.getByText('ESI Ciudad Real · Torneo Valorant')).toBeVisible()
})

test('el responsable de Valorant entra desde su invitación aunque el portapapeles LAN esté bloqueado', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }))
  await login(page)
  const draftResponse = await page.request.post('/api/admin/torneos', {
    data: { name: 'Acceso Valorant', slug: 'acceso-valorant', game: 'valorant', platform: 'pc', region: 'eu', status: 'draft' },
  })
  expect(draftResponse.ok()).toBeTruthy()
  const tournament = await draftResponse.json() as { id: string }
  const publishedResponse = await page.request.post('/api/admin/torneos', {
    data: { id: tournament.id, name: 'Acceso Valorant', slug: 'acceso-valorant', game: 'valorant', platform: 'pc', region: 'eu', status: 'published' },
  })
  expect(publishedResponse.ok()).toBeTruthy()
  const teamResponse = await page.request.post(`/api/admin/equipos?tournament=${tournament.id}`, {
    data: { name: 'Responsables Valorant', logo: '', players: [] },
  })
  expect(teamResponse.ok()).toBeTruthy()
  const team = await teamResponse.json() as Team

  await page.goto(`/admin/equipos?tournament=${tournament.id}&game=valorant`)
  await page.getByText(team.name, { exact: true }).click()
  await page.getByRole('button', { name: 'Gestionar acceso' }).click()
  await page.getByRole('button', { name: `Copiar credenciales de ${team.name}` }).click()
  const invitation = await page.getByRole('textbox', { name: /Selecciona y copia estos datos manualmente/ }).inputValue()
  const [, passwordLine, accessLine] = invitation.split('\n')
  expect(accessLine).toContain(`tournament=${tournament.id}&team=${team.id}`)

  const publicTeams = await page.request.get(`/api/data/equipos?tournament=${tournament.id}`)
  expect(publicTeams.ok()).toBeTruthy()
  expect((await publicTeams.json() as Team[]).some(item => item.id === team.id)).toBeTruthy()
  const teamListResponse = page.waitForResponse(response => response.url().includes('/api/data/equipos'))
  await page.goto(accessLine.slice('Acceso: '.length))
  expect((await teamListResponse).status()).toBe(200)
  await expect(page.getByRole('combobox', { name: 'Equipo' })).toHaveValue(team.id)
  await page.getByLabel('Contraseña').fill(passwordLine.slice('Contraseña: '.length))
  await page.getByRole('button', { name: 'Entrar al panel' }).click()
  await expect(page.getByRole('heading', { name: team.name })).toBeVisible({ timeout: 30_000 })
})

test('genera un bracket desde el panel de fases', async ({ page }) => {
  await login(page)
  const request = page.request
  const teams = await Promise.all([
    createTeam(request, 'Bracket Alpha'),
    createTeam(request, 'Bracket Beta'),
    createTeam(request, 'Bracket Gamma'),
    createTeam(request, 'Bracket Delta'),
  ])
  const phase = await createPhase(request, 'Bracket E2E', teams.map(team => team.id))

  await page.goto('/admin/fases')
  const phaseCard = page.locator(`input[value="${phase.name}"]`).locator('xpath=../..')
  await phaseCard.getByRole('button', { name: 'Generar bracket' }).click()
  await expect(page.getByText('2 partidos generados')).toBeVisible()
  await expect(phaseCard.getByRole('button', { name: 'Confirmar' })).toBeVisible()

  const matchesResponse = await request.get('/api/admin/partidos')
  expect(matchesResponse.ok()).toBeTruthy()
  const matches = await matchesResponse.json() as Match[]
  expect(matches.filter(match => match.phaseId === phase.id)).toHaveLength(2)
})

test('crea una fase nueva, genera y confirma el bracket sin recargar', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }))
  await login(page)
  const teams = await Promise.all(['A', 'B', 'C', 'D'].map(name => createTeam(page.request, `Draft ${name}`)))
  await page.goto('/admin/fases')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Añadir fase' }).click()
  const nameInput = page.getByRole('textbox', { name: /Nombre de la fase/ }).last()
  const card = nameInput.locator('xpath=../..')
  await nameInput.fill('Final Four nuevo')
  await card.getByRole('combobox', { name: /Tipo de la fase/ }).selectOption('final-four')
  for (const team of teams) await card.getByRole('checkbox', { name: `${team.name}, equipos del bracket de la fase Final Four nuevo` }).check()
  await card.getByRole('button', { name: 'Generar bracket' }).click()
  await expect(card.getByRole('button', { name: 'Confirmar' })).toBeVisible()
  await card.getByRole('button', { name: 'Confirmar' }).click()
  await expect(card.getByText('Confirmado', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: /fase Final Four nuevo/ }).getByText('Confirmado', { exact: true })).toBeVisible()
})

test('conserva la fase nueva cuando falla la generación y permite reintentar', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  const teams = await Promise.all(['A', 'B', 'C', 'D'].map(name => createTeam(page.request, `Reintento ${name}`)))
  await page.goto('/admin/fases')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Añadir fase' }).click()
  const nameInput = page.getByRole('textbox', { name: /Nombre de la fase/ }).last()
  const card = nameInput.locator('xpath=../..')
  await nameInput.fill('Fase reintento')
  for (const team of teams) await card.getByRole('checkbox', { name: `${team.name}, equipos del bracket de la fase Fase reintento` }).check()
  await page.route('**/api/admin/fases/generate**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fallo simulado"}' }))
  await card.getByRole('button', { name: 'Generar bracket' }).click()
  await expect(page.getByText(/Fase guardada, pero no se generaron los partidos/)).toBeVisible()
  await page.unroute('**/api/admin/fases/generate**')
  await card.getByRole('button', { name: 'Generar bracket' }).click()
  await expect(card.getByRole('button', { name: 'Confirmar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: /Fase reintento/ })).toHaveValue('Fase reintento')
})

test('genera partidos de grupos desde el frontal', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  const teams = await Promise.all(['A', 'B'].map(name => createTeam(page.request, `Grupo ${name}`)))
  await page.goto('/admin/fases')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Añadir fase' }).click()
  const nameInput = page.getByRole('textbox', { name: /Nombre de la fase/ }).last()
  const card = nameInput.locator('xpath=../..')
  await nameInput.fill('Grupo nuevo')
  await card.getByRole('combobox', { name: /Tipo de la fase/ }).selectOption('groups')
  await card.getByRole('button', { name: 'Añadir grupo' }).click()
  await card.getByRole('spinbutton', { name: /Equipos que pasan por grupo/ }).fill('1')
  for (const team of teams) await card.getByRole('checkbox', { name: `${team.name}, grupo A de la fase Grupo nuevo` }).check()
  await card.getByRole('button', { name: 'Generar partidos' }).click()
  await expect(card.getByText('Generado', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: /fase Grupo nuevo/ }).getByText('Generado', { exact: true })).toBeVisible()
})

test('crea un torneo aunque randomUUID no esté disponible en el navegador', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }))
  await login(page)
  await page.goto('/admin/torneos')
  await page.getByRole('textbox', { name: 'Nombre del torneo' }).fill('Torneo HTTP LAN')
  await page.getByRole('combobox', { name: 'Juego del torneo' }).selectOption('valorant')
  await page.getByRole('button', { name: 'Crear borrador' }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre de Torneo HTTP LAN' })).toBeVisible()
})

test('oculta el bracket en superficies públicas hasta confirmarlo y conserva acceso admin', async ({ page }) => {
  await login(page)
  const request = page.request
  const teams = await Promise.all([
    createTeam(request, 'Publicación Alpha'),
    createTeam(request, 'Publicación Beta'),
    createTeam(request, 'Publicación Gamma'),
    createTeam(request, 'Publicación Delta'),
  ])
  const phase = await createPhase(request, 'Bracket publicación E2E', teams.map(team => team.id))

  await page.goto('/admin/fases')
  const phaseCard = page.locator(`input[value="${phase.name}"]`).locator('xpath=../..')
  await phaseCard.getByRole('button', { name: 'Generar bracket' }).click()
  await expect(page.getByText('2 partidos generados')).toBeVisible()

  const adminMatchesResponse = await request.get('/api/admin/partidos')
  expect(adminMatchesResponse.ok()).toBeTruthy()
  const adminMatches = await adminMatchesResponse.json() as Match[]
  const draftMatches = adminMatches.filter(match => match.phaseId === phase.id)
  expect(draftMatches).toHaveLength(2)
  const draftMatch = draftMatches[0]

  const publicDraft = await request.get('/api/data/fases')
  const publicDraftData = await publicDraft.json() as { phases: Phase[]; matches: Match[] }
  expect(publicDraftData.phases.some(item => item.id === phase.id)).toBeFalsy()
  expect(publicDraftData.matches.some(item => item.phaseId === phase.id)).toBeFalsy()
  expect((await request.get(`/partidos/${draftMatch.id}`, { maxRedirects: 0 })).status()).toBe(404)
  expect((await request.get(`/overlay/partidos/${draftMatch.id}`)).status()).toBe(404)

  await page.goto('/')
  await expect(page.getByText(teams[0].name)).toHaveCount(0)
  await page.goto('/fases')
  await expect(page.getByText(phase.name)).toHaveCount(0)
  await page.goto(`/comparar?t1=${draftMatch.team1Id}&t2=${draftMatch.team2Id}`)
  await expect(page.getByText('Sin enfrentamientos previos')).toBeVisible()

  await page.goto('/admin/fases')
  const refreshedPhaseCard = page.locator(`input[value="${phase.name}"]`).locator('xpath=../..')
  await refreshedPhaseCard.getByRole('button', { name: 'Confirmar' }).click()
  await expect(refreshedPhaseCard.getByText('Confirmado', { exact: true })).toBeVisible()

  const publicConfirmed = await request.get('/api/data/fases')
  const publicConfirmedData = await publicConfirmed.json() as { phases: Phase[]; matches: Match[] }
  expect(publicConfirmedData.phases.some(item => item.id === phase.id)).toBeTruthy()
  expect(publicConfirmedData.matches.some(item => item.phaseId === phase.id)).toBeTruthy()
  expect((await request.get(`/partidos/${draftMatch.id}`, { maxRedirects: 0 })).status()).toBe(307)
  expect((await request.get(`/overlay/partidos/${draftMatch.id}`)).ok()).toBeTruthy()

  await page.goto('/')
  await expect(page.getByText(teams[0].name)).toBeVisible()
  await page.goto('/fases')
  await expect(page.getByText(phase.name)).toBeVisible()
  await page.goto(`/comparar?t1=${draftMatch.team1Id}&t2=${draftMatch.team2Id}`)
  await expect(page.getByText('1 enfrentamientos en el torneo')).toBeVisible()
})

test('reporta y persiste el resultado de un partido', async ({ page }) => {
  await login(page)
  const request = page.request
  const team1 = await createTeam(request, 'Resultado Alpha')
  const team2 = await createTeam(request, 'Resultado Beta')
  const phase = await createPhase(request, 'Resultado E2E', [team1.id, team2.id])
  const matchResponse = await request.post('/api/admin/partidos', {
    data: {
      phaseId: phase.id,
      round: 1,
      team1Id: team1.id,
      team2Id: team2.id,
      result: null,
      riotMatchIds: [],
    },
  })
  expect(matchResponse.ok()).toBeTruthy()
  const [match] = await matchResponse.json() as Match[]

  await page.goto('/admin/partidos')
  const phaseRegion = page.locator(`#phase-matches-${phase.id}`)
  await phaseRegion.getByRole('button', { name: '+ Resultado' }).click()
  const scores = phaseRegion.getByRole('spinbutton')
  await scores.nth(2).fill('1')
  await expect(phaseRegion.getByRole('button', { name: 'Ganador' })).toBeVisible()
  await phaseRegion.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Guardado')).toBeVisible()

  const matchesResponse = await request.get('/api/admin/partidos')
  const matches = await matchesResponse.json() as Match[]
  const saved = matches.find(item => item.id === match.id)
  expect(saved?.result).toEqual({ team1Score: 0, team2Score: 1 })
  expect(saved?.winnerId).toBe(team2.id)
})

test('expone nombres accesibles contextuales y tarjetas operables con teclado', async ({ page }) => {
  await login(page)
  const request = page.request
  const teamResponse = await request.post('/api/admin/equipos', {
    data: {
      name: 'Accesible Alpha',
      logo: '',
      players: [{ id: 'a11y-player', summonerName: 'Teclado#EUW', primaryRole: 'Mid' }],
    },
  })
  expect(teamResponse.ok()).toBeTruthy()
  const team1 = await teamResponse.json() as Team
  const team2 = await createTeam(request, 'Accesible Beta')
  const phase = await createPhase(request, 'Fase accesible', [team1.id, team2.id])
  const matchResponse = await request.post('/api/admin/partidos', {
    data: {
      phaseId: phase.id,
      round: 1,
      team1Id: team1.id,
      team2Id: team2.id,
      result: { team1Score: 0, team2Score: 0 },
      riotMatchIds: [],
    },
  })
  expect(matchResponse.ok()).toBeTruthy()

  await page.goto('/admin/equipos')
  const teamToggle = page.getByRole('button', { name: /Accesible Alpha.*1 jugadores/ })
  await teamToggle.focus()
  await page.keyboard.press('Enter')
  await expect(teamToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('combobox', { name: /Rol principal de Teclado#EUW en Accesible Alpha/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar jugador Teclado#EUW de Accesible Alpha' })).toBeVisible()

  await page.goto('/admin/fases')
  await expect(page.locator('input[value="Fase accesible"]')).toHaveAccessibleName(/Nombre de la fase \d+: Fase accesible/)
  await expect(page.getByRole('combobox', { name: 'Tipo de la fase Fase accesible' })).toBeVisible()

  await page.goto('/admin/partidos')
  await expect(page.getByRole('checkbox', { name: /Seleccionar partido de Accesible Alpha contra Accesible Beta/ })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: /Marcador de Accesible Alpha en Fase accesible/ })).toBeVisible()

  await page.goto(`/comparar?t1=${team1.id}&t2=${team2.id}`)
  await expect(page.getByRole('combobox', { name: 'Equipo 1 para comparar' })).toBeVisible()
  const playerCard = page.getByRole('button', { name: 'Seleccionar jugador Teclado#EUW' })
  await playerCard.focus()
  await page.keyboard.press('Enter')
  await expect(playerCard).toHaveAttribute('aria-pressed', 'true')
})
