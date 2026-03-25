import type { RiotSummoner, RiotLeagueEntry, PlayerStats } from './types'
import { RIOT_REGION, MATCH_CLUSTER } from './env'
import { getRiotApiKey } from './data'

const REGION = RIOT_REGION

const BASE = `https://${REGION}.api.riotgames.com`
const MATCH_BASE = `https://${MATCH_CLUSTER}.api.riotgames.com`

export { MATCH_CLUSTER }

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>()
const TTL_MS = 10 * 60 * 1000 // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { cache.delete(key); return null }
  return entry.data as T
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + TTL_MS })
}

async function riotFetch<T>(url: string): Promise<T> {
  const cached = getCached<T>(url)
  if (cached) return cached

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': getRiotApiKey() },
      next: { revalidate: 0 },
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    if (!res.ok) {
      throw new Error(`Riot API error ${res.status}: ${url}`)
    }

    const data = await res.json() as T
    setCached(url, data)
    return data
  }

  throw new Error(`Riot API rate limited after 3 retries: ${url}`)
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
