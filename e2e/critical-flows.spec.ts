import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

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
  config: { bo: 1; bracketTeamIds: string[] }
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
  await expect(page).toHaveURL(/\/admin$/)
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
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('Panel Admin')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
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
