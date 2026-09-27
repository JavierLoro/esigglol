import { VALORANT_ROLES } from './game-details'
import { validateAndNormalizeMatch } from './match-coherence'
import { currentTournamentId } from './competition-context'
import { assertCompetitionWritable, getTournament } from './competitions'
import { getPhaseTeamIds } from './phase-validation'
import db from './db'
import type { Team, Phase, Match, PlayerRow } from './types'
import { reconcileCachedPlayers } from './player-identity'

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
  return (db.prepare("SELECT data, version FROM teams WHERE json_extract(data, '$.tournamentId') = ?").all(currentTournamentId()) as { data: string; version: number }[])
    .map(r => {
      const team = JSON.parse(r.data) as Team
      team.version = r.version
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      team.players = (team.players as any[]).map(migratePlayer)
      return decorate(team)
    }).filter(belongs)
}

export function saveTeams(teams: Team[]): void {
  return db.transaction(() => {
    teams = teams.map(prepareEntity)
    // Bulk replacement is reserved for imports and maintenance scripts.
    db.transaction(() => {
      db.prepare("DELETE FROM teams WHERE json_extract(data, '$.tournamentId') = ?").run(currentTournamentId())
      const stmt = db.prepare('INSERT INTO teams (id, data) VALUES (?, ?)')
      for (const t of teams) stmt.run(t.id, JSON.stringify(t))
    })()
  }).immediate()
}

export function getTeamById(id: string): Team | undefined {
  const row = db.prepare('SELECT data, version FROM teams WHERE id = ?').get(id) as { data: string; version: number } | undefined
  if (!row || !belongs(JSON.parse(row.data))) return undefined
  const team = JSON.parse(row.data) as Team
  team.version = row.version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  team.players = (team.players as any[]).map(migratePlayer)
  return decorate(team)
}

export class StaleWriteError extends Error {}

export function createTeam(team: Team): Team {
  return db.transaction(() => {
    team = prepareEntity(team)
    const created = { ...team, version: 1 }
    db.prepare('INSERT INTO teams (id, data, version) VALUES (?, ?, 1)').run(team.id, JSON.stringify(created))
    return created
  }).immediate()
}

export function updateTeam(team: Team): Team {
  return db.transaction(() => {
    team = prepareEntity(team)
    if (!team.version) throw new StaleWriteError('Missing entity version')
    const updated = { ...team, version: team.version + 1 }
    const result = db.prepare('UPDATE teams SET data = ?, version = ? WHERE id = ? AND version = ?')
      .run(JSON.stringify(updated), updated.version, team.id, team.version)
    if (result.changes !== 1) throw new StaleWriteError('Team was modified')
    return updated
  }).immediate()
}

export function deleteTeam(id: string, version: number): boolean {
  return db.transaction(() => {
    assertCompetitionWritable(); owned('teams', id)
    return db.transaction(() => {
      const result = db.prepare('DELETE FROM teams WHERE id = ? AND version = ?').run(id, version)
      if (result.changes === 1) {
        db.prepare('DELETE FROM team_access WHERE team_id = ?').run(id)
        db.prepare('DELETE FROM team_change_requests WHERE team_id = ?').run(id)
      }
      return result.changes === 1
    }).immediate()
  }).immediate()
}

/** Updates only the persisted logo for an existing team. */
export function updateTeamLogo(teamId: string, logo: string): Team | undefined {
  return db.transaction(() => {
    assertCompetitionWritable(); owned('teams', teamId)
    const update = db.transaction(() => {
      const team = getTeamById(teamId)
      if (!team) return undefined

      const updated = { ...team, logo }
      const versioned = { ...updated, version: (team.version ?? 1) + 1 }
      const result = db.prepare('UPDATE teams SET data = ?, version = ? WHERE id = ? AND version = ?')
        .run(JSON.stringify(versioned), versioned.version, teamId, team.version ?? 1)
      return result.changes === 1 ? versioned : undefined
    })

    return update()
  }).immediate()
}

export interface TeamReferences {
  phaseIds: string[]
  matchIds: string[]
}

