import { describe, expect, it } from 'vitest'
import { validateGroupsConfig, validatePhaseParticipants } from '../phase-validation'
import { PhaseSchema } from '../schemas'

describe('validación de grupos', () => {
  it('rechaza una fase sin grupos ni participantes', () => {
    expect(validatePhaseParticipants('groups', {})).toContain('Añade al menos un grupo con 2 equipos')
  })

  it('rechaza equipos repetidos entre grupos', () => {
    const errors = validateGroupsConfig({
      groups: [{ id: 'A', teamIds: ['t1', 't2'] }, { id: 'B', teamIds: ['t1', 't3'] }],
      advanceCount: 1,
    })
    expect(errors).toContain('El equipo «t1» pertenece a varios grupos (A y B)')
  })

  it('rechaza ids repetidos, grupos pequeños y advanceCount no menor', () => {
    const result = PhaseSchema.safeParse({
      name: 'Grupos', type: 'groups', order: 1,
      config: { bo: 1, advanceCount: 2, groups: [{ id: 'A', teamIds: ['t1', 't2'] }, { id: 'A', teamIds: [] }] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map(issue => issue.message)
      expect(messages.some(message => message.includes('id de grupo'))).toBe(true)
      expect(messages.some(message => message.includes('al menos 2'))).toBe(true)
      expect(messages.some(message => message.includes('advanceCount'))).toBe(true)
    }
  })

  it('permite grupos válidos y advanceCount menor que su tamaño', () => {
    expect(PhaseSchema.safeParse({
      name: 'Grupos', type: 'groups', order: 1,
      config: { bo: 1, advanceCount: 1, groups: [{ id: 'A', teamIds: ['t1', 't2'] }] },
    }).success).toBe(true)
  })
})

describe('validación de participantes por formato', () => {
  it.each([
    ['swiss', { swissTeamIds: [] }],
    ['elimination', { bracketTeamIds: [] }],
    ['final-four', { bracketTeamIds: ['t1', 't2'] }],
    ['upper-lower', { bracketTeamIds: ['t1', 't2', 't3'] }],
  ] as const)('rechaza una configuración inválida de %s', (type, config) => {
    expect(validatePhaseParticipants(type, config)).not.toEqual([])
  })

  it.each([
    ['groups', { groups: [{ id: 'A', teamIds: ['t1', 't2'] }], advanceCount: 1 }],
    ['swiss', { swissTeamIds: Array.from({ length: 8 }, (_, index) => `t${index}`) }],
    ['elimination', { bracketTeamIds: ['t1', 't2'] }],
    ['final-four', { bracketTeamIds: ['t1', 't2', 't3', 't4'] }],
    ['upper-lower', { bracketTeamIds: ['t1', 't2', 't3', 't4'] }],
  ] as const)('acepta una configuración válida de %s', (type, config) => {
    expect(validatePhaseParticipants(type, config)).toEqual([])
  })

  it('rechaza participantes duplicados aunque la longitud aparente sea válida', () => {
    expect(validatePhaseParticipants('elimination', { bracketTeamIds: ['t1', 't1'] }))
      .toContain('Un equipo no puede aparecer más de una vez')
  })

  it('acepta una entrada escalonada con el doble de equipos en Upper', () => {
    expect(validatePhaseParticipants('upper-lower', {
      bracketTeamIds: ['u1', 'u2', 'u3', 'u4', 'l1', 'l2'],
      lowerBracketTeamIds: ['l1', 'l2'],
    })).toEqual([])
    expect(validatePhaseParticipants('upper-lower', {
      bracketTeamIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'l1', 'l2', 'l3', 'l4'],
      lowerBracketTeamIds: ['l1', 'l2', 'l3', 'l4'],
    })).toEqual([])
    expect(validatePhaseParticipants('upper-lower', {
      bracketTeamIds: [
        ...Array.from({ length: 16 }, (_, index) => `u${index + 1}`),
        ...Array.from({ length: 8 }, (_, index) => `l${index + 1}`),
      ],
      lowerBracketTeamIds: Array.from({ length: 8 }, (_, index) => `l${index + 1}`),
    })).toEqual([])
  })

  it('rechaza repartos sin proporción 2:1 y equipos Lower ajenos a la fase', () => {
    expect(validatePhaseParticipants('upper-lower', {
      bracketTeamIds: ['u1', 'u2', 'u3', 'u4', 'l1', 'l2'],
      lowerBracketTeamIds: ['l1'],
    })).toContain('El reparto inicial debe tener una potencia de 2 en Upper y exactamente la mitad en Lower (4+2, 8+4, 16+8...)')
    expect(validatePhaseParticipants('upper-lower', {
      bracketTeamIds: ['u1', 'u2', 'u3', 'u4'],
      lowerBracketTeamIds: ['outside'],
    })).toContain('Todos los equipos de Lower deben estar seleccionados en la fase')
  })
})
