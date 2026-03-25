import { getPlayerStatsCache, getTeams } from '@/lib/data'
import RankingTable from '@/components/PlayerRankingTable'
import RefreshStatsButton from '@/components/RefreshStatsButton'
import type { PlayerRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 14, GRANDMASTER: 13, MASTER: 12,
  DIAMOND: 11, EMERALD: 10, PLATINUM: 9, GOLD: 8,
  SILVER: 7, BRONZE: 6, IRON: 5, UNRANKED: 0,
}
const RANK_ORDER: Record<string, number> = { I: 4, II: 3, III: 2, IV: 1 }

export default function RankingPage() {
  const cache = getPlayerStatsCache()
  const teams = getTeams()
  const teamLookup = new Map(teams.map(t => [t.id, { logo: t.logo, name: t.name }]))

  // Jugadores en cache (actualizar teamName/logo por si cambió)
  const cachedNames = new Set(cache.players.map(r => r.summonerName))
  const cachedRows = cache.players.map(r => {
    const t = teamLookup.get(r.teamId)
    if (t) { r.teamLogo = t.logo ?? ''; r.teamName = t.name }
    return r
  })

  // Jugadores en el roster que aún no tienen datos en cache
  const pendingRows: PlayerRow[] = teams.flatMap(team =>
    (team.players ?? [])
      .filter(p => !cachedNames.has(p.summonerName))
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
          Algunos jugadores no pudieron cargarse desde la Riot API.
          Comprueba que la key en <code className="font-mono">.env.local</code> es válida y no ha expirado (caducan cada 24h).
          Revisa los logs del servidor para el error exacto.
        </div>
      )}

      {rows.length > 0 && <RankingTable rows={rows} />}
    </div>
  )
}
