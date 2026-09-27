import { publicEntityTournament, inTournament } from '@/lib/public-competition'
import CompetitionBadge from '@/components/CompetitionBadge'
import { notFound } from 'next/navigation'
import { getTeams, getMatches, getPhases, getPlayerStatsCache } from '@/lib/data'
import { getPublishedMatch, getPublishedMatches } from '@/lib/publication'
import { getPlayerMastery, getChampionStats, getTopRecentChampions } from '@/lib/data-riot'
import { getVersion } from '@/lib/ddragon'
import CompareClient from '@/components/CompareClient'
import type { PlayerRow } from '@/lib/types'
import type { PlayerChampionData } from '@/components/ChampionBubbles'

export const dynamic = 'force-dynamic'

function currentTimestamp() { return Date.now() }

async function OverlayPartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const phases = getPhases()
  const allMatches = getMatches()
  const match = getPublishedMatch(id, phases, allMatches)
  if (!match) notFound()

  const allTeams = getTeams()
  const teams = allTeams.filter(t => t.id === match.team1Id || t.id === match.team2Id)
  const matches = getPublishedMatches(phases, allMatches)

  if (match.game === 'valorant') return <div className="p-6"><h1>{teams.map(t => t.name).join(' vs ')}</h1><p>{match.result ? `${match.result.team1Score} : ${match.result.team2Score}` : 'Pendiente'}</p>{match.maps?.map((m, i) => <p key={i}>{m.map ?? `Mapa ${i + 1}`}: {m.team1Rounds} : {m.team2Rounds}</p>)}</div>
  const cache = getPlayerStatsCache()
  const playerMap = new Map(cache.players.map(p => [p.playerId, p]))

  const allStats: Record<string, PlayerRow[]> = {}
  for (const team of teams) {
    allStats[team.id] = team.players
      .map(p => playerMap.get(p.id))
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
      const mastery = getPlayerMastery(player.id)
      const season = getChampionStats(player.id, seasonStartMs, 420, 20)
      const recent = getTopRecentChampions(player.id, 20, 6)
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

export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tournament?: string }> }) {
  const { id } = await props.params
  const tournament = publicEntityTournament('matches', id)
  const search = await props.searchParams
  if (search.tournament && search.tournament !== tournament.id) notFound()
  const content = await inTournament(tournament.id, () => OverlayPartidoPage(props))
  return <><div className="px-6 pt-4"><CompetitionBadge game={tournament.game} name={tournament.name} /></div>{content}</>
}
