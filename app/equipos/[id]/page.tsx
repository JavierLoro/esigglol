import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeams, getPlayerStatsCache } from '@/lib/data'
import RefreshStatsButton from '@/components/RefreshStatsButton'
import { getPlayerMastery, getChampionStats, getTopRecentChampions } from '@/lib/data-riot'
import { getVersion } from '@/lib/ddragon'
import { ChampionBubbles, type PlayerChampionData } from '@/components/ChampionBubbles'
import type { Player } from '@/lib/types'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

const TIER_COLORS: Record<string, string> = {
  CHALLENGER: 'text-yellow-300',
  GRANDMASTER: 'text-red-400',
  MASTER: 'text-purple-400',
  DIAMOND: 'text-blue-400',
  EMERALD: 'text-emerald-400',
  PLATINUM: 'text-cyan-400',
  GOLD: 'text-yellow-400',
  SILVER: 'text-slate-400',
  BRONZE: 'text-amber-700',
  IRON: 'text-zinc-500',
  UNRANKED: 'text-white/30',
}

const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente']

interface CachedPlayer {
  summonerName: string
  profileIconId?: number
  tier: string
  rank: string
  lp: number
  wins: number
  losses: number
  winrate: number
  level: number
  apiError?: boolean
}

function PlayerCard({
  player,
  stats,
  champData,
}: {
  player: Player
  stats: CachedPlayer | undefined
  champData: PlayerChampionData | null
}) {
  const hasStats = stats && !stats.apiError
  const isUnranked = hasStats && stats.tier === 'UNRANKED'

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0e1117] flex flex-col">
      {/* Role + name header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/35">
          {player.primaryRole}
          {player.secondaryRole && <span className="text-white/20"> / {player.secondaryRole}</span>}
        </span>
      </div>

      {/* Player info */}
      <div className="flex flex-col gap-3 px-4 py-4 flex-1">
        <div className="flex items-center gap-3">
          {stats?.profileIconId ? (
            <Image src={`/ddragon/profileicon/${stats.profileIconId}.png`} alt="" width={40} height={40} className="rounded-lg shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-base text-white leading-tight">
              {player.summonerName.split('#')[0]}
            </span>
            <span className="text-xs text-white/30">#{player.summonerName.split('#')[1]}</span>
          </div>
        </div>

        {/* Stats */}
        {!stats || stats.apiError ? (
          <span className="text-xs text-white/20 italic">Sin datos de la Riot API</span>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Rank */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Rango</span>
              <span className={clsx('text-sm font-bold flex items-center gap-1.5', TIER_COLORS[stats.tier])}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/ddragon/ranked/${stats.tier.toLowerCase()}.svg`} alt={stats.tier} className="w-8 h-8 shrink-0" />
                {isUnranked ? 'Unranked' : `${stats.tier} ${stats.rank}`}
              </span>
            </div>

            {/* LP */}
            {!isUnranked && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">LP</span>
                <span className="text-sm font-semibold text-white/80">{stats.lp}</span>
              </div>
            )}

            {/* W/L */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Partidas</span>
              <span className="text-xs text-white/70">
                <span className="text-green-400 font-medium">{stats.wins}V</span>
                <span className="text-white/20 mx-1">/</span>
                <span className="text-red-400/80 font-medium">{stats.losses}D</span>
              </span>
            </div>

            {/* Winrate */}
            {(stats.wins + stats.losses) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Winrate</span>
                <span className={clsx(
                  'text-sm font-semibold',
                  stats.winrate >= 55 ? 'text-green-400' : stats.winrate >= 50 ? 'text-white/70' : 'text-red-400/70'
                )}>
                  {stats.winrate}%
                </span>
              </div>
            )}

            {/* Level */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Nivel</span>
              <span className="text-xs text-white/50">{stats.level}</span>
            </div>
          </div>
        )}
      </div>

      {/* Champion bubbles */}
      {champData && <ChampionBubbles data={champData} />}
    </div>
  )
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teams = getTeams()
  const team = teams.find(t => t.id === id)
  if (!team) notFound()

  const cache = getPlayerStatsCache()
  const statsMap = new Map<string, CachedPlayer>(
    (cache.players as CachedPlayer[]).map(p => [p.summonerName, p])
  )

  // Build DDragon icon base URL for champion portraits
  const ddragonVersion = getVersion()
  const iconBaseUrl = ddragonVersion
    ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion`
    : ''

  // Fetch champion data for each player
  const seasonStartMs = Date.now() - 30 * 24 * 60 * 60 * 1000
  const champDataMap = new Map<string, PlayerChampionData>()
  for (const player of team.players) {
    const mastery = getPlayerMastery(player.summonerName)
    const season = getChampionStats(player.summonerName, seasonStartMs, 420, 20)
    const recent = getTopRecentChampions(player.summonerName, 20, 6)
    if (mastery.length > 0 || season.length > 0 || recent.length > 0) {
      champDataMap.set(player.summonerName, { mastery, season, recent, iconBaseUrl })
    }
  }

  const sortedPlayers = [...team.players].sort((a, b) => {
    const aIsSub = a.primaryRole === 'Suplente'
    const bIsSub = b.primaryRole === 'Suplente'
    if (aIsSub !== bIsSub) return aIsSub ? 1 : -1
    const ai = ROLE_ORDER.indexOf(a.primaryRole)
    const bi = ROLE_ORDER.indexOf(b.primaryRole)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        href="/ranking"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Volver al ranking
      </Link>

      {/* Team header */}
      <div className="flex items-start gap-5 mb-8">
        {team.logo && (
          <Image
            src={team.logo}
            alt={team.name}
            width={72}
            height={72}
            className="rounded-xl object-contain shrink-0"
          />
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{team.name}</h1>
          <p className="text-sm text-white/40 mt-1">
            {team.players.filter(p => p.primaryRole !== 'Suplente').length} titulares
            {team.players.some(p => p.primaryRole === 'Suplente') && (
              <> · {team.players.filter(p => p.primaryRole === 'Suplente').length} suplentes</>
            )}
          </p>
        </div>
        <RefreshStatsButton lastUpdated={cache.lastUpdated} teamIds={[id]} />
      </div>

      {/* Players grid */}
      {sortedPlayers.length === 0 ? (
        <div className="rounded-xl border border-white/10 p-8 text-center text-white/30 text-sm">
          Este equipo no tiene jugadores registrados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPlayers.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              stats={statsMap.get(player.summonerName)}
              champData={champDataMap.get(player.summonerName) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
