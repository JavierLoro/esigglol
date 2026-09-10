import { describe, expect, it } from 'vitest'
import { validateMatch, validateTeams } from '../domain-validation'
import type { Match, Phase, Team } from '../types'

const phase: Phase = { id: 'phase-1', name: 'Fase', type: 'groups', status: 'active', order: 0, config: { bo: 1, groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }] } }
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
    expect(validateTeams([...teams, { ...duplicate, name: ' alpha ' }])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'El nombre del equipo debe ser único' })]),
    )
    expect(validateTeams([{ ...teams[0], players: [teams[0].players[0], { ...teams[0].players[0], id: 'p-3' }] }])).toHaveLength(1)
  })

  it('rechaza Riot IDs normalizados repetidos entre equipos', () => {
    const duplicateAcrossTeams: Team = {
      ...teams[1],
      players: [{ ...teams[1].players[0], summonerName: ' one # euw ' }],
    }
    expect(validateTeams([teams[0], duplicateAcrossTeams])).toEqual([
      expect.objectContaining({ message: 'El Riot ID no puede repetirse entre equipos' }),
    ])
  })

  it('requiere fase y equipos existentes y rechaza TBD manual', () => {
    expect(validateMatch(match({ phaseId: 'missing' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['phaseId'] })]))
    expect(validateMatch(match({ team2Id: 'missing' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['team2Id'] })]))
    expect(validateMatch(match({ team1Id: 'TBD', team2Id: 'TBD' }), teams, [phase]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ path: ['team1Id'] })]))
  })

  it('mantiene resultado y ganador consistentes y no permite empates', () => {
    expect(validateMatch(match({ result: { team1Score: 1, team2Score: 1 }, winnerId: 'team-1' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['winnerId'] })]))
    expect(validateMatch(match({ result: { team1Score: 2, team2Score: 1 }, winnerId: 'team-2' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['winnerId'] })]))
    expect(validateMatch(match({ result: { team1Score: 1, team2Score: 0 }, winnerId: 'team-1' }), teams, [phase])).toHaveLength(0)
    expect(validateMatch(match({ result: null, winnerId: 'team-1' }), teams, [phase])).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['winnerId'] })]))
  })

  it('solo permite equipos participantes de la fase', () => {
    expect(validateMatch(match({ team2Id: 'team-3' }), [...teams, { id: 'team-3', name: 'Gamma', logo: '', players: [] }], [phase]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ path: ['team2Id'], message: 'El equipo no participa en esta fase' })]))
    expect(validateMatch(match({ team1Id: 'TBD', team2Id: 'TBD' }), teams, [phase], new Set(['team1Id', 'team2Id']))).toHaveLength(0)
  })

  it.each<['groups' | 'swiss' | 'elimination' | 'final-four' | 'upper-lower', Phase['config']]>([
    ['groups', { bo: 1, groups: [{ id: 'A', teamIds: ['team-1', 'team-2'] }] }],
    ['swiss', { bo: 1, swissTeamIds: ['team-1', 'team-2'] }],
    ['elimination', { bo: 1, bracketTeamIds: ['team-1', 'team-2'] }],
    ['final-four', { bo: 1, bracketTeamIds: ['team-1', 'team-2'] }],
    ['upper-lower', { bo: 1, bracketTeamIds: ['team-1', 'team-2'] }],
  ])('restringe participantes en fases %s', (type, config) => {
    const configuredPhase: Phase = { ...phase, type, config }
    const externalTeam: Team = { id: 'team-3', name: 'Gamma', logo: '', players: [] }

    expect(validateMatch(match({ team2Id: externalTeam.id }), [...teams, externalTeam], [configuredPhase]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ path: ['team2Id'], message: 'El equipo no participa en esta fase' })]))
  })
})
