import { describe, expect, it } from 'vitest'
import { MatchSchema } from '../schemas'
import { isValidRiotMatchId, normalizeRiotMatchId } from '../riot-match-id'

describe('validación de IDs de partidas de Riot', () => {
  it('acepta IDs de Match-v5 y normaliza espacios y mayúsculas', () => {
    expect(isValidRiotMatchId(' euw1_7123456789 ')).toBe(true)
    expect(normalizeRiotMatchId(' euw1_7123456789 ')).toBe('EUW1_7123456789')
  })

  it('rechaza códigos que no son IDs de partida', () => {
    expect(isValidRiotMatchId('BADCODE')).toBe(false)
    expect(isValidRiotMatchId('EUW1-match')).toBe(false)
    expect(isValidRiotMatchId('EUW1_')).toBe(false)
  })

  it('aplica la misma regla en el esquema del servidor', () => {
    const result = MatchSchema.safeParse({
      phaseId: 'phase-1', round: 1, team1Id: 'team-1', team2Id: 'team-2',
      result: null, riotMatchIds: [' euw1_7123456789 '],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.riotMatchIds).toEqual(['EUW1_7123456789'])

    const invalid = MatchSchema.safeParse({
      phaseId: 'phase-1', round: 1, team1Id: 'team-1', team2Id: 'team-2',
      result: null, riotMatchIds: ['BADCODE'],
    })
    expect(invalid.success).toBe(false)
  })
})
