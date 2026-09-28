import { describe, expect, it } from 'vitest'
import { OverlayConfigSchema, overlayConfigError, overlayPages, overlayRoundLabel, overlaySections, resolveOverlay } from '../overlay'
import type { Match, Phase } from '../types'

const ids = Array.from({ length: 32 }, (_, i) => `team-${i}`)
const group: Phase = { id: 'groups', name: 'Grupos', type: 'groups', status: 'active', order: 0, config: { bo: 3, groups: [{ id: 'A', teamIds: ids }] } }
const games: Match[] = Array.from({ length: 16 }, (_, i) => ({ id: `match-${i}`, phaseId: group.id, round: 1, team1Id: ids[i * 2], team2Id: ids[i * 2 + 1], result: null, riotMatchIds: [] }))

describe('overlay selection and fixed pagination', () => {
  it('shows every published Swiss round and every match together, including unrelated and pending games', () => {
    const phase: Phase = { ...group, type: 'swiss', config: { bo: 3, swissTeamIds: ids, confirmedRounds: [1, 2, 3, 4, 5] } }
    const matches = [1, 2, 3, 4, 5, 6].flatMap(round => games.slice(0, 8).map(m => ({ ...m, id: `${round}-${m.id}`, round })))
    const pages = overlayPages(phase, matches, 'round:3')
    expect(pages).toHaveLength(1)
    expect(pages[0].overview).toBe(true)
    expect(pages[0].columns.map(c => c.title)).toEqual(['Ronda 1', 'Ronda 2', 'Ronda 3', 'Ronda 4', 'Ronda 5'])
    expect(pages[0].columns.every(c => c.matches?.length === 8 && !c.standings)).toBe(true)
    expect(pages[0].columns.flatMap(c => c.matches!).map(m => m.id)).toEqual(matches.filter(m => m.round < 6).map(m => m.id))
    const config = { matchId: '3-match-7', visibility: { fase: { history: true } } }
    expect(resolveOverlay(config, [phase], matches).summary?.page).toBe(1)
    expect(resolveOverlay({ ...config, summary: { phaseId: phase.id, section: 'round:3', page: 2 } }, [phase], matches).summary?.page).toBe(1)
    expect(overlayConfigError({ ...config, summary: { phaseId: phase.id, section: 'round:3', page: 2 } }, [phase], matches)).toBeTruthy()
    expect(resolveOverlay({ matchId: '6-match-0' }, [phase], matches).summary).toBeUndefined()
  })

  it('keeps the normal group and bracket contents when highlighting is enabled', () => {
    for (const type of ['groups', 'elimination', 'final-four', 'upper-lower'] as const) {
      const phase: Phase = { ...group, type, config: { ...group.config, bracketTeamIds: ids, confirmedBracket: true } }
      const normal = resolveOverlay({ matchId: games[0].id }, [phase], games)
      const highlighted = resolveOverlay({ matchId: games[0].id, visibility: { fase: { history: true } } }, [phase], games)
      expect(highlighted.pages).toEqual(normal.pages)
      expect(highlighted.summary).toEqual(normal.summary)
    }
  })

  it('accepts old minimal settings and validates each overlay independently', () => {
    expect(OverlayConfigSchema.parse({ matchId: null }).visibility).toBeUndefined()
    const visibility = { marcador: { logos: true }, previa: { logos: false, maps: true }, fase: { content: 'standings', page: true } }
    expect(OverlayConfigSchema.parse({ matchId: null, visibility }).visibility).toEqual(visibility)
    for (const invalid of [{ marcador: { maps: true } }, { previa: { logos: 'false' } }, { fase: { content: 'none' } }, { previa: { names: false } }, { other: {} }]) {
      expect(OverlayConfigSchema.safeParse({ matchId: null, visibility: invalid }).success).toBe(false)
    }
  })

  it('paginates visible content, keeps column slots and follows the first team for standings', () => {
    const standings = overlayPages(group, games, 'group:A', 'standings')
    const matches = overlayPages(group, games, 'group:A', 'matches')
    expect(standings).toHaveLength(3)
    expect(matches).toHaveLength(2)
    expect(standings[0].columns.map(c => c.slot)).toEqual([1])
    expect(matches[0].columns.map(c => c.slot)).toEqual([2, 3])
    const config = { matchId: games[12].id, visibility: { fase: { content: 'standings' as const } } }
    expect(resolveOverlay(config, [group], games).summary?.page).toBe(3)
    expect(resolveOverlay({ ...config, visibility: { fase: { content: 'matches' } } }, [group], games).summary?.page).toBe(2)
    expect(overlayConfigError({ ...config, visibility: { fase: { content: 'matches' } }, summary: { phaseId: group.id, section: 'group:A', page: 3 } }, [group], games)).toBeTruthy()
    const swiss: Phase = { ...group, type: 'swiss', config: { bo: 3, swissTeamIds: ids, confirmedRounds: [1] } }
    expect(overlayPages(swiss, games, 'round:1')).toHaveLength(1)
    expect(overlayPages(swiss, games, 'round:1').every(p => p.columns.every(c => !c.standings))).toBe(true)
    expect(resolveOverlay({ matchId: games[12].id }, [swiss], games).summary?.page).toBe(1)
    expect(resolveOverlay(config, [swiss], games).summary?.page).toBe(3)
    const missingFirst = { ...games[12], team1Id: 'missing', team2Id: ids[13] }
    expect(resolveOverlay(config, [swiss], [missingFirst]).summary?.page).toBe(2)
    expect(resolveOverlay(config, [swiss], [{ ...missingFirst, team2Id: 'missing-too' }]).summary?.page).toBe(1)
    const bracket: Phase = { ...group, type: 'elimination', config: { bo: 3, confirmedBracket: true } }
    expect(overlayPages(bracket, games, 'round:1', 'standings')).toEqual(overlayPages(bracket, games, 'round:1'))
  })

  it('does not pick content without a selection and follows the page containing the match', () => {
    expect(resolveOverlay({ matchId: null }, [group], games).summary).toBeUndefined()
    expect(resolveOverlay({ matchId: games[12].id }, [group], games).summary).toEqual({ phaseId: group.id, section: 'group:A', page: 2 })
    const pages = overlayPages(group, games, 'group:A')
    expect(pages).toHaveLength(3)
    expect(pages.flatMap(p => p.columns.flatMap(c => c.standings ?? []))).toHaveLength(32)
    for (const page of pages) {
      expect(page.columns.length).toBeLessThanOrEqual(3)
      for (const column of page.columns) {
        expect(column.standings?.length ?? 0).toBeLessThanOrEqual(12)
        expect(column.matches?.length ?? 0).toBeLessThanOrEqual(4)
      }
    }
  })

  it('keeps the complete group standings on every match page, including the last', () => {
    for (const size of [6, 10, 12, 13]) {
      const teamIds = ids.slice(0, size)
      const phase: Phase = { ...group, config: { bo: 3, groups: [{ id: 'A', teamIds }] } }
      const matches = teamIds.flatMap((team1Id, i) => teamIds.slice(i + 1).map(team2Id => ({ ...games[0], id: `${team1Id}-${team2Id}`, team1Id, team2Id })))
      const pages = overlayPages(phase, matches, 'group:A')
      for (const page of pages) {
        const rows = page.columns.find(c => c.standings)?.standings
        expect(rows?.length).toBeGreaterThan(0)
        if (size <= 12) expect(rows?.map(row => row.teamId)).toEqual(teamIds)
      }
      expect(new Set(pages.flatMap(p => p.columns.flatMap(c => c.standings?.map(s => s.teamId) ?? []))).size).toBe(size)
      const resolved = resolveOverlay({ matchId: matches.at(-1)!.id }, [phase], matches)
      expect(resolved.summary?.page).toBe(pages.length)
      expect(resolved.pages.at(-1)?.columns[0].standings?.length).toBeGreaterThan(0)
    }
  })

  it('honors manual pages, rejects invalid references, and withdraws stale selections', () => {
    const config = { matchId: games[0].id, summary: { phaseId: group.id, section: 'group:A', page: 3 } }
    expect(resolveOverlay(config, [group], games).summary?.page).toBe(3)
    expect(overlayConfigError(config, [group], games)).toBeNull()
    expect(overlayConfigError({ ...config, summary: { ...config.summary, page: 4 } }, [group], games)).toBeTruthy()
    expect(overlayConfigError({ ...config, summary: { ...config.summary, section: 'group:B' } }, [group], games)).toBeTruthy()
    expect(overlayConfigError({ matchId: 'foreign' }, [group], games)).toBeTruthy()
    expect(resolveOverlay({ matchId: games[0].id }, [group], games.slice(1)).match).toBeUndefined()
    expect(resolveOverlay(config, [], games).summary).toBeUndefined()
    expect(OverlayConfigSchema.safeParse({ matchId: null, summary: { ...config.summary, page: 0 } }).success).toBe(false)
    expect(OverlayConfigSchema.safeParse({ matchId: null, extra: true }).success).toBe(false)
  })

  it('uses published results for standings and filters unconfirmed Swiss rounds', () => {
    const played = { ...games[0], result: { team1Score: 2, team2Score: 0 }, winnerId: ids[0] }
    expect(overlayPages(group, [played], 'group:A')[0].columns[0].standings?.[0]).toMatchObject({ teamId: ids[0], wins: 1, points: 3 })
    const swiss: Phase = { ...group, type: 'swiss', config: { bo: 3, swissTeamIds: ids.slice(0, 8), confirmedRounds: [1] } }
    const secret = { ...games[1], round: 2 }
    expect(overlaySections(swiss, [played, secret])).toEqual([{ id: 'round:1', label: 'Ronda 1' }])
    expect(resolveOverlay({ matchId: secret.id }, [swiss], [played, secret]).match).toBeUndefined()
    const pages = overlayPages(swiss, [played, secret], 'round:1')
    expect(pages.flatMap(p => p.columns.flatMap(c => c.matches ?? []))).toEqual([played])
    expect(pages.every(p => p.columns.every(c => !c.standings))).toBe(true)
    expect(overlayPages(swiss, [played, secret], 'round:1', 'standings')[0].columns[0].standings?.[0]).toMatchObject({ teamId: ids[0], wins: 1 })
    expect(overlayPages(swiss, [played, secret], 'round:2')).toEqual([])
  })

  it('paginates a 32-team bracket preserving persisted order and identifies finals', () => {
    const phase: Phase = { ...group, type: 'elimination', config: { bo: 1, bracketTeamIds: ids, confirmedBracket: true } }
    const matches = [16, 8, 4, 2, 1].flatMap((count, r) => Array.from({ length: count }, (_, i) => ({ ...games[0], id: `${r}-${i}`, round: r + 1, bracketPosition: i })))
    const pages = overlayPages(phase, [...matches].reverse(), 'round:1')
    expect(pages).toHaveLength(4)
    expect(pages[2].columns.map(c => c.matches?.map(m => m.id))).toEqual([['0-8', '0-9', '0-10', '0-11'], ['1-4', '1-5'], ['2-2']])
    expect(overlayRoundLabel(phase, 1, matches.slice(0, 16))).toBe('Ronda 1')
    expect(overlayRoundLabel(phase, 5, matches)).toBe('Final')
    expect(resolveOverlay({ matchId: '0-12' }, [phase], matches).summary?.page).toBe(4)
    expect(resolveOverlay({ matchId: '0-12' }, [{ ...phase, config: { ...phase.config, confirmedBracket: false } }], matches).summary).toBeUndefined()
  })

  it('keeps third place separate from final progression and labels Upper/Lower and grand final', () => {
    const phase: Phase = { ...group, type: 'final-four', config: { bo: 3, bracketTeamIds: ids.slice(0, 4), confirmedBracket: true } }
    const matches = [1, 1, 2, 98, -1, 99].map((round, i) => ({ ...games[i], round }))
    const page = overlayPages(phase, matches, 'round:1')[0]
    expect(page.columns.map(c => c.title)).toEqual(['Semifinales', 'Final', 'Tercer puesto'])
    expect(page.columns.map(c => c.connects)).toEqual([false, true, false])
    expect(overlayRoundLabel({ ...phase, type: 'upper-lower' }, -1, matches)).toBe('Lower · Ronda 1')
    expect(overlayRoundLabel(phase, 99, matches)).toBe('Gran final')
  })
})
