import { expect, test } from '@playwright/test'

test('keeps an explicit admin edition across sections and makes archives read only', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByPlaceholder('Contraseña').fill('e2e-admin-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=legacy-lol&game=lol$/)

  const response = await page.request.post('/api/admin/torneos', {
    data: { name: 'Valorant auditoría', slug: `valorant-audit-${Date.now()}`, game: 'valorant', platform: 'pc', region: 'eu', status: 'draft' },
  })
  expect(response.ok()).toBe(true)
  const tournament = await response.json() as { id: string; name: string; slug: string; game: 'valorant'; platform: 'pc'; region: 'eu'; status: 'draft' | 'archived' }
  const team = await page.request.post(`/api/admin/equipos?tournament=${tournament.id}`, { data: { name: 'Equipo auditoría', players: [] } })
  expect(team.ok()).toBe(true)

  await page.goto('/admin?game=valorant')
  await expect.poll(() => new URL(page.url()).searchParams.get('tournament')).toBe(tournament.id)
  expect(new URL(page.url()).searchParams.get('game')).toBe('valorant')
  await page.goto('/admin?tournament=legacy-lol&game=lol')
  await page.getByLabel('Edición activa').selectOption(tournament.id)
  await expect(page).toHaveURL(new RegExp(`/admin[?]tournament=${tournament.id}&game=valorant$`))
  await expect(page.getByRole('heading', { name: `Dashboard · ${tournament.name}` })).toBeVisible()

  await page.getByRole('link', { name: 'Torneos' }).click()
  await expect(page.getByLabel('Edición activa')).toHaveCount(0)
  await page.getByRole('link', { name: 'Apariencia' }).click()
  await expect(page.getByLabel('Edición activa')).toHaveCount(0)
  await page.getByRole('link', { name: 'Equipos' }).click()
  await expect(page).toHaveURL(new RegExp(`tournament=${tournament.id}`))

  await page.goto('/admin?game=valorant')
  await expect(page).toHaveURL(new RegExp(`tournament=${tournament.id}`))
  await expect(page.getByRole('heading', { name: `Dashboard · ${tournament.name}` })).toBeVisible()
  await page.goto('/admin/equipos?tournament=unknown&game=valorant')
  await expect(page.getByText('Torneo no encontrado. Selecciona uno desde Torneos.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Añadir equipo' })).toHaveCount(0)

  const archive = await page.request.post('/api/admin/torneos', { data: { ...tournament, status: 'archived' } })
  expect(archive.ok()).toBe(true)
  await page.goto(`/admin/equipos?tournament=${tournament.id}&game=valorant`)
  await expect(page.getByText('Este torneo está archivado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Añadir equipo' })).toBeDisabled()
  await page.getByRole('button', { name: /Equipo auditoría.*jugadores/ }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre del equipo Equipo auditoría' })).toBeDisabled()

  await page.setViewportSize({ width: 390, height: 844 })
  for (const label of ['Fases', 'Partidos', 'Salir']) {
    await expect(page.getByRole('navigation', { name: 'Administración móvil' }).getByText(label)).toBeVisible()
  }
  const reopenAsDraft = await page.request.post('/api/admin/torneos', { data: tournament })
  expect(reopenAsDraft.ok()).toBe(true)
})
