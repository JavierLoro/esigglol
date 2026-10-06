import { expect, test } from '@playwright/test'
import type { Team } from '../lib/types'

for (const game of ['lol', 'valorant'] as const) test(`${game}: elimina equipos desde el panel, también después de subir un logo`, async ({ page, context }) => {
  test.setTimeout(120_000)
  const request = page.request
  expect((await request.post('/api/admin/login', { data: { password: 'e2e-admin-password' } })).ok()).toBeTruthy()
  // Allow the isolated production test server's Secure cookie on HTTP loopback.
  await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })))
  const created = await request.post('/api/admin/torneos', { data: {
    name: `Borrado ${game}`, slug: `borrado-${game}-${Date.now()}`, game, platform: 'pc', region: 'eu', status: 'draft',
  } })
  expect(created.ok()).toBeTruthy()
  const tournament = await created.json()
  const scope = `?tournament=${tournament.id}`
  const teams: Team[] = []
  for (const name of ['Sin logo', 'Con logo', 'En fase', 'Otro equipo']) {
    const response = await request.post(`/api/admin/equipos${scope}`, { data: { name, players: [] } })
    expect(response.ok()).toBeTruthy()
    teams.push(await response.json())
  }
  expect((await request.post(`/api/admin/fases${scope}`, { data: {
    name: 'Fase protegida', type: 'elimination', status: 'upcoming', order: 1,
    config: { bo: 1, bracketTeamIds: teams.slice(2).map(team => team.id) },
  } })).ok()).toBeTruthy()
  await page.goto(`/admin/equipos${scope}&game=${game}`)
  page.on('dialog', dialog => dialog.accept())
  const remove = async (name: string) => {
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/admin/equipos?') && response.request().method() === 'DELETE'),
      page.getByRole('button', { name: `Eliminar equipo ${name}`, exact: true }).click(),
    ])
    return response
  }
  expect((await remove('Sin logo')).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Eliminar equipo Sin logo', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: /Con logo.*0 jugadores/ }).click()
  const upload = async (name: string) => {
    await page.getByLabel(`Subir logo de ${name}`, { exact: true }).setInputFiles({
      name: 'logo.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="cyan"/></svg>'),
    })
    await expect(page.getByText('Logo guardado', { exact: true })).toBeVisible()
  }
  await upload('Con logo')
  await page.getByLabel('Nombre del equipo Con logo', { exact: true }).fill('Con logo editado')
  const [saved] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/admin/equipos?') && response.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Guardar', exact: true }).click(),
  ])
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toMatchObject({ name: 'Con logo editado', version: 3 })
  await upload('Con logo editado')
  expect((await remove('Con logo editado')).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Eliminar equipo Con logo editado', exact: true })).toHaveCount(0)

  expect((await remove('En fase')).status()).toBe(409)
  await expect(page.getByText(/No se puede eliminar un equipo que está referenciado/)).toBeVisible()
  await page.reload()
  const remaining: Team[] = await (await request.get(`/api/admin/equipos${scope}`)).json()
  expect(remaining.map(team => team.id).sort()).toEqual(teams.slice(2).map(team => team.id).sort())
  await expect(page.getByRole('button', { name: 'Eliminar equipo Con logo', exact: true })).toHaveCount(0)
})
