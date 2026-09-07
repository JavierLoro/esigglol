import { describe, expect, it } from 'vitest'
import { validateMatch, validateTeams } from '../domain-validation'
import type { Match, Phase, Team } from '../types'

const phase: Phase = { id: 'phase-1', name: 'Fase', type: 'groups', status: 'active', order: 0, config: { bo: 1 } }
const teams: Team[] = [
  { id: 'team-1', name: 'Alpha', logo: '', players: [{ id: 'p-1', summonerName: 'One#EUW', primaryRole: 'Top' }] },
  { id: 'team-2', name: 'Beta', logo: '', players: [{ id: 'p-2', summonerName: 'Two#EUW', primaryRole: 'Mid' }] },
]
const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1', phaseId: 'phase-1', round: 1, team1Id: 'team-1', team2Id: 'team-2', result: null, riotMatchIds: [], ...overrides,
})

describe('validación de invariantes de dominio', () => {
  it('rechaza equipos con nombres o jugadores repetidos', () => {
    const duplicate: Team = { ...teams[0], id: 'team-3', players: [{ ...teams[0].players[0] }] }
    expect(validateTeams([...teams, { ...duplicate, name: ' alpha ' }])).toHaveLength(1)
    expect(validateTeams([{ ...teams[0], players: [teams[0].players[0], { ...teams[0].players[0], id: 'p-3' }] }])).toHaveLength(1)
  })

  it('requiere fase y equipos existentes, excepto slots TBD', () => {
    expect(validateMatch(match({ phaseId: 'missing' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['phaseId'] })]))
    expect(validateMatch(match({ team2Id: 'missing' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['team2Id'] })]))
    expect(validateMatch(match({ team1Id: 'TBD', team2Id: 'TBD' }), teams, [phase])).toHaveLength(0)
  })

  it('mantiene resultado y ganador consistentes y no permite empates', () => {
    expect(validateMatch(match({ result: { team1Score: 1, team2Score: 1 }, winnerId: 'team-1' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['result'] })]))
    expect(validateMatch(match({ result: { team1Score: 2, team2Score: 1 }, winnerId: 'team-2' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['winnerId'] })]))
    expect(validateMatch(match({ result: { team1Score: 1, team2Score: 0 }, winnerId: 'team-1' }), teams, [phase])).toHaveLength(0)
    expect(validateMatch(match({ result: null, winnerId: 'team-1' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['winnerId'] })]))
  })
})
