import { test, expect } from '@playwright/test'
import type { Match, Team } from '../lib/types'

test.use({ timezoneId: 'Europe/Madrid' })

for (const game of ['lol', 'valorant'] as const) test(`${game}: a team schedules and reschedules its pending matches`, async ({ page, context }, testInfo) => {
  test.setTimeout(180_000)
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const request = page.request
  expect((await request.post('/api/admin/login', { data: { password: 'e2e-admin-password' } })).ok()).toBeTruthy()
  // The isolated production build runs on HTTP loopback, so allow its Secure
  // session cookies over HTTP only in this test browser.
  await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })))
  const tournamentResponse = await request.post('/api/admin/torneos', { data: { name: `Schedule ${game}`, slug: `schedule-${game}-${Date.now()}`, game, status: 'published', platform: 'pc', region: 'eu' } })
  expect(tournamentResponse.ok(), `Tournament creation status: ${tournamentResponse.status()}`).toBeTruthy()
  const tournament = await tournamentResponse.json()
  const scope = `?tournament=${tournament.id}`
  const teams: Team[] = []
  for (const name of ['Mi equipo', 'Rival uno', 'Rival dos']) {
    const response = await request.post(`/api/admin/equipos${scope}`, { data: { name, players: [] } })
    expect(response.ok()).toBeTruthy()
    teams.push(await response.json())
  }
  const phaseResponse = await request.post(`/api/admin/fases${scope}`, { data: { name: 'Fase de grupos', type: 'groups', status: 'upcoming', order: 1, config: { bo: 3, advanceCount: 1, groups: [{ id: 'g', teamIds: teams.map(team => team.id) }] } } })
  expect(phaseResponse.ok()).toBeTruthy()
  const phase = await phaseResponse.json()
  expect((await request.post(`/api/admin/fases/generate${scope}`, { data: { phaseId: phase.id } })).ok()).toBeTruthy()
  expect((await request.post('/api/admin/torneos', { data: { ...tournament, status: 'published' } })).ok()).toBeTruthy()
  const matches: Match[] = await (await request.get(`/api/admin/partidos${scope}`)).json()
  const match = matches.find(match => [match.team1Id, match.team2Id].includes(teams[0].id) && [match.team1Id, match.team2Id].includes(teams[1].id))!
  const access = await (await request.get(`/api/admin/equipos/${teams[0].id}/access${scope}`)).json()
  expect((await request.post('/api/team/login', { data: { teamId: teams[0].id, password: access.password } })).ok()).toBeTruthy()
  await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })))
  await page.goto('/equipo')
  await expect(page.getByRole('heading', { name: 'Partidos pendientes (2)' })).toBeVisible()
  const form = page.getByRole('form', { name: 'Partido contra Rival uno' })
  await expect(form.getByRole('button', { name: 'Guardar fecha' })).toBeDisabled()
  await form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true }).click()
  const monthArrow = form.locator('nav svg').first()
  await expect(monthArrow).toHaveCSS('fill', await monthArrow.evaluate(node => getComputedStyle(node).color))
  await form.getByLabel('Hora de fecha contra rival uno', { exact: true }).fill('18:30')
  await form.getByLabel('Hora de fecha contra rival uno', { exact: true }).fill('')
  await expect(form.getByLabel('Hora de fecha contra rival uno', { exact: true })).toHaveValue('18:30')
  expect(pageErrors).toEqual([])
  await form.getByLabel('Hora de fecha contra rival uno', { exact: true }).press('Escape')
  await expect(form.getByLabel('Hora de fecha contra rival uno', { exact: true })).toBeHidden()
  await expect(form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true })).toBeFocused()
  await expect(form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true }).click()
  await form.getByRole('button', { name: 'OK', exact: true }).click()
  await form.getByRole('button', { name: 'Guardar fecha' }).click()
  await expect(page.getByRole('status')).toHaveText('Fecha del partido guardada')
  const readMatch = async () => (await (await request.get(`/api/admin/partidos${scope}`)).json() as Match[]).find(item => item.id === match.id)!
  const scheduled = await readMatch()
  expect(scheduled.scheduledAt).toBeTruthy()
  expect(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(scheduled.scheduledAt!))).toBe('18:30')
  await page.reload()
  await expect(form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true })).toContainText('18:30')

  // A second tab must not silently overwrite a newer schedule.
  const stale = await context.newPage()
  await stale.goto('/equipo')
  await expect(stale.getByRole('heading', { name: 'Partidos pendientes (2)' })).toBeVisible()
  await form.getByRole('button', { name: 'Fecha contra Rival uno', exact: true }).click()
  await form.getByLabel('Hora de fecha contra rival uno', { exact: true }).fill('19:45')
  await form.getByRole('button', { name: 'OK', exact: true }).click()
  const [rescheduled] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`/matches/${match.id}/schedule`) && response.request().method() === 'PATCH'),
    form.getByRole('button', { name: 'Guardar fecha' }).click(),
  ])
  expect(rescheduled.ok()).toBeTruthy()
  await expect(form.getByRole('button', { name: 'Guardar fecha' })).toBeDisabled()
  const staleForm = stale.getByRole('form', { name: 'Partido contra Rival uno' })
  await staleForm.getByRole('button', { name: 'Quitar fecha' }).click()
  await staleForm.getByRole('button', { name: 'Guardar fecha' }).click()
  await expect(staleForm.getByRole('alert')).toContainText('El partido cambió')
  await stale.getByRole('button', { name: 'Actualizar partidos' }).click()
  await expect(staleForm.getByRole('button', { name: 'Fecha contra Rival uno', exact: true })).toContainText('19:45')
  await stale.close()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath(`${game}-team-schedule-mobile.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await form.getByRole('button', { name: 'Quitar fecha' }).click()
  const [cleared] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`/matches/${match.id}/schedule`) && response.request().method() === 'PATCH'),
    form.getByRole('button', { name: 'Guardar fecha' }).click(),
  ])
  expect(cleared.ok()).toBeTruthy()
  await expect(form.getByRole('button', { name: 'Guardar fecha' })).toBeDisabled()
  expect((await readMatch()).scheduledAt).toBeUndefined()

  const current = await readMatch()
  expect((await request.put(`/api/admin/partidos${scope}`, { data: { ...current, result: { team1Score: 2, team2Score: 0 }, winnerId: current.team1Id } })).ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Actualizar partidos' }).click()
  await expect(page.getByRole('heading', { name: 'Partidos pendientes (1)' })).toBeVisible()
  await expect(form).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
