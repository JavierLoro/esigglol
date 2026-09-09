import type { LobbyEvent, Match, Phase, Team } from './types'

export type AdminErrorKind = 'validation' | 'session' | 'internal' | 'network'

export class AdminRequestError extends Error {
  constructor(public readonly kind: AdminErrorKind, message: string, public readonly status?: number) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

function errorKind(status?: number): AdminErrorKind {
  if (status === 401 || status === 403) return 'session'
  if (status === 400 || status === 409 || status === 422) return 'validation'
  return 'internal'
}

function firstErrorDetail(value: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const detail = firstErrorDetail(item, depth + 1)
      if (detail) return detail
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  const preferredKeys = ['message', 'detail', 'error', 'formErrors', 'fieldErrors']
  for (const key of preferredKeys) {
    if (!(key in value)) continue
    const detail = firstErrorDetail(value[key], depth + 1)
    if (detail) return detail
  }
  for (const item of Object.values(value)) {
    const detail = firstErrorDetail(item, depth + 1)
    if (detail) return detail
  }
  return undefined
}

export function errorMessage(error: unknown): string {
  if (error instanceof AdminRequestError) {
    if (error.kind === 'session') return 'Sesión expirada. Vuelve a iniciar sesión.'
    if (error.kind === 'validation') return `Error de validación: ${error.message}`
    if (error.kind === 'network') return 'Error de conexión. Comprueba tu red.'
    return `Error interno: ${error.message}`
  }
  return 'Error interno. Inténtalo de nuevo.'
}

export async function adminRequest<T>(request: Promise<Response>, validate: (value: unknown) => value is T): Promise<T> {
  let response: Response
  try {
    response = await request
  } catch {
    throw new AdminRequestError('network', 'No se pudo conectar')
  }

  let body: unknown
  try { body = await response.json() } catch { body = undefined }
  if (!response.ok) {
    const message = firstErrorDetail(body) ?? (response.statusText || 'La petición ha fallado')
    throw new AdminRequestError(errorKind(response.status), message, response.status)
  }
  if (!validate(body)) throw new AdminRequestError('internal', 'La respuesta del servidor no tiene un formato válido', response.status)
  return body
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isOk(value: unknown): value is { ok: true } {
  return isRecord(value) && value.ok === true
}

export function isArrayOfRecords<T = Record<string, unknown>>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every(isRecord)
}

export function isEntity(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}

const ROLES = new Set(['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente'])
const SECONDARY_ROLES = new Set(['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill'])
const PHASE_TYPES = new Set(['groups', 'swiss', 'upper-lower', 'final-four', 'elimination'])
const PHASE_STATUSES = new Set(['upcoming', 'active', 'completed'])
const BO_FORMATS = new Set([1, 2, 3, 5])

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteInteger(value) && value > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isOptional(value: Record<string, unknown>, key: string, guard: (item: unknown) => boolean): boolean {
  return !(key in value) || guard(value[key])
}

function isPlayer(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.summonerName !== 'string' || typeof value.primaryRole !== 'string' || !ROLES.has(value.primaryRole)) return false
  return !('secondaryRole' in value) || value.secondaryRole === undefined || (typeof value.secondaryRole === 'string' && SECONDARY_ROLES.has(value.secondaryRole))
}

export function isTeam(value: unknown): value is Team {
  return isEntity(value)
    && typeof value.name === 'string'
    && typeof value.logo === 'string'
    && Array.isArray(value.players)
    && value.players.every(isPlayer)
}

function isGroupConfig(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && isStringArray(value.teamIds)
}

function isBOFormat(value: unknown): boolean {
  return typeof value === 'number' && BO_FORMATS.has(value)
}

function isBORecord(value: unknown): boolean {
  return isRecord(value) && !Array.isArray(value) && Object.values(value).every(isBOFormat)
}

