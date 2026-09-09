import { describe, expect, it } from 'vitest'
import { isTeamSelectionAllowed } from '@/lib/compare'

describe('isTeamSelectionAllowed', () => {
  it('allows selecting a different team', () => {
    expect(isTeamSelectionAllowed('team-a', 'team-b')).toBe(true)
  })

  it('rejects the team selected in the other selector', () => {
    expect(isTeamSelectionAllowed('team-a', 'team-a')).toBe(false)
  })
})
