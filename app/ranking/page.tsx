import { after } from 'next/server'
import { getPlayerStatsCache, getTeams } from '@/lib/data'
import { triggerAutoRefresh } from '@/lib/refresh'
import RankingTable from '@/components/PlayerRankingTable'
import RefreshStatsButton from '@/components/RefreshStatsButton'
import type { PlayerRow } from '@/lib/types'

export const revalidate = 60

const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 14, GRANDMASTER: 13, MASTER: 12,
  DIAMOND: 11, EMERALD: 10, PLATINUM: 9, GOLD: 8,
  SILVER: 7, BRONZE: 6, IRON: 5, UNRANKED: 0,
}
const RANK_ORDER: Record<string, number> = { I: 4, II: 3, III: 2, IV: 1 }

export default async function RankingPage() {
  after(triggerAutoRefresh)

  const cache = getPlayerStatsCache()
  const teams = getTeams()
  const teamLookup = new Map(teams.map(t => [t.id, { logo: t.logo, name: t.name }]))

  const normalizeName = (name: string) => name.trim().replace(/\s*#\s*/g, '#').toLowerCase()

  const roleLookup = new Map(
    teams.flatMap(t =>
      (t.players ?? []).map(p => [normalizeName(p.summonerName), { primaryRole: p.primaryRole, secondaryRole: p.secondaryRole }])
    )
  )

  const seenInCache = new Map<string, PlayerRow>()
  for (const r of cache.players) {
    const key = normalizeName(r.summonerName)
    if (!seenInCache.has(key)) seenInCache.set(key, r)
  }
  const cachedNames = new Set(seenInCache.keys())
  const cachedRows = Array.from(seenInCache.values()).map(r => {
    const t = teamLookup.get(r.teamId)
    if (t) { r.teamLogo = t.logo ?? ''; r.teamName = t.name }
    const roles = roleLookup.get(normalizeName(r.summonerName))
    if (roles) { r.primaryRole = roles.primaryRole; r.secondaryRole = roles.secondaryRole }
    return r
  })

  const pendingRows: PlayerRow[] = teams.flatMap(team =>
    (team.players ?? [])
      .filter(p => !cachedNames.has(normalizeName(p.summonerName)))
      .map(p => ({
        summonerName: p.summonerName,
        puuid: '',
        profileIconId: 0,
        level: 0,
        tier: 'UNRANKED' as const,
        rank: 'IV' as const,
        lp: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
        teamId: team.id,
        teamName: team.name,
        teamLogo: team.logo ?? '',
        primaryRole: p.primaryRole,
        secondaryRole: p.secondaryRole,
        apiError: false,
      }))
  )

  const rows = [...cachedRows, ...pendingRows].sort((a, b) => {
    if (a.apiError !== b.apiError) return a.apiError ? 1 : -1
    const tierDiff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0)
    if (tierDiff !== 0) return tierDiff
    const rankDiff = (RANK_ORDER[b.rank] ?? 0) - (RANK_ORDER[a.rank] ?? 0)
    if (rankDiff !== 0) return rankDiff
    return b.lp - a.lp
  })

  const anyFailed = rows.some(r => r.apiError)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Ranking de jugadores</h1>
        <RefreshStatsButton lastUpdated={cache.lastUpdated} />
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-white/10 p-8 text-center text-white/40 text-sm">
          Sin datos. Pulsa &quot;Actualizar datos&quot; para cargar los stats desde la Riot API.
        </div>
      )}

      {anyFailed && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
          Algunos jugadores no pudieron cargarse. Los datos pueden estar temporalmente no disponibles — inténtalo de nuevo más tarde.
        </div>
      )}

      {rows.length > 0 && <RankingTable rows={rows} />}
    </div>
  )
}
