import { describe, expect, it } from 'vitest'
import { BRACKET_SIZES, bracketSizeError } from '../bracket-sizes'

describe('tamaños soportados por formato', () => {
  it('declara tamaños explícitos para cada formato', () => {
    expect(BRACKET_SIZES.swiss).toEqual([8, 16])
    expect(BRACKET_SIZES['final-four']).toEqual([4])
    expect(BRACKET_SIZES['upper-lower']).toEqual([4, 8])
  })

  it.each([2, 4, 8])('acepta eliminación con %i equipos', count => {
    expect(bracketSizeError('elimination', count)).toBeNull()
  })

  it.each([3, 5, 6])('rechaza eliminación sin bracket de byes para %i equipos', count => {
    expect(bracketSizeError('elimination', count)).toMatch(/potencias de dos/)
  })

  it.each([
    ['upper-lower', 2], ['upper-lower', 3], ['upper-lower', 5], ['upper-lower', 6], ['upper-lower', 16],
    ['final-four', 2], ['final-four', 3], ['final-four', 5], ['final-four', 6], ['final-four', 8],
    ['swiss', 2], ['swiss', 3], ['swiss', 4], ['swiss', 5], ['swiss', 6], ['swiss', 10],
  ] as const)('rechaza %s con %i equipos', (type, count) => {
    expect(bracketSizeError(type, count)).not.toBeNull()
  })

  it.each([0, 1, -1, 2.5])('rechaza cantidades inválidas (%i)', count => {
    expect(bracketSizeError('elimination', count)).toMatch(/al menos 2/)
  })
})
