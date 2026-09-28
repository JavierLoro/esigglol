import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import type { Match, Phase, Team, Tournament } from '../lib/types'
import { overlayDetailLabels } from '../lib/overlay'
import { getEffectiveBO } from '../lib/match-validation'

const fullVisibility = Object.fromEntries(Object.entries(overlayDetailLabels).map(([view, labels]) => [view, Object.fromEntries(Object.keys(labels).map(key => [key, true]))]))

test('OBS: tournament color, explicit save, fixed sources and reset', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('/admin/login')
  await page.getByPlaceholder('Contraseña').fill('e2e-admin-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=/, { timeout: 15_000 })
  const request = page.request
  const a = await seed(request, 'lol'), b = await seed(request, 'valorant')
  for (const edition of [a, b]) expect((await request.put(`/api/admin/overlay${edition.scope}`, { data: { matchId: edition.matches[0].id, visibility: fullVisibility } })).ok()).toBeTruthy()
  const paths = ['marcador', 'previa', 'fase'].map(view => `/overlay/torneos/${a.tournament.id}/${view}`)
  paths.push(`/overlay/partidos/${a.matches[0].id}`, `/overlay/fases/${a.phases[0].id}`, `/overlay/torneos/${b.tournament.id}/fase`)
  const sources: Page[] = []
  for (const path of paths) {
    const source = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await source.clock.install()
    await source.clock.pauseAt(new Date())
    await source.goto(path)
    await source.evaluate(() => { Object.assign(window, { colorMount: 'preserved' }) })
    await expect(source.locator('.obs-viewport')).toHaveCSS('--obs-accent', '#ff5f98')
    sources.push(source)
  }
  const geometry = await sources[0].locator('.obs-scoreboard').boundingBox()
  await page.goto(`/admin/overlay${a.scope}&game=lol`)
  await expect(page.getByLabel('Color de los overlays')).toHaveValue('#ff5f98')
  for (const color of ['#51d9f5', '#22c55e']) {
    await page.getByLabel('Color de los overlays').fill(color)
    expect((await (await request.get(`/api/admin/overlay${a.scope}`)).json()).accentColor).not.toBe(color)
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    for (const [i, source] of sources.slice(0, 5).entries()) {
      await refresh(source)
      await expect(source.locator('.obs-viewport')).toHaveCSS('--obs-accent', color)
      expect(new URL(source.url()).pathname).toBe(paths[i])
      expect(await source.evaluate(() => Reflect.get(window, 'colorMount'))).toBe('preserved')
    }
    expect(await sources[0].locator('.obs-scoreboard').boundingBox()).toEqual(geometry)
    await expect(sources[0].locator('.obs-score-value').first()).toHaveCSS('color', color === '#51d9f5' ? 'rgb(81, 217, 245)' : 'rgb(34, 197, 94)')
    await expect(sources[2].locator('.obs-path-first').first()).toHaveCSS('border-top-color', 'rgb(81, 217, 245)')
    await expect(sources[2].locator('.obs-path-second').last()).toHaveCSS('border-top-color', 'rgb(255, 194, 102)')
    await page.reload()
    await expect(page.getByLabel('Color de los overlays')).toHaveValue(color)
  }
  await expect(sources[5].locator('.obs-viewport')).toHaveCSS('--obs-accent', '#ff5f98')
  expect((await request.put(`/api/admin/overlay${b.scope}`, { data: { matchId: b.matches[0].id, accentColor: '#a78bfa' } })).ok()).toBeTruthy()
  await refresh(sources[5])
  await expect(sources[5].locator('.obs-viewport')).toHaveCSS('--obs-accent', '#a78bfa')
  await expect(sources[0].locator('.obs-viewport')).toHaveCSS('--obs-accent', '#22c55e')
  await page.screenshot({ path: testInfo.outputPath('color-admin.png'), fullPage: true })
  for (const [i, view] of ['marcador', 'previa', 'fase'].entries()) {
    await checkCanvas(sources[i])
    await sources[i].screenshot({ path: testInfo.outputPath(`color-${view}-1920.png`), omitBackground: true })
  }
  await page.getByRole('button', { name: 'Restablecer rosa' }).click()
  await expect(page.getByLabel('Color de los overlays')).toHaveValue('#ff5f98')
  expect((await (await request.get(`/api/admin/overlay${a.scope}`)).json()).accentColor).toBe('#22c55e')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('status')).toContainText('Configuración guardada')
  for (const source of sources.slice(0, 5)) {
    await refresh(source)
    await expect(source.locator('.obs-viewport')).toHaveCSS('--obs-accent', '#ff5f98')
  }
  expect((await (await request.get(`/api/admin/overlay${a.scope}`)).json()).accentColor).toBeUndefined()
  await expect(sources[5].locator('.obs-viewport')).toHaveCSS('--obs-accent', '#a78bfa')
  for (const source of sources) await source.close()
})

