import { describe, expect, it } from 'vitest'
import { validateGroupsConfig } from '../phase-validation'
import { PhaseSchema } from '../schemas'

describe('validación de grupos', () => {
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
