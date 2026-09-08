import { RIOT_REGION, TOURNAMENT_API_MODE } from './env'
import db from './db'
import type { TournamentConfig, LobbyEvent, TournamentCodeDetails } from './types'
import { getRiotApiKey } from './data'
export const TOURNAMENT_BASE = `https://${RIOT_REGION.toLowerCase()}.api.riotgames.com/lol/${
  TOURNAMENT_API_MODE === 'production' ? 'tournament' : 'tournament-stub'
}/v5`

const REQUEST_TIMEOUT_MS = 10_000
const MAX_GET_ATTEMPTS = 3

export type TournamentMapType = 'SUMMONERS_RIFT' | 'HOWLING_ABYSS' | 'LEAGUE_CLASSIC'
export type TournamentPickType = 'BLIND_PICK' | 'DRAFT_MODE' | 'ALL_RANDOM' | 'TOURNAMENT_DRAFT'
export type TournamentSpectatorType = 'NONE' | 'LOBBYONLY' | 'ALL'

export interface TournamentCodeOptions {
  mapType?: TournamentMapType
  pickType?: TournamentPickType
  spectatorType?: TournamentSpectatorType
  teamSize?: number
  allowedParticipants?: string[]
  enoughPlayers?: boolean
  metadata?: string
}

export interface TournamentGame {
  startTime: number
  winningTeam: { puuid: string }[]
  losingTeam: { puuid: string }[]
  shortCode: string
  metaData: string
  gameId: number
  gameName: string
  gameType: string
  gameMap: number
  gameMode: string
  region: string
}

/** Error returned by Riot, retaining the status so callers can distinguish an expired code (404). */
export class TournamentApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'TournamentApiError'
  }
}

async function tournamentFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const apiKey = getRiotApiKey()
  if (!apiKey) throw new TournamentApiError(401, 'Riot API key no configurada')

  const method = options?.method?.toUpperCase() ?? 'GET'
  const attempts = method === 'GET' ? MAX_GET_ATTEMPTS : 1
  let res: Response | undefined

  for (let attempt = 1; attempt <= attempts; attempt++) {
    res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'X-Riot-Token': apiKey,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (res.ok || attempt === attempts || (res.status !== 429 && res.status < 500)) break

    const retryAfterSeconds = Number.parseFloat(res.headers.get('Retry-After') ?? '')
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.max(0, retryAfterSeconds * 1_000)
      : 250 * (2 ** (attempt - 1))
    await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 5_000)))
  }

  if (!res) throw new TournamentApiError(503, 'Tournament API no respondió')

  if (!res.ok) {
    const body = await res.text()
    throw new TournamentApiError(res.status, `Tournament API error ${res.status}: ${body}`)
  }

  if (res.status === 204) return undefined as T
  const body = await res.text()
  return (body ? JSON.parse(body) : undefined) as T
}

// ── Provider & Tournament registration ──────────────────────────────────────

export async function registerProvider(callbackUrl: string, region: string): Promise<number> {
  return tournamentFetch<number>(`${TOURNAMENT_BASE}/providers`, {
    method: 'POST',
    body: JSON.stringify({ url: callbackUrl, region }),
  })
}

export async function createTournament(providerId: number, name: string): Promise<number> {
  return tournamentFetch<number>(`${TOURNAMENT_BASE}/tournaments`, {
    method: 'POST',
    body: JSON.stringify({ providerId, name }),
  })
}

// ── Tournament codes ────────────────────────────────────────────────────────

export async function generateCodes(
  tournamentId: number,
  count: number,
  options?: TournamentCodeOptions
): Promise<string[]> {
  const body = {
    mapType: options?.mapType ?? 'SUMMONERS_RIFT',
    pickType: options?.pickType ?? 'TOURNAMENT_DRAFT',
    spectatorType: options?.spectatorType ?? 'ALL',
    teamSize: options?.teamSize ?? 5,
    enoughPlayers: options?.enoughPlayers ?? true,
    ...(options?.allowedParticipants ? { allowedParticipants: options.allowedParticipants } : {}),
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  }

  return tournamentFetch<string[]>(
    `${TOURNAMENT_BASE}/codes?tournamentId=${tournamentId}&count=${count}`,
    { method: 'POST', body: JSON.stringify(body) }
  )
}

export async function getCodeDetails(code: string): Promise<TournamentCodeDetails> {
  return tournamentFetch<TournamentCodeDetails>(`${TOURNAMENT_BASE}/codes/${encodeURIComponent(code)}`)
}

export async function updateCode(code: string, options: Pick<TournamentCodeOptions,
  'mapType' | 'pickType' | 'spectatorType' | 'allowedParticipants'>): Promise<void> {
  await tournamentFetch<unknown>(`${TOURNAMENT_BASE}/codes/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(options),
  })
}

export async function getGamesByCode(code: string): Promise<TournamentGame[]> {
  if (TOURNAMENT_API_MODE !== 'production') return []
  return tournamentFetch<TournamentGame[]>(
    `${TOURNAMENT_BASE}/games/by-code/${encodeURIComponent(code)}`
  )
}

// ── Lobby events ────────────────────────────────────────────────────────────

export async function getLobbyEvents(code: string): Promise<LobbyEvent[]> {
  const data = await tournamentFetch<{ eventList: LobbyEvent[] }>(
    `${TOURNAMENT_BASE}/lobby-events/by-code/${encodeURIComponent(code)}`
  )
  return data.eventList
}

// ── Config persistence ──────────────────────────────────────────────────────

export function getTournamentConfig(): TournamentConfig | null {
  const row = db.prepare('SELECT data FROM tournament_config WHERE key = ?').get('config') as { data: string } | undefined
  return row ? JSON.parse(row.data) as TournamentConfig : null
}

export function saveTournamentConfig(config: TournamentConfig): void {
  db.prepare(
    'INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)'
  ).run('config', JSON.stringify(config))
}

/** Remove the registered Riot tournament while keeping other settings (such as the API key). */
export function deleteTournamentConfig(): void {
  db.prepare('DELETE FROM tournament_config WHERE key = ?').run('config')
}