/** Finds all persisted tournament records that would become invalid if a team is removed. */
export function findTeamReferences(teamId: string, phases: Phase[], matches: Match[]): TeamReferences {
  const phaseIds = phases
    .filter(phase => {
      const config = phase.config
      return config.groups?.some(group => group.teamIds.includes(teamId))
        || config.swissTeamIds?.includes(teamId)
        || config.bracketTeamIds?.includes(teamId)
    })
    .map(phase => phase.id)

  const matchIds = matches
    .filter(match => match.team1Id === teamId || match.team2Id === teamId || match.winnerId === teamId)
    .map(match => match.id)

  return { phaseIds, matchIds }
}

export function getTeamReferences(teamId: string): TeamReferences {
  return findTeamReferences(teamId, getPhases(), getMatches())
}

// ── Phases ───────────────────────────────────────────────────────────────────

export function getPhases(): Phase[] {
  return (db.prepare("SELECT data, version FROM phases WHERE json_extract(data, '$.tournamentId') = ? ORDER BY order_ ASC").all(currentTournamentId()) as { data: string; version: number }[])
    .map(r => decorate({ ...(JSON.parse(r.data) as Phase), version: r.version })).filter(belongs)
}

export function savePhases(phases: Phase[]): void {
  return db.transaction(() => {
    phases = phases.map(prepareEntity)
    // Bulk replacement is reserved for imports and maintenance scripts.
    db.transaction(() => {
      db.prepare("DELETE FROM phases WHERE json_extract(data, '$.tournamentId') = ?").run(currentTournamentId())
      const stmt = db.prepare('INSERT INTO phases (id, order_, data) VALUES (?, ?, ?)')
      for (const p of phases) stmt.run(p.id, p.order, JSON.stringify(p))
    })()
  }).immediate()
}

export function savePhase(phase: Phase): void {
  return db.transaction(() => {
    phase = prepareEntity(phase)
    db.prepare('INSERT OR REPLACE INTO phases (id, order_, data) VALUES (?, ?, ?)')
      .run(phase.id, phase.order, JSON.stringify(phase))
  }).immediate()
}

export function getPhaseById(id: string): Phase | undefined {
  const row = db.prepare('SELECT data, version FROM phases WHERE id = ?').get(id) as { data: string; version: number } | undefined
  return row && belongs(JSON.parse(row.data)) ? decorate({ ...(JSON.parse(row.data) as Phase), version: row.version }) : undefined
}

export function createPhase(phase: Phase): Phase {
  return db.transaction(() => {
    phase = prepareEntity(phase)
    const created = { ...phase, version: 1 }
    db.prepare('INSERT INTO phases (id, order_, data, version) VALUES (?, ?, ?, 1)').run(phase.id, phase.order, JSON.stringify(created))
    return created
  }).immediate()
}

export function updatePhase(phase: Phase): Phase {
  return db.transaction(() => {
    phase = prepareEntity(phase)
    if (!phase.version) throw new StaleWriteError('Missing entity version')
    const updated = { ...phase, version: phase.version + 1 }
    const result = db.prepare('UPDATE phases SET order_ = ?, data = ?, version = ? WHERE id = ? AND version = ?')
      .run(updated.order, JSON.stringify(updated), updated.version, phase.id, phase.version)
    if (result.changes !== 1) throw new StaleWriteError('Phase was modified')
    return updated
  }).immediate()
}

export function deletePhase(id: string, version: number): boolean {
  return db.transaction(() => {
    assertCompetitionWritable(); owned('phases', id)
    return db.transaction(() => {
      const result = db.prepare('DELETE FROM phases WHERE id = ? AND version = ?').run(id, version)
      if (result.changes === 1) db.prepare('DELETE FROM matches WHERE phase_id = ?').run(id)
      return result.changes === 1
    }).immediate()
  }).immediate()
}

// ── Matches ──────────────────────────────────────────────────────────────────

export function getMatches(): Match[] {
  return (db.prepare("SELECT data, version FROM matches WHERE json_extract(data, '$.tournamentId') = ?").all(currentTournamentId()) as { data: string; version: number }[])
    .map(r => decorate({ ...(JSON.parse(r.data) as Match), version: r.version })).filter(belongs)
}

