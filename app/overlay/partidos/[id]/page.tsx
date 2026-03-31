import { notFound } from 'next/navigation'
import { getMatchById, getTeams, getMatches, getPlayerStatsCache } from '@/lib/data'
import { getPlayerMastery, getChampionStats, getTopRecentChampions } from '@/lib/data-riot'
import { getVersion } from '@/lib/ddragon'
import CompareClient from '@/components/CompareClient'
import type { PlayerRow } from '@/lib/types'
import type { PlayerChampionData } from '@/components/ChampionBubbles'

export const dynamic = 'force-dynamic'

function currentTimestamp() { return Date.now() }

export default async function OverlayPartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const match = getMatchById(id)
  if (!match) notFound()

  const allTeams = getTeams()
  const teams = allTeams.filter(t => t.id === match.team1Id || t.id === match.team2Id)
  const matches = getMatches()

  const cache = getPlayerStatsCache()
  const playerMap = new Map(cache.players.map(p => [p.summonerName, p]))

  const allStats: Record<string, PlayerRow[]> = {}
  for (const team of teams) {
    allStats[team.id] = team.players
      .map(p => playerMap.get(p.summonerName))
      .filter((p): p is PlayerRow => p != null)
  }

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
      <CompareClient
        teams={teams}
        allStats={allStats}
        matches={matches}
        lastUpdated={cache.lastUpdated}
        champData={champData}
        isAdmin={false}
      />
    </div>
  )
}
