import { getTeams, getMatches, getPlayerStatsCache } from '@/lib/data'
import { getPlayerMastery, getChampionStats, getTopRecentChampions } from '@/lib/data-riot'
import { getVersion } from '@/lib/ddragon'
import { getSessionFromCookies } from '@/lib/auth'
import CompareClient from '@/components/CompareClient'
import type { PlayerRow } from '@/lib/types'
import type { PlayerChampionData } from '@/components/ChampionBubbles'

export const dynamic = 'force-dynamic'

function currentTimestamp() { return Date.now() }

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ t1?: string; t2?: string }>
}) {
  const { t1, t2 } = await searchParams
  const isAdmin = await getSessionFromCookies()
  const teams = getTeams()
  const matches = getMatches()

  const cache = getPlayerStatsCache()
  const allPlayers = cache.players

  const normalizeName = (name: string) => name.trim().replace(/\s*#\s*/g, '#').toLowerCase()
  const playerMap = new Map(allPlayers.map(p => [normalizeName(p.summonerName), p]))

  const allStats: Record<string, PlayerRow[]> = {}
  for (const team of teams) {
    allStats[team.id] = (team.players ?? []).map(p => {
      const cached = playerMap.get(normalizeName(p.summonerName))
      if (cached) return { ...cached, primaryRole: p.primaryRole, secondaryRole: p.secondaryRole }
      return {
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
      }
    })
  }

  // Build champion data for all players
  const ddragonVersion = getVersion()
  const iconBaseUrl = ddragonVersion
    ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion`
    : ''

  const champData: Record<string, PlayerChampionData> = {}
  const seasonStartMs = currentTimestamp() - 30 * 24 * 60 * 60 * 1000
  for (const team of teams) {
    for (const player of team.players) {
      const mastery = getPlayerMastery(player.summonerName)
      const season = getChampionStats(player.summonerName, seasonStartMs, 420, 20)
      const recent = getTopRecentChampions(player.summonerName, 20, 6)
      if (mastery.length > 0 || season.length > 0 || recent.length > 0) {
        champData[player.summonerName] = { mastery, season, recent, iconBaseUrl }
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Comparar equipos</h1>
      <CompareClient teams={teams} allStats={allStats} matches={matches} lastUpdated={cache.lastUpdated} champData={champData} isAdmin={isAdmin} initialTeam1Id={t1} initialTeam2Id={t2} />
    </div>
  )
}
