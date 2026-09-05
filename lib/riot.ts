import type { RiotSummoner, RiotLeagueEntry, PlayerStats } from './types'
import { RIOT_REGION, MATCH_CLUSTER } from './env'
import { getRiotApiKey } from './data'

export class RiotApiKeyError extends Error {
  constructor(status: number) {
    super(`Riot API key invalid or expired (HTTP ${status})`)
    this.name = 'RiotApiKeyError'
  }
}

export class RiotApiTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Riot API request timed out after ${timeoutMs}ms: ${url}`)
    this.name = 'RiotApiTimeoutError'
  }
}

const REGION = RIOT_REGION

const BASE = `https://${REGION}.api.riotgames.com`
const MATCH_BASE = `https://${MATCH_CLUSTER}.api.riotgames.com`

export { MATCH_CLUSTER }

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>()
const TTL_MS = 10 * 60 * 1000 // 10 minutes
const REQUEST_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1_000

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { cache.delete(key); return null }
  return entry.data as T
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + TTL_MS })
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const retryAt = Date.parse(value)
  if (Number.isNaN(retryAt)) return null
  return Math.max(0, retryAt - Date.now())
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** attempt
  return Math.max(exponential, retryAfterMs(retryAfter) ?? 0)
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function riotFetch<T>(url: string): Promise<T> {
  const cached = getCached<T>(url)
  if (cached) return cached

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, {
        headers: { 'X-Riot-Token': getRiotApiKey() },
        next: { revalidate: 0 },
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeout)
      const requestError = controller.signal.aborted
        ? new RiotApiTimeoutError(url, REQUEST_TIMEOUT_MS)
        : error
      throw requestError
    }
    if (res.status === 429) {
      clearTimeout(timeout)
      if (attempt === MAX_ATTEMPTS - 1) {
        throw new Error(`Riot API rate limited after ${MAX_ATTEMPTS} attempts: ${url}`)
      }
      await wait(backoffMs(attempt, res.headers.get('Retry-After')))
      continue
    }

    if (res.status === 401 || res.status === 403) {
      clearTimeout(timeout)
      throw new RiotApiKeyError(res.status)
    }

    if (!res.ok) {
      clearTimeout(timeout)
      throw new Error(`Riot API error ${res.status}: ${url}`)
    }

    try {
      const data = await res.json() as T
      clearTimeout(timeout)
      setCached(url, data)
      return data
    } catch (error) {
      clearTimeout(timeout)
      if (controller.signal.aborted) {
        throw new RiotApiTimeoutError(url, REQUEST_TIMEOUT_MS)
      }
      throw error
    }
  }

  throw new Error(`Riot API request failed after ${MAX_ATTEMPTS} attempts: ${url}`)
}

export async function getSummonerByRiotId(name: string, tag: string): Promise<RiotSummoner> {
  // New endpoint: account-v1 for PUUID, then summoner-v4 by PUUID
  const accountUrl = `https://${MATCH_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  const account = await riotFetch<{ puuid: string; gameName: string; tagLine: string }>(accountUrl)

  const summonerUrl = `${BASE}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
  const summoner = await riotFetch<RiotSummoner>(summonerUrl)
  return summoner
}

export async function getSummonerByName(nameTag: string): Promise<RiotSummoner> {
  const [name, tag] = nameTag.includes('#') ? nameTag.split('#').map(s => s.trim()) : [nameTag.trim(), REGION.toUpperCase()]
  return getSummonerByRiotId(name, tag)
}

export async function getRankedStats(puuid: string): Promise<RiotLeagueEntry | null> {
  const url = `${BASE}/lol/league/v4/entries/by-puuid/${puuid}`
  const entries = await riotFetch<RiotLeagueEntry[]>(url)
  return entries.find(e => e.queueType === 'RANKED_SOLO_5x5') ?? null
}

export async function getChampionMastery(puuid: string, count = 50) {
  const url = `${BASE}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`
  return riotFetch<Array<{
    championId: number; championLevel: number; championPoints: number; lastPlayTime: number
  }>>(url)
}

export async function getMatchIds(puuid: string, count = 20, startTime?: number): Promise<string[]> {
  let url = `${MATCH_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&count=${count}`
  if (startTime) url += `&startTime=${startTime}`
  return riotFetch<string[]>(url)
}

export async function getMatchDetails(matchId: string): Promise<unknown> {
  const url = `${MATCH_BASE}/lol/match/v5/matches/${matchId}`
  return riotFetch<unknown>(url)
}

export async function getPlayerStats(nameTag: string): Promise<PlayerStats> {
  const [name, tag] = nameTag.includes('#') ? nameTag.split('#').map(s => s.trim()) : [nameTag.trim(), REGION.toUpperCase()]

  const accountUrl = `https://${MATCH_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  const account = await riotFetch<{ puuid: string; gameName: string; tagLine: string }>(accountUrl)

  const summonerUrl = `${BASE}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
  const summoner = await riotFetch<RiotSummoner>(summonerUrl)

  const ranked = await getRankedStats(account.puuid)

  return {
    summonerName: nameTag,
    puuid: account.puuid,
    profileIconId: summoner.profileIconId,
    level: summoner.summonerLevel,
    tier: ranked?.tier ?? 'UNRANKED',
    rank: ranked?.rank ?? 'I',
    lp: ranked?.leaguePoints ?? 0,
    wins: ranked?.wins ?? 0,
    losses: ranked?.losses ?? 0,
    winrate: ranked ? Math.round((ranked.wins / (ranked.wins + ranked.losses)) * 100) : 0,
  }
}