test('OBS: complete Swiss and distinct team borders across all phase formats', async ({ page, browser }, testInfo) => {
  test.setTimeout(300_000)
  await page.goto('/admin/login')
  await page.getByPlaceholder('Contraseña').fill('e2e-admin-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=/, { timeout: 15_000 })
  const request = page.request
  for (const game of ['lol', 'valorant'] as const) {
    const { tournament, scope, phases } = await seed(request, game)
    const getMatches = async (): Promise<Match[]> => (await request.get(`/api/admin/partidos${scope}`)).json()
    const finish = async (id: string, phase: Phase) => {
      const match = (await getMatches()).find(m => m.id === id)!
      const response = await request.put(`/api/admin/partidos${scope}`, { data: { ...match, result: { team1Score: Math.ceil(getEffectiveBO(phase, match.round) / 2), team2Score: 0 }, winnerId: match.team1Id } })
      expect(response.ok(), await response.text()).toBeTruthy()
    }
    const source = await browser.newPage()
    await source.clock.install()
    await source.clock.pauseAt(new Date())
    await source.goto(`/overlay/torneos/${tournament.id}/fase`)
    for (const phase of phases) {
      const matches = (await getMatches()).filter(m => m.phaseId === phase.id)
      let focus: Match
      if (phase.type === 'groups') {
        const team = phase.config.groups![0].teamIds[0]
        const fixtures = matches.filter(m => m.team1Id === team)
        focus = fixtures.at(-1)!
        for (const match of fixtures.slice(0, -1)) await finish(match.id, phase)
      } else {
        for (const match of matches.filter(m => m.round === 1)) await finish(match.id, phase)
        if (phase.type === 'swiss' || phase.type === 'elimination') {
          expect((await request.post(`/api/admin/fases/generate${scope}`, { data: { phaseId: phase.id, round: 2 } })).ok()).toBeTruthy()
        }
        if (phase.type === 'swiss') {
          for (let round = 2; round <= 5; round++) {
            if (round > 2) {
              for (const match of (await getMatches()).filter(m => m.phaseId === phase.id && m.round === round - 1)) await finish(match.id, phase)
              expect((await request.post(`/api/admin/fases/generate${scope}`, { data: { phaseId: phase.id, round } })).ok()).toBeTruthy()
            }
            const current: Phase = (await (await request.get(`/api/admin/fases${scope}`)).json()).find((p: Phase) => p.id === phase.id)
            expect((await request.put(`/api/admin/fases${scope}`, { data: { ...current, config: { ...current.config, confirmedRounds: Array.from({ length: round }, (_, i) => i + 1) } } })).ok()).toBeTruthy()
          }
        }
        focus = (await getMatches()).find(m => m.phaseId === phase.id && m.round === (phase.type === 'upper-lower' ? -1 : phase.type === 'final-four' ? 98 : 2))!
      }
      expect((await request.put(`/api/admin/overlay${scope}`, { data: { matchId: focus.id, visibility: { ...fullVisibility, fase: { ...fullVisibility.fase, history: false } } } })).ok()).toBeTruthy()
      await page.goto(`/admin/overlay${scope}&game=${game}`)
      await page.getByLabel('Resaltar recorrido de los dos equipos').check()
      await page.getByRole('button', { name: 'Guardar configuración' }).click()
      await expect(page.getByRole('status')).toContainText('Configuración guardada')
      await refresh(source)
      await expect(source.locator('.obs-path-legend')).toBeVisible()
      const visibleIds = await source.locator('.obs-match').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-match-id')))
      const currentMatches = (await getMatches()).filter(m => m.phaseId === phase.id)
      for (const match of currentMatches.filter(m => visibleIds.includes(m.id))) {
        const card = source.locator(`[data-match-id="${match.id}"]`)
        const first = match.team1Id === focus.team1Id || match.team2Id === focus.team1Id
        const second = match.team1Id === focus.team2Id || match.team2Id === focus.team2Id
        expect(await card.evaluate(el => el.classList.contains('obs-path-first'))).toBe(first)
        expect(await card.evaluate(el => el.classList.contains('obs-path-second'))).toBe(second)
        if (first && !second) await expect(card).toHaveCSS('border-top-style', 'solid')
        if (second && !first) await expect(card).toHaveCSS('border-top-style', 'dashed')
        if (first && second) await expect(card).toHaveCSS('outline-style', 'dashed')
      }
      if (phase.type === 'swiss') {
        expect(visibleIds).toHaveLength(currentMatches.length)
        await expect(source.locator('.swiss-column[data-round]')).toHaveCount(5)
        await expect(source.locator('.swiss-pool[data-record="0-0"]')).toBeVisible()
        await expect(source.locator('.swiss-pool[data-record="1-0"]')).toBeVisible()
        await expect(source.locator('.swiss-pool[data-record="0-1"]')).toBeVisible()
        await expect(source.locator('.swiss-exit[data-exit="advance"]').first()).toBeVisible()
        await expect(source.locator('.swiss-exit[data-exit="eliminate"]').first()).toBeVisible()
        await expect(source.locator('.obs-standings')).toHaveCount(0)
        await expect(source.locator('.obs-phase-label')).toContainText('Todas las rondas')
      }
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
        await source.setViewportSize(size)
        await checkCanvas(source)
        expect(await source.locator('.obs-column, .swiss-column').evaluateAll(columns => columns.every(column => Array.from(column.querySelectorAll('.obs-match')).every(card => card.getBoundingClientRect().bottom <= column.getBoundingClientRect().bottom + 1)))).toBe(true)
        await source.screenshot({ path: testInfo.outputPath(`${game}-paths-${phase.type}-${size.width}.png`), omitBackground: true })
      }
      await page.getByLabel('Resaltar recorrido de los dos equipos').uncheck()
      await page.getByRole('button', { name: 'Guardar configuración' }).click()
      await expect(page.getByRole('status')).toContainText('Configuración guardada')
      await refresh(source)
      await expect(source.locator('.obs-path-legend, .obs-path-first, .obs-path-second')).toHaveCount(0)
      expect(await source.locator('.obs-match').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-match-id')))).toEqual(visibleIds)
    }
    await source.close()
  }
})

async function seed(request: APIRequestContext, game: 'lol' | 'valorant') {
  const response = await request.post('/api/admin/torneos', { data: { name: `Copa OBS · ${game === 'lol' ? 'League of Legends' : 'Valorant'}`, slug: `obs-${game}-${Date.now()}`, game, status: 'published', platform: 'pc', region: 'eu' } })
  expect(response.ok()).toBeTruthy()
  const tournament: Tournament = await response.json()
  const scope = `?tournament=${tournament.id}`
  const teams: Team[] = []
  for (let i = 0; i < 16; i++) {
    const response = await request.post(`/api/admin/equipos${scope}`, { data: { name: i === 0 ? 'Poderosos Patanes' : i === 1 ? 'Academia Universitaria de Leyendas del Mediterráneo' : `Equipo ${String(i + 1).padStart(2, '0')}`, logo: i === 0 ? '/logos/logos/PODEROSOS_PATANES.png' : i === 2 ? '/logos/logos/MECHAPATO.png' : '', players: [] } })
    expect(response.ok()).toBeTruthy()
    teams.push(await response.json())
  }
  const ids = teams.map(t => t.id)
  const phases: Phase[] = []
  for (const type of ['groups', 'swiss', 'elimination', 'final-four', 'upper-lower'] as const) {
    const config = type === 'groups' ? { bo: 3, advanceCount: 2, groups: [{ id: 'A', teamIds: ids.slice(0, 10) }, { id: 'B', teamIds: ids.slice(10) }] }
      : type === 'swiss' ? { bo: 1, swissSize: 16, swissTeamIds: ids, advanceWins: 3, eliminateLosses: 3, rounds: 5, confirmedRounds: [1], roundBo: { '1': 3 } }
      : { bo: 3, bracketTeamIds: type === 'final-four' ? ids.slice(0, 4) : ids, confirmedBracket: true, include3rdPlace: true, roundBo: { '2': 5, '99': 5 } }
    const response = await request.post(`/api/admin/fases${scope}`, { data: { name: `Fase ${type}`, type, order: phases.length, status: 'upcoming', config } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const phase: Phase = await response.json()
    phases.push(phase)
    expect((await request.post(`/api/admin/fases/generate${scope}`, { data: { phaseId: phase.id } })).ok()).toBeTruthy()
  }
  const matches: Match[] = await (await request.get(`/api/admin/partidos${scope}`)).json()
  expect((await request.post('/api/admin/torneos', { data: { ...tournament, status: 'published' } })).ok()).toBeTruthy()
  return { tournament, scope, teams, phases, matches }
}

async function refresh(page: Page) {
  const response = page.waitForResponse(r => r.url().includes('_rsc=') && r.status() === 200, { timeout: 15_000 })
  await page.clock.fastForward(30_000)
  await response
}

async function checkCanvas(page: Page) {
  await expect(page.locator('.obs-canvas')).toBeVisible()
  expect(await page.evaluate(() => ({
    width: document.documentElement.scrollWidth <= innerWidth,
    height: document.documentElement.scrollHeight <= innerHeight,
    transparent: getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)',
  }))).toEqual({ width: true, height: true, transparent: true })
  for (const selector of ['html', 'body', '.obs-viewport', '.obs-canvas']) {
    await expect(page.locator(selector)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.locator(selector)).toHaveCSS('background-image', 'none')
  }
  expect(await page.locator('.obs-score-team, .obs-header:visible, .obs-phase-label:visible, .obs-versus > .obs-team, .obs-versus-center, .obs-neutral:visible, .obs-standings, .obs-match, .obs-maps:visible > div').evaluateAll(panels => panels.every(panel => {
    const style = getComputedStyle(panel)
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none'
  }))).toBe(true)
  await expect(page.locator('.obs-canvas button, .obs-canvas a, .obs-canvas input')).toHaveCount(0)
  const overview = await page.locator('.obs-overview').count() > 0
  if (overview) {
    await expect(page.locator('.obs-fit-board')).toBeVisible()
    expect(await page.locator('.obs-fit-frame').evaluate(frame => {
      const bounds = frame.getBoundingClientRect()
      return Array.from(frame.querySelectorAll('.swiss-pool, .swiss-exit, .obs-match')).every(node => {
        const box = node.getBoundingClientRect()
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1
      })
    })).toBe(true)
  }
  for (const column of await page.locator('.obs-column').all()) {
    expect(await column.locator('.obs-match').count()).toBeLessThanOrEqual(overview ? 8 : 4)
    expect(await column.locator('.obs-standing:not(.obs-table-head)').count()).toBeLessThanOrEqual(12)
  }
  expect(await page.locator('.obs-column').count()).toBeLessThanOrEqual(overview ? 5 : 3)
}

test('OBS: permanent sources, isolation, publication, pagination and visual matrix', async ({ page, browser, request: anonymous }, testInfo) => {
  test.setTimeout(300_000)
  await page.goto('/admin/login')
  await page.getByPlaceholder('Contraseña').fill('e2e-admin-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\?tournament=/, { timeout: 15_000 })
  const request = page.request
  const editions = [await seed(request, 'lol'), await seed(request, 'valorant')]
  const sources: { tournament: Tournament; views: Record<string, Page> }[] = []

  for (const edition of editions) {
    const { tournament, scope, phases, matches } = edition
    expect((await anonymous.get(`/api/admin/overlay${scope}`)).status()).toBe(401)
    expect((await anonymous.put(`/api/admin/overlay${scope}`, { data: { matchId: null } })).status()).toBe(401)
    const views: Record<string, Page> = {}
    for (const view of ['marcador', 'previa', 'fase']) {
      const source = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
      await source.clock.install()
      await source.clock.pauseAt(new Date())
      await source.goto(`/overlay/torneos/${tournament.id}/${view}`)
      await source.evaluate(() => { Object.assign(window, { obsMount: 'preserved' }) })
      await checkCanvas(source)
      if (view === 'marcador') await expect(source.locator('.obs-scoreboard')).toHaveCount(0)
      else await expect(source.getByText('Sin contenido seleccionado')).toBeHidden()
      views[view] = source
    }
    sources.push({ tournament, views })
    const groupMatches = matches.filter(m => m.phaseId === phases[0].id)
    const first = groupMatches[0]
    const second = groupMatches[12]
    await page.goto(`/admin/overlay${scope}&game=${tournament.game}`)
    // LAN HTTP has no Clipboard API. Verify the native fallback copies the URL.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
      document.addEventListener('copy', () => {
        const input = document.activeElement
        if (input instanceof HTMLTextAreaElement) document.documentElement.dataset.copiedUrl = input.value.slice(input.selectionStart, input.selectionEnd)
      }, { once: true })
    })
    await page.getByRole('button', { name: 'Copiar URL de marcador', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('URL copiada')
    await expect(page.locator('html')).toHaveAttribute('data-copied-url', new URL(`/overlay/torneos/${tournament.id}/marcador`, page.url()).href)
    await expect(page.getByRole('button', { name: 'Copiar URL de marcador', exact: true })).toBeFocused()
    await expect(page.locator('textarea')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Emisión / OBS' })).toBeVisible()
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(4)
    await expect(page.getByLabel('Resaltar recorrido de los dos equipos')).toBeChecked()
    for (const checkbox of await page.getByLabel('Logos', { exact: true }).all()) await expect(checkbox).toBeChecked()
    await page.getByLabel('Partido de emisión').selectOption(first.id)
    expect((await (await request.get(`/api/admin/overlay${scope}`)).json()).matchId).toBeNull()
    for (const preset of await page.getByRole('button', { name: 'Mostrar todos los detalles' }).all()) await preset.click()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await page.screenshot({ path: testInfo.outputPath(`${tournament.game}-admin.png`), fullPage: true })
    for (const view of ['marcador', 'previa', 'fase']) await expect(page.locator(`a[href="/overlay/torneos/${tournament.id}/${view}"]`)).toHaveAttribute('target', '_blank')
    const popupReady = page.waitForEvent('popup')
    await page.getByRole('link', { name: 'Previsualizar marcador', exact: true }).click()
    const popup = await popupReady
    await expect(popup.locator('.obs-scoreboard')).toBeVisible()
    await popup.close()
    for (const [view, source] of Object.entries(views)) {
      await refresh(source)
      await expect(source.locator('.obs-canvas')).toContainText('Poderosos Patanes')
      await source.screenshot({ path: testInfo.outputPath(`${tournament.game}-${view}-pending-1920.png`), omitBackground: true })
    }
    await expect(views.previa.getByText('BO3', { exact: true })).toBeVisible()
    await expect(views.previa.locator('.obs-versus-center .obs-eyebrow')).toBeHidden()
    await expect(views.previa.locator('.obs-versus-center > strong')).toHaveText('VS')
    await expect(views.previa.locator('time')).toHaveCount(0)
    const stable = await views.marcador.locator('.obs-scoreboard').boundingBox()
    const updated = await request.put(`/api/admin/partidos${scope}`, { data: { ...first, result: { team1Score: 2, team2Score: 0 }, winnerId: first.team1Id, scheduledAt: '2026-10-01T18:00:00Z', ...(tournament.game === 'valorant' ? { maps: [{ map: 'Ascent', team1Rounds: 13, team2Rounds: 7 }, { map: 'Haven', team1Rounds: 14, team2Rounds: 12 }] } : {}) } })
    expect(updated.ok(), await updated.text()).toBeTruthy()
    for (const source of Object.values(views)) await refresh(source)
    await expect(views.previa.getByText('Resultado final')).toBeVisible()
    await expect(views.previa.getByText('2 : 0', { exact: true })).toBeVisible()
    if (tournament.game === 'valorant') {
      await expect(views.previa.getByText('Ascent')).toBeVisible()
      await expect(views.previa.getByText('14 : 12', { exact: true })).toBeVisible()
    }
    expect(await views.marcador.locator('.obs-scoreboard').boundingBox()).toEqual(stable)
    for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
      for (const view of ['previa', 'marcador']) {
        await views[view].setViewportSize(size)
        await checkCanvas(views[view])
        await views[view].screenshot({ path: testInfo.outputPath(`${tournament.game}-${view}-final-${size.width}.png`), omitBackground: true })
      }
    }

    // Presets and individual checkboxes preserve essential geometry and apply only after saving.
    const essentialSelectors = { marcador: '.obs-score-team', previa: '.obs-versus > .obs-team, .obs-versus-center > strong', fase: '.obs-standing, .obs-match' }
    const geometry: Record<string, unknown> = {}
    for (const [view, source] of Object.entries(views)) geometry[view] = await source.locator(essentialSelectors[view as keyof typeof essentialSelectors]).evaluateAll(elements => elements.map(el => { const { x, y, width, height } = el.getBoundingClientRect(); return { x, y, width, height } }))
    for (const preset of await page.getByRole('button', { name: 'Solo lo esencial' }).all()) await preset.click()
    await expect(views.previa.locator('.obs-header')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    for (const [view, source] of Object.entries(views)) {
      await refresh(source)
      expect(await source.locator(essentialSelectors[view as keyof typeof essentialSelectors]).evaluateAll(elements => elements.map(el => { const { x, y, width, height } = el.getBoundingClientRect(); return { x, y, width, height } }))).toEqual(geometry[view])
      expect(await source.locator('.obs-logo:visible').count()).toBeGreaterThan(0)
      await expect(source.locator('.obs-header:visible, .obs-phase-label:visible, .obs-footer:visible, .obs-score-context:visible')).toHaveCount(0)
      await expect(source.locator('.obs-canvas')).toContainText('Poderosos Patanes')
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
        await source.setViewportSize(size)
        await checkCanvas(source)
        await source.screenshot({ path: testInfo.outputPath(`${tournament.game}-${view}-minimal-${size.width}.png`), omitBackground: true })
      }
    }
    const previaControls = page.getByRole('group', { name: 'Previa', exact: true })
    await previaControls.getByLabel('Logos', { exact: true }).uncheck()
    await previaControls.getByLabel('Nombre del torneo', { exact: true }).check()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.previa)
    await expect(views.previa.locator('.obs-header h1')).toBeVisible()
    await expect(views.previa.locator('.obs-logo:visible')).toHaveCount(0)
    await expect(views.marcador.locator('.obs-logo:visible')).toHaveCount(2)
    await expect(views.fase.locator('.obs-header')).toBeHidden()
    await expect(views.marcador.locator('.obs-score-context')).toBeHidden()
    await page.reload()
    await expect(previaControls.getByLabel('Nombre del torneo', { exact: true })).toBeChecked()
    const fixed = await browser.newPage()
    await fixed.goto(`/overlay/partidos/${first.id}`)
    await expect(fixed.locator('.obs-header h1')).toBeVisible()
    await expect(fixed.locator('.obs-logo:visible')).toHaveCount(0)
    await fixed.close()
    for (const preset of await page.getByRole('button', { name: 'Mostrar todos los detalles' }).all()) await preset.click()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    for (const source of Object.values(views)) await refresh(source)

    await page.getByLabel('Partido de emisión').selectOption(second.id)
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    for (const source of Object.values(views)) await refresh(source)
    await expect(views.fase.locator(`[data-match-id="${second.id}"]`)).toBeVisible()
    await expect(views.fase.getByText(/Página 2 \//)).toBeVisible()
    await expect(views.fase.locator('.obs-standing:not(.obs-table-head)')).toHaveCount(10)
    await expect(views.fase.locator('.obs-standings').getByText('Poderosos Patanes')).toBeVisible()
    await expect(views.fase.locator('.obs-standings').getByText('Equipo 10')).toBeVisible()
    await views.fase.screenshot({ path: testInfo.outputPath(`${tournament.game}-auto-page-2.png`), omitBackground: true })
    await expect(views.previa.getByText('Resultado final')).toHaveCount(0)
    for (const [view, source] of Object.entries(views)) {
      await expect(source).toHaveURL(new RegExp(`/overlay/torneos/${tournament.id}/${view}$`))
      expect(await source.evaluate(() => Reflect.get(window, 'obsMount'))).toBe('preserved')
    }

    await page.getByRole('button', { name: 'Fijar otra fase' }).click()
    await page.getByLabel('Fase', { exact: true }).selectOption(phases[0].id)
    await page.getByLabel('Grupo / ronda').selectOption('group:B')
    await page.getByLabel('Página', { exact: true }).selectOption('2')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.fase)
    await expect(views.fase.getByText('Grupo B', { exact: true })).toBeVisible()
    await expect(views.fase.getByText('Página 2 / 2')).toBeVisible()
    await views.fase.screenshot({ path: testInfo.outputPath(`${tournament.game}-manual-page-2.png`), omitBackground: true })
    await page.getByLabel('Contenido de grupos y suizo').selectOption('standings')
    await expect(page.getByLabel('Página', { exact: true })).toHaveValue('1')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.fase)
    await expect(views.fase.locator('.obs-match')).toHaveCount(0)
    await expect(views.fase.locator('.obs-standings')).toBeVisible()
    await expect(views.fase.getByText('Página 1 / 1')).toBeVisible()
    const standingsBox = await views.fase.locator('.obs-standings').boundingBox()
    await page.getByLabel('Contenido de grupos y suizo').selectOption('both')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.fase)
    expect(await views.fase.locator('.obs-standings').boundingBox()).toEqual(standingsBox)
    const matchBox = await views.fase.locator('.obs-match').first().boundingBox()
    await page.getByLabel('Contenido de grupos y suizo').selectOption('matches')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.fase)
    await expect(views.fase.locator('.obs-standings')).toHaveCount(0)
    expect(await views.fase.locator('.obs-match').first().boundingBox()).toEqual(matchBox)
    await page.getByLabel('Contenido de grupos y suizo').selectOption('both')
    await page.getByRole('button', { name: 'Seguir al partido' }).click()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('status')).toContainText('Configuración guardada')
    await refresh(views.fase)
    await expect(views.fase.getByText('Grupo A', { exact: true })).toBeVisible()

    for (const phase of phases) {
      const match = matches.find(m => m.phaseId === phase.id)!
      expect((await request.put(`/api/admin/overlay${scope}`, { data: { matchId: match.id, visibility: fullVisibility } })).ok()).toBeTruthy()
      await refresh(views.fase)
      await expect(views.fase.locator('.obs-phase-label')).toContainText(phase.name)
      if (phase.type === 'swiss') {
        await expect(views.fase.locator('.obs-standings')).toHaveCount(0)
        await expect(views.fase.locator('.obs-match')).toHaveCount(8)
      }
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
        await views.fase.setViewportSize(size)
        await checkCanvas(views.fase)
        await views.fase.screenshot({ path: testInfo.outputPath(`${tournament.game}-${phase.type}-${size.width}.png`), omitBackground: true })
      }
      if (phase.type === 'final-four') {
        await expect(views.fase.getByText('Tercer puesto', { exact: true })).toBeVisible()
        await expect(views.fase.getByText('Por determinar').first()).toBeVisible()
      }
      if (phase.type === 'upper-lower') {
        for (const round of [-1, 99]) {
          expect((await request.put(`/api/admin/overlay${scope}`, { data: { matchId: matches.find(m => m.phaseId === phase.id && m.round === round)!.id, visibility: fullVisibility } })).ok()).toBeTruthy()
          await refresh(views.fase)
          await expect(views.fase.locator('.obs-phase-label')).toContainText(round === 99 ? 'Gran final' : 'Lower · Ronda 1')
          await checkCanvas(views.fase)
          await views.fase.screenshot({ path: testInfo.outputPath(`${tournament.game}-round-${round}-1280.png`), omitBackground: true })
        }
        await expect(views.fase.getByText('Gran final', { exact: true }).first()).toBeVisible()
        await expect(views.fase.getByText('BO5')).toBeVisible()
      }
    }

    // Withdrawing publication removes the selected match from all open sources.
    const finalFour = phases.find(p => p.type === 'final-four')!
    const finalMatch = matches.find(m => m.phaseId === finalFour.id)!
    await request.put(`/api/admin/overlay${scope}`, { data: { matchId: finalMatch.id, visibility: fullVisibility } })
    const freshPhases: Phase[] = await (await request.get(`/api/admin/fases${scope}`)).json()
    const freshPhase = freshPhases.find(p => p.id === finalFour.id)!
    expect((await request.put(`/api/admin/fases${scope}`, { data: { ...freshPhase, config: { ...freshPhase.config, confirmedBracket: false } } })).ok()).toBeTruthy()
    for (const [view, source] of Object.entries(views)) {
      await refresh(source)
      if (view === 'marcador') await expect(source.locator('.obs-scoreboard')).toHaveCount(0)
      else await expect(source.getByText('Sin contenido seleccionado')).toBeVisible()
    }
    expect((await anonymous.get(`/overlay/partidos/${finalMatch.id}`)).status()).toBe(404)
    expect((await anonymous.get(`/overlay/fases/${finalFour.id}`)).status()).toBe(404)
    expect((await request.put(`/api/admin/overlay${scope}`, { data: { matchId: finalMatch.id } })).status()).toBe(422)
    await request.put(`/api/admin/overlay${scope}`, { data: { matchId: second.id, visibility: fullVisibility } })
    await refresh(views.previa)
    await expect(views.previa.getByText('Sin contenido seleccionado')).toHaveCount(0)
    expect((await request.delete(`/api/admin/partidos${scope}`, { data: { ids: [second.id], versions: { [second.id]: second.version } } })).ok()).toBeTruthy()
    for (const [view, source] of Object.entries(views)) {
      await refresh(source)
      if (view === 'marcador') await expect(source.locator('.obs-scoreboard')).toHaveCount(0)
      else await expect(source.getByText('Sin contenido seleccionado')).toBeVisible()
    }
    await request.put(`/api/admin/overlay${scope}`, { data: { matchId: first.id, visibility: fullVisibility } })
    for (const source of Object.values(views)) await refresh(source)
    await expect(views.previa.getByText('Resultado final')).toBeVisible()
    expect((await anonymous.get(`/overlay/partidos/${first.id}`)).status()).toBe(200)
    expect((await anonymous.get(`/overlay/fases/${phases[0].id}`)).status()).toBe(200)
  }

  // The same admin selector switches editions, with independent persisted settings.
  const [a, b] = editions
  await page.getByRole('combobox', { name: 'Edición activa' }).selectOption(a.tournament.id)
  await expect(page.getByLabel('Partido de emisión')).toHaveValue(a.matches.find(m => m.phaseId === a.phases[0].id)!.id)
  await page.getByLabel('Partido de emisión').selectOption('')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('status')).toContainText('Configuración guardada')
  for (const source of Object.values(sources[0].views)) await refresh(source)
  for (const source of Object.values(sources[1].views)) await refresh(source)
  await expect(sources[0].views.previa.getByText('Sin contenido seleccionado')).toBeVisible()
  await expect(sources[1].views.previa.getByText('Resultado final')).toBeVisible()
  expect((await (await request.get(`/api/admin/overlay${b.scope}`)).json()).matchId).not.toBeNull()
  for (const status of ['draft', 'archived']) {
    await request.post('/api/admin/torneos', { data: { ...a.tournament, status } })
    for (const view of ['marcador', 'previa', 'fase']) expect((await anonymous.get(`/overlay/torneos/${a.tournament.id}/${view}`)).status()).toBe(404)
  }
  expect((await request.put(`/api/admin/overlay${a.scope}`, { data: { matchId: null } })).status()).toBe(409)
  expect((await anonymous.get('/overlay/torneos/missing/marcador')).status()).toBe(404)
  for (const { views } of sources) for (const source of Object.values(views)) await source.close()
})
