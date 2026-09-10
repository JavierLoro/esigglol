import { describe, expect, it } from 'vitest'
import { recalculateBracket } from '../bracket'
import type { Match, Phase, PhaseConfig } from '../types'

const phase = (type: Phase['type'], config: Partial<PhaseConfig> = {}): Phase => ({
  id: 'p', name: 'Phase', type, status: 'active', order: 0, config: { bo: 1, ...config },
})
const match = (id: string, round: number, team1Id = 'TBD', team2Id = 'TBD'): Match => ({
  id, phaseId: 'p', round, team1Id, team2Id, result: null, riotMatchIds: [],
})
const win = (match: Match, winnerId: string): Match => ({
  ...match, result: winnerId === match.team1Id ? { team1Score: 1, team2Score: 0 } : { team1Score: 0, team2Score: 1 }, winnerId,
})

describe('recalculateBracket', () => {
  it('corrige elimination e invalida una final disputada con el ganador anterior', () => {
    const matches = [
      win(match('s1', 1, 'A', 'B'), 'B'),
      { ...win(match('s2', 1, 'C', 'D'), 'C'), bracketPosition: 1 },
      win(match('f', 2, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('elimination'), matches)
    expect(result[2]).toMatchObject({ team1Id: 'B', team2Id: 'C', result: null })
    expect(result[2].winnerId).toBeUndefined()
  })

  it('limpia final y tercer puesto al retirar el resultado de una semifinal de Final Four', () => {
    const matches = [
      match('s1', 1, 'A', 'B'),
      win(match('s2', 1, 'C', 'D'), 'D'),
      win(match('f', 2, 'A', 'D'), 'A'),
      win(match('third', 98, 'B', 'C'), 'B'),
    ]
    const result = recalculateBracket(phase('final-four', { include3rdPlace: true }), matches)
    expect(result[2]).toMatchObject({ team1Id: 'TBD', team2Id: 'D', result: null })
    expect(result[3]).toMatchObject({ team1Id: 'TBD', team2Id: 'C', result: null })
  })

  it('recalcula ambas ramas de Upper/Lower cuando cambia un ganador inicial', () => {
    const matches = [
      win(match('u1', 1, 'A', 'B'), 'B'),
      win(match('u2', 1, 'C', 'D'), 'C'),
      win(match('uf', 2, 'A', 'C'), 'A'),
      win(match('l1', -1, 'B', 'D'), 'B'),
      win(match('lf', -2, 'C', 'B'), 'C'),
      win(match('gf', 99, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('upper-lower', { bracketTeamIds: ['A', 'B', 'C', 'D'] }), matches)
    expect(result[2]).toMatchObject({ team1Id: 'B', team2Id: 'C', result: null })
    expect(result[3]).toMatchObject({ team1Id: 'A', team2Id: 'D', result: null })
    expect(result[4]).toMatchObject({ team1Id: 'TBD', team2Id: 'TBD', result: null })
    expect(result[5]).toMatchObject({ team1Id: 'TBD', team2Id: 'TBD', result: null })
  })

  it('integra los equipos Lower iniciales hasta una única gran final', () => {
    const matches = [
      win(match('u1a', 1, 'A', 'B'), 'A'),
      { ...win(match('u1b', 1, 'C', 'D'), 'C'), bracketPosition: 1 },
      win(match('uf', 2, 'A', 'C'), 'A'),
      win(match('l1a', -1, 'E', 'B'), 'E'),
      { ...win(match('l1b', -1, 'F', 'D'), 'D'), bracketPosition: 1 },
      win(match('l2', -2, 'E', 'D'), 'E'),
      win(match('l3', -3, 'E', 'C'), 'E'),
      match('gf', 99, 'A', 'E'),
    ]
    const result = recalculateBracket(phase('upper-lower', {
      bracketTeamIds: ['A', 'B', 'C', 'D', 'E', 'F'],
      lowerBracketTeamIds: ['E', 'F'],
    }), matches)

    expect(result[3]).toMatchObject({ team1Id: 'E', team2Id: 'B' })
    expect(result[4]).toMatchObject({ team1Id: 'F', team2Id: 'D' })
    expect(result[6]).toMatchObject({ team1Id: 'E', team2Id: 'C' })
    expect(result[7]).toMatchObject({ team1Id: 'A', team2Id: 'E' })
  })

  it.each([
    ['todos en Upper', false],
    ['reparto 2:1', true],
  ] as const)('recalcula hasta la gran final con dieciséis equipos Upper y %s', (_label, splitEntry) => {
    const upper = Array.from({ length: 16 }, (_, index) => `U${index + 1}`)
    const lower = splitEntry ? Array.from({ length: 8 }, (_, index) => `L${index + 1}`) : []
    let sequence = 0
    const positioned = (round: number, position: number, team1Id = 'TBD', team2Id = 'TBD') => ({
      ...match(`m${++sequence}`, round, team1Id, team2Id),
      bracketPosition: position,
    })
    let matches: Match[] = []
    for (let position = 0; position < upper.length / 2; position++) {
      matches.push(positioned(1, position, upper[position * 2], upper[position * 2 + 1]))
    }
    for (let round = 2; round <= 4; round++) {
      for (let position = 0; position < upper.length / (2 ** round); position++) matches.push(positioned(round, position))
    }
    if (splitEntry) {
      for (let position = 0; position < lower.length; position++) matches.push(positioned(-1, position, lower[position]))
      for (let upperRound = 2; upperRound <= 4; upperRound++) {
        const count = upper.length / (2 ** upperRound)
        for (let position = 0; position < count; position++) matches.push(positioned(-(2 * upperRound - 2), position))
        for (let position = 0; position < count; position++) matches.push(positioned(-(2 * upperRound - 1), position))
      }
    } else {
      for (let position = 0; position < upper.length / 4; position++) matches.push(positioned(-1, position))
      for (let upperRound = 2; upperRound <= 4; upperRound++) {
        const count = upper.length / (2 ** upperRound)
        for (let position = 0; position < count; position++) matches.push(positioned(-(2 * upperRound - 2), position))
        if (upperRound < 4) {
          for (let position = 0; position < count / 2; position++) matches.push(positioned(-(2 * upperRound - 1), position))
        }
      }
    }
    matches.push(positioned(99, 0))

    const configuredPhase = phase('upper-lower', {
      bracketTeamIds: [...upper, ...lower],
      ...(splitEntry ? { lowerBracketTeamIds: lower } : {}),
    })
    const rounds = splitEntry
      ? [1, -1, -2, 2, -3, -4, 3, -5, -6, 4, -7]
      : [1, -1, 2, -2, -3, 3, -4, -5, 4, -6]

    for (const round of rounds) {
      const roundMatches = matches.filter(candidate => candidate.round === round)
      expect(roundMatches.every(candidate => candidate.team1Id !== 'TBD' && candidate.team2Id !== 'TBD')).toBe(true)
      matches = recalculateBracket(configuredPhase, matches.map(candidate => (
        candidate.round === round ? win(candidate, candidate.team1Id) : candidate
      )))
    }

    expect(matches.find(candidate => candidate.round === 99)).toMatchObject({ team1Id: 'U1' })
    expect(matches.find(candidate => candidate.round === 99)?.team2Id).not.toBe('TBD')
  })

  it('mantiene coherentes los descendientes cuando falta un partido eliminado', () => {
    const matches = [
      { ...win(match('s2', 1, 'C', 'D'), 'C'), bracketPosition: 1 },
      win(match('f', 2, 'A', 'C'), 'A'),
    ]
    const result = recalculateBracket(phase('elimination'), matches)
    expect(result[1]).toMatchObject({ team1Id: 'TBD', team2Id: 'C', result: null })
  })
})
