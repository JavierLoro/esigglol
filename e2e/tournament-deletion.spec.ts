import { expect, test } from '@playwright/test'
import type { Tournament } from '../lib/types'

for (const game of ['lol', 'valorant'] as const) test(`${game}: confirma el borrado del torneo y conserva las otras ediciones`, async ({ page, context }) => {
  const request = page.request
  expect((await request.delete('/api/admin/torneos', { data: { id: 'legacy-lol' } })).status()).toBe(401)
  expect((await request.post('/api/admin/login', { data: { password: 'e2e-admin-password' } })).ok()).toBeTruthy()
  // The production test server runs on HTTP loopback.
  await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })))
  const before: Tournament[] = await (await request.get('/api/admin/torneos')).json()
  const created = await request.post('/api/admin/torneos', { data: {
    name: `Borrar ${game} ${Date.now()}`, slug: `delete-${game}-${Date.now()}`, game, platform: 'pc', region: 'eu', status: 'draft',
  } })
  expect(created.ok()).toBeTruthy()
  const tournament: Tournament = await created.json()
  expect((await request.post(`/api/admin/equipos?tournament=${tournament.id}`, { data: { name: 'Equipo del torneo', players: [] } })).ok()).toBeTruthy()
  expect((await request.post('/api/admin/torneos', { data: { ...tournament, status: game === 'lol' ? 'published' : 'archived' } })).ok()).toBeTruthy()
  await page.goto(`/admin/equipos?tournament=${tournament.id}&game=${game}`)
  await expect(page.getByLabel('Edición activa')).toHaveValue(tournament.id)
  await page.getByRole('navigation', { name: 'Administración', exact: true }).getByRole('link', { name: 'Torneos', exact: true }).click()
  const remove = page.getByRole('button', { name: `Eliminar torneo ${tournament.name}`, exact: true })
  page.once('dialog', dialog => dialog.dismiss())
  await remove.click()
  await expect(remove).toBeVisible()
  expect((await (await request.get('/api/admin/torneos')).json() as Tournament[]).some(item => item.id === tournament.id)).toBe(true)

  await page.route('**/api/admin/torneos', route => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Fallo simulado' }) })
    : route.continue())
  page.once('dialog', dialog => dialog.accept())
  await remove.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Fallo simulado' })).toBeVisible()
  await expect(remove).toBeEnabled()
  await page.unroute('**/api/admin/torneos')

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain(tournament.name)
    expect(dialog.message()).toContain('no se puede deshacer')
    await dialog.accept()
  })
  await remove.click()
  await expect(page.getByRole('status')).toHaveText(`Torneo «${tournament.name}» eliminado`)
  await expect(remove).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true }).getByRole('link', { name: 'Dashboard', exact: true })).not.toHaveAttribute('href', new RegExp(tournament.id))
  expect(await page.evaluate(() => sessionStorage.getItem('adminTournamentId'))).toBeNull()
  expect(await (await request.get('/api/admin/torneos')).json()).toEqual(before)
  expect((await request.get(`/api/data/equipos?tournament=${tournament.id}`)).status()).toBe(404)
  expect((await request.get(`/api/admin/equipos?tournament=${tournament.id}`)).status()).toBe(404)
  await page.reload()
  await expect(remove).toHaveCount(0)
})