export function saveMatches(matches: Match[]): void {
  return db.transaction(() => {
    matches = matches.map(prepareEntity)
    // Bulk replacement is reserved for imports and maintenance scripts.
    db.transaction(() => {
      db.prepare("DELETE FROM matches WHERE json_extract(data, '$.tournamentId') = ?").run(currentTournamentId())
      const stmt = db.prepare('INSERT INTO matches (id, phase_id, data) VALUES (?, ?, ?)')
      for (const m of matches) stmt.run(m.id, m.phaseId, JSON.stringify(m))
    })()
  }).immediate()
}

export function saveMatch(match: Match): void {
  return db.transaction(() => {
    match = prepareEntity(match)
    db.prepare('INSERT OR REPLACE INTO matches (id, phase_id, data) VALUES (?, ?, ?)')
      .run(match.id, match.phaseId, JSON.stringify(match))
  }).immediate()
}

export function getMatchesByPhase(phaseId: string): Match[] {
  return (db.prepare('SELECT data, version FROM matches WHERE phase_id = ?').all(phaseId) as { data: string; version: number }[])
    .map(r => decorate({ ...(JSON.parse(r.data) as Match), version: r.version })).filter(belongs)
}

export function deleteMatches(ids: string[]): void {
  return db.transaction(() => {
    assertCompetitionWritable(); for (const id of ids) owned('matches', id)
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`DELETE FROM matches WHERE id IN (${placeholders})`).run(...ids)
  }).immediate()
}

export function getMatchById(id: string): Match | undefined {
  const row = db.prepare('SELECT data, version FROM matches WHERE id = ?').get(id) as { data: string; version: number } | undefined
  return row && belongs(JSON.parse(row.data)) ? decorate({ ...(JSON.parse(row.data) as Match), version: row.version }) : undefined
}

export function createMatches(matches: Match[]): Match[] {
  return db.transaction(() => {
    matches = matches.map(prepareEntity)
    const insert = db.prepare('INSERT INTO matches (id, phase_id, data, version) VALUES (?, ?, ?, 1)')
    return db.transaction((items: Match[]) => items.map(match => {
      const created = { ...match, version: 1 }
      insert.run(match.id, match.phaseId, JSON.stringify(created))
      return created
    }))(matches)
  }).immediate()
}

export function updateMatches(matches: Match[]): Match[] {
  return db.transaction(() => {
    matches = matches.map(prepareEntity)
    const stmt = db.prepare('UPDATE matches SET phase_id = ?, data = ?, version = ? WHERE id = ? AND version = ?')
    return db.transaction((items: Match[]) => items.map(match => {
      if (!match.version) throw new StaleWriteError('Missing entity version')
      const updated = { ...match, version: match.version + 1 }
      if (stmt.run(updated.phaseId, JSON.stringify(updated), updated.version, match.id, match.version).changes !== 1) throw new StaleWriteError('Match was modified')
      return updated
    })).immediate(matches)
  }).immediate()
}

export function deleteMatchesVersioned(versions: Record<string, number>): number {
  return db.transaction(() => {
    assertCompetitionWritable(); for (const id of Object.keys(versions)) owned('matches', id)
    const stmt = db.prepare('DELETE FROM matches WHERE id = ? AND version = ?')
    return db.transaction((entries: Array<[string, number]>) => {
      for (const [id, version] of entries) if (stmt.run(id, version).changes !== 1) throw new StaleWriteError('Match was modified')
      return entries.length
    }).immediate(Object.entries(versions))
  }).immediate()
}

export function commitTournamentChanges(
  matches: Match[],
  deleteVersions: Record<string, number> = {},
  phases: Phase[] = [],
): { matches: Match[]; phases: Phase[]; deleted: number } {
  return db.transaction(() => {
    const deleted = deleteMatchesVersioned(deleteVersions)
    const updatedMatches = updateMatches(matches)
    const updatedPhases = phases.map(updatePhase)
    return { matches: updatedMatches, phases: updatedPhases, deleted }
  }).immediate()
}

