import { notFound } from 'next/navigation'
import { getMatchById, getTeamById } from '@/lib/data'
import { getVersion } from '@/lib/ddragon'
import AutoRefresh from '@/components/overlay/AutoRefresh'
import type { GamePlayerData } from '@/lib/types'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

function PlayerRow({
  player,
  isWinner,
  iconBaseUrl,
}: {
  player: GamePlayerData
  isWinner: boolean
  iconBaseUrl: string
}) {
  return (
    <tr className={clsx(
      'border-b border-white/[0.04]',
      !isWinner && 'opacity-50'
    )}>
      <td className="px-3 py-2">
        {iconBaseUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${iconBaseUrl}/${player.championName}.png`}
            alt={player.championName}
            className="w-8 h-8 rounded"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-white/10" />
        )}
      </td>
      <td className="px-3 py-2 text-sm font-medium text-white">
        {player.summonerName.split('#')[0]}
      </td>
      <td className="px-3 py-2 text-sm text-center tabular-nums text-white/80">
        <span className="text-green-400">{player.kills}</span>
        <span className="text-white/30 mx-0.5">/</span>
        <span className="text-red-400">{player.deaths}</span>
        <span className="text-white/30 mx-0.5">/</span>
        <span className="text-white/60">{player.assists}</span>
      </td>
      <td className="px-3 py-2 text-sm text-center text-white/50 tabular-nums">{player.cs}</td>
      <td className="px-3 py-2 text-sm text-center text-yellow-400/80 tabular-nums font-medium">
        {(player.gold / 1000).toFixed(1)}k
      </td>
    </tr>
  )
}

export default async function OverlayGamePage({
  params,
}: {
  params: Promise<{ matchId: string; gameIndex: string }>
}) {
  const { matchId, gameIndex } = await params
  const match = getMatchById(matchId)
  if (!match) notFound()

  const idx = parseInt(gameIndex, 10) - 1
  const game = match.games?.[idx]

  const team1 = getTeamById(match.team1Id)
  const team2 = getTeamById(match.team2Id)

  const ddragonVersion = getVersion()
  const iconBaseUrl = ddragonVersion
    ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion`
    : ''

  if (!game) {
    return (
      <div className="p-6 text-white/30 text-sm">
        <AutoRefresh interval={30} />
        Sin datos para el Game {gameIndex}.
      </div>
    )
  }

  const team1Won = game.winner === 'team1'

  return (
    <div className="p-4 min-w-[700px]">
      <AutoRefresh interval={30} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="text-sm font-bold text-white/70">{team1?.name ?? match.team1Id}</span>
        <span className="text-white/20">vs</span>
        <span className="text-sm font-bold text-white/70">{team2?.name ?? match.team2Id}</span>
        <span className="text-white/20 mx-1">·</span>
        <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Game {gameIndex}</span>
        {game.duration && (
          <>
            <span className="text-white/20 mx-1">·</span>
            <span className="text-xs text-white/30">{game.duration}</span>
          </>
        )}
      </div>

      {/* Team 1 */}
      <div className={clsx('rounded-lg border mb-3 overflow-hidden', team1Won ? 'border-[#0097D7]/30 bg-[#0097D7]/[0.04]' : 'border-white/[0.06] bg-[#0e1117]')}>
        <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{team1?.name ?? match.team1Id}</span>
          {team1Won && <span className="text-[10px] font-bold text-[#0097D7] uppercase tracking-widest ml-auto">Victoria</span>}
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-white/20">
              <th className="px-3 py-1.5 text-left w-10"></th>
              <th className="px-3 py-1.5 text-left">Jugador</th>
              <th className="px-3 py-1.5 text-center">K/D/A</th>
              <th className="px-3 py-1.5 text-center">CS</th>
              <th className="px-3 py-1.5 text-center">Oro</th>
            </tr>
          </thead>
          <tbody>
            {game.team1Players.map(p => (
              <PlayerRow key={p.summonerName} player={p} isWinner={team1Won} iconBaseUrl={iconBaseUrl} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Team 2 */}
      <div className={clsx('rounded-lg border overflow-hidden', !team1Won ? 'border-[#0097D7]/30 bg-[#0097D7]/[0.04]' : 'border-white/[0.06] bg-[#0e1117]')}>
        <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{team2?.name ?? match.team2Id}</span>
          {!team1Won && <span className="text-[10px] font-bold text-[#0097D7] uppercase tracking-widest ml-auto">Victoria</span>}
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-white/20">
              <th className="px-3 py-1.5 text-left w-10"></th>
              <th className="px-3 py-1.5 text-left">Jugador</th>
              <th className="px-3 py-1.5 text-center">K/D/A</th>
              <th className="px-3 py-1.5 text-center">CS</th>
              <th className="px-3 py-1.5 text-center">Oro</th>
            </tr>
          </thead>
          <tbody>
            {game.team2Players.map(p => (
              <PlayerRow key={p.summonerName} player={p} isWinner={!team1Won} iconBaseUrl={iconBaseUrl} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
