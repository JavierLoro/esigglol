import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import ValorantRanking from './ValorantRanking'
vi.mock('@/lib/valorant-assets', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/valorant-assets')>()
  return { ...original, getValorantAssets: () => ({ cards: { card: { name: 'Tarjeta', icon: '/valorant/test/card.png' } }, ranks: { '27': { name: 'Radiant', icon: '/valorant/test/radiant.png' } } }) }
})
vi.mock('@/lib/valorant-ranking', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/valorant-ranking')>()
  return { ...original, loadValorantRanking: vi.fn().mockResolvedValue({
    source: 'Riot Games', availability: 'available', fetchedAt: '2026-09-25T10:00:00Z', actName: 'Acto oficial', complete: true,
    data: { actId: 'act', totalPlayers: 1, players: [{ gameName: 'Known', tagLine: 'EUW', leaderboardRank: 10, competitiveTier: 27, rankedRating: 800, numberOfWins: 0, playerCardID: 'CARD' }] },
  }) }
})

it('renders official rank and zero wins while leaving absent participants unavailable', async () => {
  const html = renderToStaticMarkup(await ValorantRanking({
    tournament: { id: 't', name: 'Copa', slug: 'copa', game: 'valorant', platform: 'pc', region: 'eu', status: 'published' },
    teams: [{ id: 'team', name: 'Equipo', logo: '/logos/test-team.png', players: [{ id: 'p', summonerName: 'Known#EUW', primaryRole: 'Flexible' }, { id: 'q', summonerName: 'Absent#EUW', primaryRole: 'Flexible' }] }],
  }))
  expect(html).toContain('>1</td>')
  expect(html).toContain('>—</td>')
  expect(html).not.toContain('Posición EU')
  expect(html).not.toContain('>10</td>')
  expect(html).toContain('Radiante')
  expect(html).toContain('/valorant/test/radiant.png')
  expect(html).not.toContain('/valorant/test/card.png')
  expect(html).toContain('/logos/test-team.png')
  expect(html).toContain('Logo de Equipo')
  expect(html).toContain('800')
  expect(html).toContain('>0</td>')
  expect(html).toContain('No disponible')
  expect(html).toContain('Riot Games')
  expect(html).toContain('Acto oficial')
  expect(html).not.toMatch(/historial|RSO|SIMULADOS/)
})