function isPhaseConfig(value: unknown): boolean {
  if (!isRecord(value) || !isBOFormat(value.bo)) return false
  return isOptional(value, 'advanceCount', isPositiveInteger)
    && isOptional(value, 'groups', item => Array.isArray(item) && item.every(isGroupConfig))
    && isOptional(value, 'rounds', isPositiveInteger)
    && isOptional(value, 'swissTeamIds', isStringArray)
    && isOptional(value, 'swissSize', item => item === 8 || item === 16)
    && isOptional(value, 'advanceWins', isPositiveInteger)
    && isOptional(value, 'eliminateLosses', isPositiveInteger)
    && isOptional(value, 'roundBo', isBORecord)
    && isOptional(value, 'confirmedRounds', item => Array.isArray(item) && item.every(isFiniteInteger))
    && isOptional(value, 'bracketTeamIds', isStringArray)
    && isOptional(value, 'include3rdPlace', item => typeof item === 'boolean')
    && isOptional(value, 'confirmedBracket', item => typeof item === 'boolean')
}

export function isPhase(value: unknown): value is Phase {
  return isEntity(value)
    && typeof value.name === 'string'
    && typeof value.type === 'string' && PHASE_TYPES.has(value.type)
    && typeof value.status === 'string' && PHASE_STATUSES.has(value.status)
    && isFiniteInteger(value.order) && value.order >= 0
    && isPhaseConfig(value.config)
}

function isMatchResult(value: unknown): boolean {
  return isRecord(value)
    && isFiniteInteger(value.team1Score) && value.team1Score >= 0
    && isFiniteInteger(value.team2Score) && value.team2Score >= 0
}

function isGameData(value: unknown): boolean {
  return isRecord(value)
    && typeof value.duration === 'string'
    && typeof value.winner === 'string'
    && (value.winner === 'team1' || value.winner === 'team2')
    && Array.isArray(value.team1Players)
    && Array.isArray(value.team2Players)
}

function isNullableStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => item === null || typeof item === 'string')
}

export function isMatch(value: unknown): value is Match {
  return isEntity(value)
    && typeof value.phaseId === 'string'
    && isFiniteInteger(value.round)
    && typeof value.team1Id === 'string'
    && typeof value.team2Id === 'string'
    && (value.result === null || isMatchResult(value.result))
    && (!('bracketPosition' in value) || value.bracketPosition === undefined || (isFiniteInteger(value.bracketPosition) && value.bracketPosition >= 0))
    && (!('winnerId' in value) || value.winnerId === undefined || typeof value.winnerId === 'string')
    && isNullableStringArray(value.riotMatchIds)
    && (!('games' in value) || value.games === undefined || (Array.isArray(value.games) && value.games.every(item => item === null || isGameData(item))))
    && isOptional(value, 'scheduledAt', item => typeof item === 'string')
    && isOptional(value, 'tournamentCodes', isStringArray)
    && isOptional(value, 'tournamentCodesGeneratedAt', item => typeof item === 'string')
    && isOptional(value, 'tournamentCallbackToken', item => typeof item === 'string')
}

export function isTeamArray(value: unknown): value is Team[] {
  return Array.isArray(value) && value.every(isTeam)
}

export function isPhaseArray(value: unknown): value is Phase[] {
  return Array.isArray(value) && value.every(isPhase)
}

export function isMatchArray(value: unknown): value is Match[] {
  return Array.isArray(value) && value.every(isMatch)
}

export function isNonEmptyMatchArray(value: unknown): value is Match[] {
  return isMatchArray(value) && value.length > 0
}

export function isTournamentStatus(value: unknown): value is { providerId?: number; configured?: boolean } {
  return isRecord(value)
    && isOptional(value, 'providerId', item => typeof item === 'number' && Number.isFinite(item))
    && isOptional(value, 'configured', item => typeof item === 'boolean')
}

export function isTournamentCodesResponse(value: unknown): value is { codes: string[]; regenerated: boolean } {
  return isRecord(value) && isStringArray(value.codes) && value.codes.length > 0 && typeof value.regenerated === 'boolean'
}

export function isLobbyEventArray(value: unknown): value is LobbyEvent[] {
  return Array.isArray(value) && value.every(item => isRecord(item)
    && typeof item.eventType === 'string'
    && typeof item.timestamp === 'string'
    && isOptional(item, 'puuid', candidate => typeof candidate === 'string'))
}

export function isGeneratedMatchesResponse(value: unknown): value is { created: number } {
  return isRecord(value) && isFiniteInteger(value.created) && value.created >= 0
}

export function isPathResponse(value: unknown): value is { path: string } {
  return isRecord(value) && typeof value.path === 'string' && value.path.length > 0
}
