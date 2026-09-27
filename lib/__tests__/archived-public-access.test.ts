import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ tournament: { id: 'edition', game: 'lol', status: 'archived' } }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not-found') } }))
vi.mock('../competitions', () => ({ getTournament: () => state.tournament, getTournaments: () => [state.tournament] }))
vi.mock('../db', () => ({ default: { prepare: () => ({ get: () => ({ data: JSON.stringify({ tournamentId: 'edition' }) }) }) } }))
import { publicEntityTournament, publicTournament } from '../public-competition'

describe('archived public access', () => {
  it('blocks archived editions by default, including team and match details', () => {
    expect(() => publicTournament({ tournament: 'edition' })).toThrow('not-found')
    expect(() => publicEntityTournament('teams', 'team')).toThrow('not-found')
    expect(() => publicEntityTournament('matches', 'match')).toThrow('not-found')
  })
  it('allows explicit phase access and phase overlays', () => {
    expect(publicTournament({ tournament: 'edition' }, true).id).toBe('edition')
    expect(publicEntityTournament('phases', 'phase').id).toBe('edition')
  })
  it('still rejects drafts and mismatched games when phase access is allowed', () => {
    expect(() => publicTournament({ tournament: 'edition', game: 'valorant' }, true)).toThrow('not-found')
    state.tournament.status = 'draft'
    try { expect(() => publicTournament({ tournament: 'edition' }, true)).toThrow('not-found') }
    finally { state.tournament.status = 'archived' }
  })
})
