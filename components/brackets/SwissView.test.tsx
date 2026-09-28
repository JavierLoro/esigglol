import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import SwissView from './SwissView'
import type { Match, Phase, Team } from '@/lib/types'

it('comparte el cuadro suizo con emisión y solo clasifica series finalizadas', () => {
  const teams: Team[] = ['A', 'B'].map(id => ({ id, name: `Equipo ${id}`, logo: '', players: [] }))
  const phase: Phase = { id: 'swiss', name: 'Suizo', type: 'swiss', status: 'active', order: 0, config: { bo: 3, swissTeamIds: ['A', 'B'], advanceWins: 1, eliminateLosses: 1, confirmedRounds: [1] } }
  const match: Match = { id: 'first', phaseId: phase.id, round: 1, team1Id: 'A', team2Id: 'B', result: { team1Score: 1, team2Score: 0 }, riotMatchIds: [] }
  const render = (item: Match) => renderToStaticMarkup(<SwissView fit phase={phase} teams={teams} matches={[item]} renderMatch={m => <article data-match-id={m.id}>Tarjeta OBS</article>} />)
  const partial = render(match)
  expect(partial).toContain('data-record="0-0"')
  expect(partial).toContain('data-match-id="first"')
  expect(partial).toContain('<foreignObject')
  expect(partial).toContain('viewBox="0 0 676 ')
  expect(partial).not.toContain('<a ')
  expect(partial.split('data-exit="advance"')[1]).not.toContain('Equipo A')
  const finished = render({ ...match, result: { team1Score: 2, team2Score: 0 }, winnerId: 'A' })
  expect(finished.split('data-exit="advance"')[1]).toContain('Equipo A')
  expect(finished.split('data-exit="eliminate"')[1]).toContain('Equipo B')
})
