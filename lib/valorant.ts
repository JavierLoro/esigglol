import { z } from 'zod'

export type Availability = 'available' | 'missing-key' | 'unauthorized' | 'forbidden' | 'rate-limited' | 'not-found' | 'temporary-error' | 'invalid-data'
export type OfficialData<T> = { source: 'Riot Games'; fetchedAt: string; availability: Availability; httpStatus?: number; retryAfter?: string; data?: T }
const account = z.object({ puuid: z.string(), gameName: z.string().optional(), tagLine: z.string().optional() })
const content = z.object({ version: z.string(), acts: z.array(z.object({ id: z.string(), name: z.string(), isActive: z.boolean(), type: z.string().optional() })), maps: z.array(z.object({ id: z.string(), name: z.string() })) })
const history = z.object({ puuid: z.string(), history: z.array(z.object({ matchId: z.string(), gameStartTimeMillis: z.number(), queueId: z.string() })) })
const match = z.object({ matchInfo: z.object({ matchId: z.string(), mapId: z.string(), seasonId: z.string().optional(), isRanked: z.boolean().optional() }), players: z.array(z.object({ puuid: z.string(), competitiveTier: z.number().optional(), teamId: z.string() })) })
const leaderboard = z.object({ actId: z.string(), totalPlayers: z.number(), players: z.array(z.object({ puuid: z.string().optional(), leaderboardRank: z.number(), rankedRating: z.number(), competitiveTier: z.number().optional(), gameName: z.string().optional(), tagLine: z.string().optional(), isAnonymized: z.boolean().optional(), numberOfWins: z.number().optional(), playerCardID: z.string().optional() })) })
export type ValorantLeaderboard = z.infer<typeof leaderboard>

/** Independent credentials and fixed EU PC routing. Never logs Riot bodies or secrets. */
export class ValorantClient {
  constructor(private readonly key = process.env.VALORANT_API_KEY ?? '', private readonly transport: typeof fetch = fetch) {}
  private async get<S extends z.ZodType>(host: 'eu' | 'europe', path: string, schema: S): Promise<OfficialData<z.infer<S>>> {
    const base = { source: 'Riot Games' as const, fetchedAt: new Date().toISOString() }
    if (!this.key) return { ...base, availability: 'missing-key' }
    try {
      const response = await this.transport(`https://${host}.api.riotgames.com${path}`, { headers: { 'X-Riot-Token': this.key }, cache: 'no-store', signal: AbortSignal.timeout(10_000), redirect: 'error' })
      if (!response.ok) return { ...base, httpStatus: response.status, availability: response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 429 ? 'rate-limited' : response.status === 404 ? 'not-found' : 'temporary-error', ...(response.headers.get('retry-after') ? { retryAfter: response.headers.get('retry-after')! } : {}) }
      const parsed = schema.safeParse(await response.json().catch(() => null))
      return parsed.success ? { ...base, httpStatus: response.status, availability: 'available', data: parsed.data } : { ...base, httpStatus: response.status, availability: 'invalid-data' }
    } catch { return { ...base, availability: 'temporary-error' } }
  }
  account(gameName: string, tagLine: string) { return this.get('europe', `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, account) }
  content() { return this.get('eu', '/val/content/v1/contents?locale=es-ES', content) }
  history(puuid: string) { return this.get('eu', `/val/match/v1/matchlists/by-puuid/${encodeURIComponent(puuid)}`, history) }
  match(id: string) { return this.get('eu', `/val/match/v1/matches/${encodeURIComponent(id)}`, match) }
  leaderboard(actId: string, startIndex = 0) { return this.get('eu', `/val/ranked/v1/leaderboards/by-act/${encodeURIComponent(actId)}?size=200&startIndex=${Math.max(0, Math.floor(startIndex))}`, leaderboard) }
}

export interface CompetitiveProfile {
  playerId: string
  availability: 'available' | 'unavailable'
  source: 'Riot Games'
  actId: string
  fetchedAt?: string
  rankedRating?: number
  leaderboardRank?: number
}
/** Missing from a leaderboard page means unavailable, never unranked. */
export function competitiveProfile(playerId: string, puuid: string, actId: string, result: OfficialData<ValorantLeaderboard>): CompetitiveProfile {
  const entry = result.availability === 'available' && result.data?.actId === actId ? result.data.players.find(p => p.puuid === puuid) : undefined
  return entry ? { playerId, actId, source: 'Riot Games', availability: 'available', fetchedAt: result.fetchedAt, rankedRating: entry.rankedRating, leaderboardRank: entry.leaderboardRank } : { playerId, actId, source: 'Riot Games', availability: 'unavailable' }
}
export function rankComparable(profiles: CompetitiveProfile[], actId: string) {
  return profiles.map(p => p.actId === actId && p.availability === 'available' ? p : { ...p, availability: 'unavailable' as const, rankedRating: undefined, leaderboardRank: undefined }).sort((a, b) => (a.leaderboardRank ?? Infinity) - (b.leaderboardRank ?? Infinity))
}
export function retainOfficialData<T>(previous: OfficialData<T> | undefined, next: OfficialData<T>): OfficialData<T> & { lastAttemptAt: string } {
  return { ...next, ...(next.availability !== 'available' && previous?.data ? { data: previous.data, fetchedAt: previous.fetchedAt } : {}), lastAttemptAt: next.fetchedAt }
}

/** Intentionally closed: adding an environment flag cannot bypass missing RSO consent. */
export const VALORANT_PERSONAL_DATA_PUBLIC = false

export async function checkValorantAccess(input: { riotId?: string; puuid?: string; matchId?: string; actId?: string }, client = new ValorantClient()) {
  const checks: Array<{ endpoint: string; result: OfficialData<unknown> }> = [{ endpoint: 'content', result: await client.content() }]
  if (input.riotId?.includes('#')) {
    const split = input.riotId.lastIndexOf('#')
    checks.push({ endpoint: 'account', result: await client.account(input.riotId.slice(0, split), input.riotId.slice(split + 1)) })
  }
  if (input.puuid) checks.push({ endpoint: 'history', result: await client.history(input.puuid) })
  if (input.matchId) checks.push({ endpoint: 'match', result: await client.match(input.matchId) })
  if (input.actId) checks.push({ endpoint: 'leaderboard', result: await client.leaderboard(input.actId) })
  return checks.map(({ endpoint, result }) => ({ endpoint, source: result.source, fetchedAt: result.fetchedAt, availability: result.availability, httpStatus: result.httpStatus, retryAfter: result.retryAfter }))
}
