import db from './db'
import type { Player, Role, Team, TeamAccessInfo, TeamChangeRequest, TeamChangeRequestStatus, TeamChangeRequestType } from './types'
import { StaleWriteError, generateId, getTeamById, getTeams, updateTeam } from './data'
import { validateTeams } from './domain-validation'

interface AccessRow {
  team_id: string
  password_hash: string
  password_encrypted: string
  enabled: number
  session_version: number
  created_at: string
  last_login_at: string | null
}

interface RequestRow {
  id: string
  team_id: string
  type: TeamChangeRequestType
  player_id: string | null
  payload: string
  status: TeamChangeRequestStatus
  created_at: string
  resolved_at: string | null
  rejection_reason: string | null
}

function accessInfo(row: AccessRow): TeamAccessInfo {
  return { teamId: row.team_id, enabled: row.enabled === 1, createdAt: row.created_at, ...(row.last_login_at ? { lastLoginAt: row.last_login_at } : {}) }
}

function requestFromRow(row: RequestRow): TeamChangeRequest {
  return {
    id: row.id,
    teamId: row.team_id,
    type: row.type,
    ...(row.player_id ? { playerId: row.player_id } : {}),
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    status: row.status,
    createdAt: row.created_at,
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
  }
}

export function createTeamAccess(teamId: string, passwordHash: string, encryptedPassword: string): TeamAccessInfo {
  db.prepare(`INSERT INTO team_access (team_id, password_hash, password_encrypted) VALUES (?, ?, ?)`)
    .run(teamId, passwordHash, encryptedPassword)
  return getTeamAccess(teamId)!
}

