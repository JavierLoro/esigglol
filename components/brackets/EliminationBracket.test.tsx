import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EliminationBracket from './EliminationBracket'
import type { Match, Team } from '@/lib/types'

const teams: Team[] = ['A', 'B', 'C', 'D'].map(id => ({
  id,
  name: `Team ${id}`,
  logo: '',
  players: [],
}))

function match(id: string, bracketPosition: number, team1Id: string, team2Id: string): Match {
  return {
    id,
    phaseId: 'phase-1',
    round: 1,
    bracketPosition,
    team1Id,
    team2Id,
    result: null,
    riotMatchIds: [],
  }
}

describe('EliminationBracket', () => {
  it('renderiza según bracketPosition aunque el ID y el array estén desordenados', () => {
    const html = renderToStaticMarkup(
      <EliminationBracket
        matches={[
          match('aaa-random', 1, 'C', 'D'),
          match('zzz-random', 0, 'A', 'B'),
        ]}
        teams={teams}
      />,
    )

    expect(html.indexOf('Team A')).toBeLessThan(html.indexOf('Team C'))
    expect(html.indexOf('/partidos/zzz-random')).toBeLessThan(html.indexOf('/partidos/aaa-random'))
  })
})
