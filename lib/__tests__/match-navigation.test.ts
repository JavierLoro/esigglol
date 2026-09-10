import { describe, expect, it } from 'vitest'
import { getPublicMatchHref } from '../match-navigation'
import type { Match, Team } from '../types'

const teams: Team[] = ['team-a', 'team-b'].map(id => ({ id, name: id, logo: '', players: [] }))
const pendingMatch: Match = {
  id: 'match-1',
  phaseId: 'phase-1',
  round: 1,
  team1Id: 'team-a',
  team2Id: 'team-b',
  result: null,
  riotMatchIds: [],
}

describe('getPublicMatchHref', () => {
  it('abre el comparador para un partido pendiente con ambos equipos confirmados', () => {
    expect(getPublicMatchHref(pendingMatch, teams)).toBe('/comparar?t1=team-a&t2=team-b')
  })

  it('abre el detalle cuando el partido ya tiene resultado', () => {
    expect(getPublicMatchHref({ ...pendingMatch, result: { team1Score: 2, team2Score: 0 } }, teams)).toBe('/partidos/match-1')
  })

  it('abre el detalle mientras falte uno de los equipos', () => {
    expect(getPublicMatchHref({ ...pendingMatch, team2Id: 'TBD' }, teams)).toBe('/partidos/match-1')
  })
})