/** Creates credentials for teams that predate the team portal feature. */
export async function ensureExistingTeamsHaveAccess(): Promise<number> {
  const missing = db.prepare(`
    SELECT teams.id
    FROM teams
    LEFT JOIN team_access ON team_access.team_id = teams.id
    WHERE team_access.team_id IS NULL
  `).all() as Array<{ id: string }>
  if (missing.length === 0) return 0

  const [{ default: bcrypt }, { encryptTeamPassword, generateTeamPassword }] = await Promise.all([
    import('bcryptjs'),
    import('./team-credentials'),
  ])
  let created = 0
  for (const team of missing) {
    const password = generateTeamPassword()
    const passwordHash = await bcrypt.hash(password, 12)
    try {
      createTeamAccess(team.id, passwordHash, encryptTeamPassword(password))
      created += 1
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      if (code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw error
    }
  }
  return created
}

export function getTeamAccess(teamId: string): TeamAccessInfo | undefined {
  const row = db.prepare('SELECT * FROM team_access WHERE team_id = ?').get(teamId) as AccessRow | undefined
  return row ? accessInfo(row) : undefined
}

export function getTeamAccessSecret(teamId: string): (TeamAccessInfo & { passwordHash: string; encryptedPassword: string; sessionVersion: number }) | undefined {
  const row = db.prepare('SELECT * FROM team_access WHERE team_id = ?').get(teamId) as AccessRow | undefined
  return row ? { ...accessInfo(row), passwordHash: row.password_hash, encryptedPassword: row.password_encrypted, sessionVersion: row.session_version } : undefined
}

export function replaceTeamAccess(teamId: string, passwordHash: string, encryptedPassword: string): TeamAccessInfo {
  db.prepare(`INSERT INTO team_access (team_id, password_hash, password_encrypted, enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(team_id) DO UPDATE SET password_hash = excluded.password_hash, password_encrypted = excluded.password_encrypted, enabled = 1, session_version = team_access.session_version + 1`)
    .run(teamId, passwordHash, encryptedPassword)
  return getTeamAccess(teamId)!
}

export function setTeamAccessEnabled(teamId: string, enabled: boolean): TeamAccessInfo | undefined {
  if (db.prepare('UPDATE team_access SET enabled = ?, session_version = session_version + 1 WHERE team_id = ?').run(enabled ? 1 : 0, teamId).changes !== 1) return undefined
  return getTeamAccess(teamId)
}

export function markTeamLogin(teamId: string): void {
  db.prepare('UPDATE team_access SET last_login_at = CURRENT_TIMESTAMP WHERE team_id = ?').run(teamId)
}

export function createTeamWithAccess(team: Team, passwordHash: string, encryptedPassword: string): Team {
  return db.transaction(() => {
    const created = { ...team, version: 1 }
    db.prepare('INSERT INTO teams (id, data, version) VALUES (?, ?, 1)').run(team.id, JSON.stringify(created))
    createTeamAccess(team.id, passwordHash, encryptedPassword)
    return created
  }).immediate()
}

export function updatePlayerRoles(teamId: string, playerId: string, version: number, primaryRole: Role, secondaryRole?: Exclude<Role, 'Suplente'>): Team {
  const team = getTeamById(teamId)
  if (!team || team.version !== version) throw new StaleWriteError('Team was modified')
  const player = team.players.find(item => item.id === playerId)
  if (!player) throw new Error('Jugador no encontrado')
  const players = team.players.map(item => item.id === playerId ? { ...item, primaryRole, ...(secondaryRole ? { secondaryRole } : { secondaryRole: undefined }) } : item)
  return updateTeam({ ...team, players })
}

export function createTeamChangeRequest(teamId: string, type: TeamChangeRequestType, payload: Record<string, unknown>, playerId?: string): TeamChangeRequest {
  const duplicate = db.prepare(`SELECT id FROM team_change_requests
    WHERE team_id = ? AND type = ? AND COALESCE(player_id, '') = COALESCE(?, '') AND status = 'pending'`).get(teamId, type, playerId ?? null)
  if (duplicate) throw new Error('Ya existe una solicitud pendiente para este cambio')
  const id = generateId('request')
  db.prepare(`INSERT INTO team_change_requests (id, team_id, type, player_id, payload) VALUES (?, ?, ?, ?, ?)`)
    .run(id, teamId, type, playerId ?? null, JSON.stringify(payload))
  return getTeamChangeRequest(id)!
}

export function getTeamChangeRequest(id: string): TeamChangeRequest | undefined {
  const row = db.prepare('SELECT * FROM team_change_requests WHERE id = ?').get(id) as RequestRow | undefined
  return row ? requestFromRow(row) : undefined
}

export function getTeamChangeRequests(teamId?: string): TeamChangeRequest[] {
  const rows = (teamId
    ? db.prepare('SELECT * FROM team_change_requests WHERE team_id = ? ORDER BY created_at DESC').all(teamId)
    : db.prepare('SELECT * FROM team_change_requests ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, created_at DESC').all()) as RequestRow[]
  return rows.map(requestFromRow)
}

export function rejectTeamChangeRequest(id: string, reason?: string): TeamChangeRequest | undefined {
  const result = db.prepare(`UPDATE team_change_requests SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ? AND status = 'pending'`)
    .run(reason?.trim() || null, id)
  return result.changes === 1 ? getTeamChangeRequest(id) : undefined
}

export function approveTeamChangeRequest(id: string): { request: TeamChangeRequest; team: Team } | undefined {
  return db.transaction(() => {
    const request = getTeamChangeRequest(id)
    if (!request || request.status !== 'pending') return undefined
    const team = getTeamById(request.teamId)
    if (!team) throw new Error('Equipo no encontrado')
    let updated: Team
    if (request.type === 'team_logo') {
      updated = updateTeam({ ...team, logo: String(request.payload.logo) })
    } else if (request.type === 'summoner_name') {
      const players = team.players.map(player => player.id === request.playerId ? { ...player, summonerName: String(request.payload.summonerName) } : player)
      if (!players.some(player => player.id === request.playerId)) throw new Error('Jugador no encontrado')
      updated = { ...team, players }
      const issues = validateTeams(getTeams().map(item => item.id === team.id ? updated : item))
      if (issues.length) throw new Error(issues[0].message)
      updated = updateTeam(updated)
    } else {
      const player = request.payload as unknown as Player
      updated = { ...team, players: [...team.players, player] }
      const issues = validateTeams(getTeams().map(item => item.id === team.id ? updated : item))
      if (issues.length) throw new Error(issues[0].message)
      updated = updateTeam(updated)
    }
    db.prepare(`UPDATE team_change_requests SET status = 'approved', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).run(id)
    return { request: getTeamChangeRequest(id)!, team: updated }
  }).immediate()
}
