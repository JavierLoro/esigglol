import { notFound } from 'next/navigation'
import Image from 'next/image'
import { getMatchById, getTeamById, getPhaseById } from '@/lib/data'
import AutoRefresh from '@/components/overlay/AutoRefresh'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

export default async function OverlayPartidoPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const match = getMatchById(matchId)
  if (!match) notFound()

  const team1 = getTeamById(match.team1Id)
  const team2 = getTeamById(match.team2Id)
  const phase = getPhaseById(match.phaseId)

  const score1 = match.result?.team1Score ?? 0
  const score2 = match.result?.team2Score ?? 0
  const bo = phase?.config.bo ?? 1
  const gamesPlayed = score1 + score2

  return (
    <div className="p-6 min-w-[640px]">
      <AutoRefresh interval={30} />

      {/* Context */}
      <div className="text-center mb-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">
          {phase?.name ?? 'Partido'}
          {phase && <> · BO{bo}</>}
          {match.round > 0 && <> · Ronda {match.round}</>}
        </span>
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-center gap-8">
        {/* Team 1 */}
        <div className="flex flex-col items-center gap-3 min-w-[160px]">
          {team1?.logo ? (
            <Image src={team1.logo} alt={team1.name} width={64} height={64} className="rounded-xl object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/10" />
          )}
          <span className="text-lg font-bold text-white text-center leading-tight">{team1?.name ?? match.team1Id}</span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <span className={clsx(
              'text-5xl font-black tabular-nums',
              score1 > score2 ? 'text-[#0097D7]' : 'text-white/40'
            )}>
              {score1}
            </span>
            <span className="text-2xl text-white/20 font-light">–</span>
            <span className={clsx(
              'text-5xl font-black tabular-nums',
              score2 > score1 ? 'text-[#0097D7]' : 'text-white/40'
            )}>
              {score2}
            </span>
          </div>

          {/* Game indicators */}
          {bo > 1 && (
            <div className="flex items-center gap-1.5 mt-1">
              {Array.from({ length: bo }, (_, i) => {
                const gameNum = i + 1
                let winner: 'team1' | 'team2' | null = null
                if (match.games?.[i]) {
                  winner = match.games[i].winner
                } else if (gameNum <= gamesPlayed) {
                  // derive from result order if no game data
                  winner = null
                }
                return (
                  <div
                    key={i}
                    className={clsx(
                      'w-2.5 h-2.5 rounded-full',
                      gameNum > gamesPlayed ? 'bg-white/10' :
                      winner === 'team1' ? 'bg-[#0097D7]' :
                      winner === 'team2' ? 'bg-[#0097D7]' :
                      'bg-white/40'
                    )}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex flex-col items-center gap-3 min-w-[160px]">
          {team2?.logo ? (
            <Image src={team2.logo} alt={team2.name} width={64} height={64} className="rounded-xl object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/10" />
          )}
          <span className="text-lg font-bold text-white text-center leading-tight">{team2?.name ?? match.team2Id}</span>
        </div>
      </div>
    </div>
  )
}
