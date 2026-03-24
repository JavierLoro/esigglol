import { MATCH_CLUSTER, RIOT_API_KEY } from './env'
import db from './db'
import type { TournamentConfig, LobbyEvent } from './types'

const API_KEY = RIOT_API_KEY
const TOURNAMENT_BASE = `https://${MATCH_CLUSTER}.api.riotgames.com/lol/tournament-stub/v5`

async function tournamentFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Riot-Token': API_KEY,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Tournament API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
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
  options?: {
    mapType?: string
    pickType?: string
    spectatorType?: string
    teamSize?: number
    allowedParticipants?: string[]
  }
): Promise<string[]> {
  const body = {
    mapType: options?.mapType ?? 'SUMMONERS_RIFT',
    pickType: options?.pickType ?? 'TOURNAMENT_DRAFT',
    spectatorType: options?.spectatorType ?? 'ALL',
    teamSize: options?.teamSize ?? 5,
    ...(options?.allowedParticipants ? { allowedSummonerIds: options.allowedParticipants } : {}),
  }

  return tournamentFetch<string[]>(
    `${TOURNAMENT_BASE}/codes?tournamentId=${tournamentId}&count=${count}`,
    { method: 'POST', body: JSON.stringify(body) }
  )
}

export async function getCodeDetails(code: string): Promise<unknown> {
  return tournamentFetch<unknown>(`${TOURNAMENT_BASE}/codes/${encodeURIComponent(code)}`)
}

// ── Lobby events ────────────────────────────────────────────────────────────

export async function getLobbyEvents(code: string): Promise<LobbyEvent[]> {
  const data = await tournamentFetch<{ events: LobbyEvent[] }>(
    `${TOURNAMENT_BASE}/lobby-events/by-code/${encodeURIComponent(code)}`
  )
  return data.events
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