// ── Player stats cache ───────────────────────────────────────────────────────

export interface PlayerStatsCache {
  lastUpdated: string | null
  players: PlayerRow[]
}

export function getPlayerStatsCache(): PlayerStatsCache {
  const row = db.prepare('SELECT data FROM player_stats WHERE key = ?').get(`${currentTournamentId()}:cache`) as { data: string } | undefined
  if (!row) return { lastUpdated: null, players: [] }
  const cache = JSON.parse(row.data) as PlayerStatsCache
  cache.players = reconcileCachedPlayers(cache.players, getTeams())
  return cache
}

export function savePlayerStatsCache(data: PlayerStatsCache): void {
  db.prepare('INSERT OR REPLACE INTO player_stats (key, data) VALUES (?, ?)')
    .run(`${currentTournamentId()}:cache`, JSON.stringify(data))
}

// ── Settings (API keys) ─────────────────────────────────────────────────────

export function getRiotApiKey(): string {
  const row = db.prepare('SELECT data FROM tournament_config WHERE key = ?')
    .get('riot-api-key') as { data: string } | undefined
  if (row) return JSON.parse(row.data) as string
  // Fallback to env var
  return process.env.RIOT_API_KEY ?? ''
}

export function saveRiotApiKey(key: string): void {
  db.prepare('INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)')
    .run('riot-api-key', JSON.stringify(key))
}

// ── ID generator ─────────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function belongs(entity: { tournamentId?: string }): boolean {
  return (entity.tournamentId ?? 'legacy-lol') === currentTournamentId()
}
function decorate<T extends { tournamentId?: string }>(entity: T): T {
  const tournament = getTournament(entity.tournamentId)
  return { ...entity, game: tournament?.game, tournamentName: tournament?.name }
}
function owned(table: string, id: string): void {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as { data: string } | undefined
  if (!row || !belongs(JSON.parse(row.data))) throw new Error('Referencia fuera del torneo')
}
function prepareEntity<T extends Team | Phase | Match>(entity: T): T {
  const tournament = assertCompetitionWritable()
  if (entity.tournamentId && !belongs(entity)) throw new Error('Referencia fuera del torneo')
  const table = 'players' in entity ? 'teams' : 'config' in entity ? 'phases' : 'matches'
  const existing = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(entity.id) as { data: string } | undefined
  if (existing && !belongs(JSON.parse(existing.data))) throw new Error('Referencia fuera del torneo')
  if ('config' in entity) for (const id of [...getPhaseTeamIds(entity), ...(entity.config.lowerBracketTeamIds ?? [])]) owned('teams', id)
  if ('phaseId' in entity) {
    owned('phases', entity.phaseId)
    const validation = validateAndNormalizeMatch(entity, getPhaseById(entity.phaseId))
    if (!validation.ok) throw new Error(validation.error)
    for (const id of [entity.team1Id, entity.team2Id, entity.winnerId]) if (id && id !== 'TBD') owned('teams', id)
    if (tournament.game === 'valorant' && (entity.games?.some(Boolean) || entity.riotMatchIds.length || entity.tournamentCodes?.length)) throw new Error('Datos de LoL incompatibles con Valorant')
  }
  if ('players' in entity) {
    const valorantRoles = new Set<string>(VALORANT_ROLES)
    const all = db.prepare('SELECT data FROM teams WHERE id != ?').all(entity.id) as { data: string }[]
    for (const player of entity.players) {
      if (tournament.game === 'valorant' ? !valorantRoles.has(player.primaryRole) : valorantRoles.has(player.primaryRole)) throw new Error('Rol incompatible con el juego')
      if (player.secondaryRole && (tournament.game === 'valorant' ? !valorantRoles.has(player.secondaryRole) : valorantRoles.has(player.secondaryRole))) throw new Error('Rol secundario incompatible con el juego')
      if (all.some(row => (JSON.parse(row.data) as Team).players.some(p => p.id === player.id))) throw new Error('El jugador necesita un registro propio en cada plantilla')
    }
  }
  return { ...entity, tournamentId: tournament.id, game: tournament.game }
}
