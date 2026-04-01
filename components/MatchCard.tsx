import Image from 'next/image'
import Link from 'next/link'
import type { Match, Team, Phase } from '@/lib/types'
import { clsx } from 'clsx'

interface Props {
  match: Match
  teams: Team[]
  phase?: Phase
}

export default function MatchCard({ match, teams, phase }: Props) {
  const team1 = teams.find(t => t.id === match.team1Id)
  const team2 = teams.find(t => t.id === match.team2Id)
  const played = match.result !== null

  const winner = played
    ? match.result!.team1Score > match.result!.team2Score ? 'team1' : 'team2'
    : null

  return (
    <Link
      href={`/partidos/${match.id}`}
      className={clsx(
        'rounded-xl border flex flex-col bg-[#0d1321] overflow-hidden hover:border-[#0097D7]/50 transition-colors',
        played ? 'border-white/10' : 'border-[#0097D7]/30'
      )}
    >
      {/* Header badge */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        {phase ? (
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
            {phase.name} &middot; R{match.round} &middot; BO{phase.config.roundBo?.[String(match.round)] ?? phase.config.bo}
          </span>
        ) : <span />}
        {!played && (
          <span className="text-xs font-semibold text-[#0097D7] bg-[#0097D7]/10 px-2 py-0.5 rounded-full">
            {match.scheduledAt
              ? new Date(match.scheduledAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
              : 'Pendiente'}
          </span>
        )}
        {played && (
          <span className="text-xs font-semibold text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
            Finalizado
          </span>
        )}
      </div>

      {/* Match row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Team 1 */}
        <div className={clsx(
          'flex-1 flex items-center gap-3',
          winner === 'team2' && 'opacity-35'
        )}>
          {team1?.logo && (
            <Image src={team1.logo} alt={team1.name} width={44} height={44} className="rounded object-contain" />
          )}
          <span className={clsx(
            'font-semibold text-sm truncate',
            winner === 'team1' ? 'text-white' : 'text-white/80'
          )}>{team1?.name ?? 'Equipo desconocido'}</span>
        </div>

        {/* Score / VS */}
        <div className="flex items-center gap-2 shrink-0">
          {played ? (
            <>
              <span className={clsx('text-xl font-bold w-7 text-center', winner === 'team1' ? 'text-[#0097D7]' : 'text-white/50')}>
                {match.result!.team1Score}
              </span>
              <span className="text-white/20 text-xs font-bold">:</span>
              <span className={clsx('text-xl font-bold w-7 text-center', winner === 'team2' ? 'text-[#0097D7]' : 'text-white/50')}>
                {match.result!.team2Score}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-white/20 px-1">VS</span>
          )}
        </div>

        {/* Team 2 */}
        <div className={clsx(
          'flex-1 flex items-center gap-3 justify-end',
          winner === 'team1' && 'opacity-35'
        )}>
          <span className={clsx(
            'font-semibold text-sm truncate text-right',
            winner === 'team2' ? 'text-white' : 'text-white/80'
          )}>{team2?.name ?? 'Equipo desconocido'}</span>
          {team2?.logo && (
            <Image src={team2.logo} alt={team2.name} width={44} height={44} className="rounded object-contain" />
          )}
        </div>
      </div>
    </Link>
  )
}
