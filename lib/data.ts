import db from './db'
import type { Team, Phase, Match } from './types'

// ── Teams ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migratePlayer(p: any): any {
  if ('role' in p && !('primaryRole' in p)) {
    const migrated = {
      ...p,
      primaryRole: p.substitute ? 'Suplente' : p.role,
      ...(p.substitute ? { secondaryRole: p.role } : {}),
    }
    delete migrated.role
    delete migrated.substitute
    return migrated
  }
  return p
}

export function getTeams(): Team[] {
  return (db.prepare('SELECT data FROM teams').all() as { data: string }[])
    .map(r => {
      const team = JSON.parse(r.data) as Team
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      team.players = (team.players as any[]).map(migratePlayer)
      return team
    })
}

export function saveTeams(teams: Team[]): void {
  db.transaction(() => {
    db.prepare('DELETE FROM teams').run()
    const stmt = db.prepare('INSERT INTO teams (id, data) VALUES (?, ?)')
    for (const t of teams) stmt.run(t.id, JSON.stringify(t))
  })()
}

export function getTeamById(id: string): Team | undefined {
  const row = db.prepare('SELECT data FROM teams WHERE id = ?').get(id) as { data: string } | undefined
  if (!row) return undefined
  const team = JSON.parse(row.data) as Team
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  team.players = (team.players as any[]).map(migratePlayer)
  return team
}

// ── Phases ───────────────────────────────────────────────────────────────────

export function getPhases(): Phase[] {
  return (db.prepare('SELECT data FROM phases ORDER BY order_ ASC').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as Phase)
}

export function savePhases(phases: Phase[]): void {
  db.transaction(() => {
    db.prepare('DELETE FROM phases').run()
    const stmt = db.prepare('INSERT INTO phases (id, order_, data) VALUES (?, ?, ?)')
    for (const p of phases) stmt.run(p.id, p.order, JSON.stringify(p))
  })()
}

export function savePhase(phase: Phase): void {
  db.prepare('INSERT OR REPLACE INTO phases (id, order_, data) VALUES (?, ?, ?)')
    .run(phase.id, phase.order, JSON.stringify(phase))
}

export function getPhaseById(id: string): Phase | undefined {
  const row = db.prepare('SELECT data FROM phases WHERE id = ?').get(id) as { data: string } | undefined
  return row ? (JSON.parse(row.data) as Phase) : undefined
}

// ── Matches ──────────────────────────────────────────────────────────────────

export function getMatches(): Match[] {
  return (db.prepare('SELECT data FROM matches').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as Match)
}

export function saveMatches(matches: Match[]): void {
  db.transaction(() => {
    db.prepare('DELETE FROM matches').run()
    const stmt = db.prepare('INSERT INTO matches (id, phase_id, data) VALUES (?, ?, ?)')
    for (const m of matches) stmt.run(m.id, m.phaseId, JSON.stringify(m))
  })()
}

export function saveMatch(match: Match): void {
  db.prepare('INSERT OR REPLACE INTO matches (id, phase_id, data) VALUES (?, ?, ?)')
    .run(match.id, match.phaseId, JSON.stringify(match))
}

export function getMatchesByPhase(phaseId: string): Match[] {
  return (db.prepare('SELECT data FROM matches WHERE phase_id = ?').all(phaseId) as { data: string }[])
    .map(r => JSON.parse(r.data) as Match)
}

export function deleteMatches(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM matches WHERE id IN (${placeholders})`).run(...ids)
}

export function getMatchById(id: string): Match | undefined {
  const row = db.prepare('SELECT data FROM matches WHERE id = ?').get(id) as { data: string } | undefined
  return row ? (JSON.parse(row.data) as Match) : undefined
}

// ── Player stats cache ───────────────────────────────────────────────────────

export interface PlayerStatsCache {
  lastUpdated: string | null
  // PlayerRow shape from app/ranking/page — stored as plain objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  players: any[]
}

export function getPlayerStatsCache(): PlayerStatsCache {
  const row = db.prepare('SELECT data FROM player_stats WHERE key = ?').get('cache') as { data: string } | undefined
  if (!row) return { lastUpdated: null, players: [] }
  return JSON.parse(row.data) as PlayerStatsCache
}

export function savePlayerStatsCache(data: PlayerStatsCache): void {
  db.prepare('INSERT OR REPLACE INTO player_stats (key, data) VALUES (?, ?)')
    .run('cache', JSON.stringify(data))
}

// ── ID generator ─────────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
