import type { Phase, Match, Team } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { clsx } from 'clsx'

interface Props {
  phase: Phase
  matches: Match[]
  teams: Team[]
}

interface Standing {
  teamId: string
  wins: number
  losses: number
  points: number
}

function getGroupStandings(teamIds: string[], matches: Match[]): Standing[] {
  const standings: Record<string, Standing> = {}
  for (const id of teamIds) {
    standings[id] = { teamId: id, wins: 0, losses: 0, points: 0 }
  }

  for (const m of matches) {
    if (!m.result) continue
    if (!teamIds.includes(m.team1Id) || !teamIds.includes(m.team2Id)) continue
    const { team1Score, team2Score } = m.result
    if (team1Score > team2Score) {
      standings[m.team1Id].wins++
      standings[m.team1Id].points += 3
      standings[m.team2Id].losses++
    } else if (team1Score === team2Score) {
      standings[m.team1Id].points += 1
      standings[m.team2Id].points += 1
    } else {
      standings[m.team2Id].wins++
      standings[m.team2Id].points += 3
      standings[m.team1Id].losses++
    }
  }

  return Object.values(standings).sort((a, b) => b.points - a.points || b.wins - a.wins)
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GroupsView({ phase, matches, teams }: Props) {
  const groups = phase.config.groups ?? []

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {groups.map(group => {
        const groupMatches = matches.filter(m =>
          group.teamIds.includes(m.team1Id) && group.teamIds.includes(m.team2Id)
        )
        const standings = getGroupStandings(group.teamIds, groupMatches)
        const advance = phase.config.advanceCount ?? 2

        return (
          <div key={group.id} className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0e1117]">
            {/* Group header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                Grupo {group.id}
              </span>
            </div>

            {/* Standings */}
            <div className="divide-y divide-white/[0.04]">
              {standings.map((s, i) => {
                const team = teams.find(t => t.id === s.teamId)
                const advancing = i < advance
                const isLast = i === advance - 1

                return (
                  <div key={s.teamId}>
                    <div className={clsx(
                      'flex items-center gap-3 px-4 py-2.5',
                      advancing ? 'bg-[#C89B3C]/5' : ''
                    )}>
                      {/* Position */}
                      <span className={clsx(
                        'text-xs font-bold w-5 text-center shrink-0',
                        advancing ? 'text-[#C89B3C]' : 'text-white/25'
                      )}>
                        {i + 1}
                      </span>

                      {/* Team */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {team?.logo && (
                          <Image src={team.logo} alt={team.name} width={22} height={22} className="rounded shrink-0" />
                        )}
                        {team ? (
                          <Link href={`/equipos/${team.id}`} className={clsx(
                            'text-sm truncate hover:underline',
                            advancing ? 'text-white font-medium' : 'text-white/55'
                          )}>
                            {team.name}
                          </Link>
                        ) : (
                          <span className="text-sm truncate text-white/55">{s.teamId}</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0 text-sm tabular-nums">
                        <span className="text-green-400 font-medium w-4 text-center">{s.wins}</span>
                        <span className="text-white/25 font-medium w-4 text-center">{s.losses}</span>
                        <span className={clsx('font-bold w-6 text-right', advancing ? 'text-[#C89B3C]' : 'text-white/40')}>
                          {s.points}
                        </span>
                      </div>
                    </div>

                    {/* Separator between advancing and non-advancing */}
                    {isLast && i < standings.length - 1 && (
                      <div className="mx-4 border-t border-[#C89B3C]/20" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Column labels */}
            <div className="flex items-center gap-3 px-4 py-1.5 border-t border-white/[0.04]">
              <span className="text-[10px] text-white/20 w-5" />
              <span className="flex-1 text-[10px] text-white/20 uppercase tracking-wider">Equipo</span>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[10px] text-white/20 w-4 text-center uppercase">V</span>
                <span className="text-[10px] text-white/20 w-4 text-center uppercase">D</span>
                <span className="text-[10px] text-white/20 w-6 text-right uppercase">Pts</span>
              </div>
            </div>

            {/* Match list */}
            {groupMatches.length > 0 && (
              <div className="border-t border-white/[0.06]">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Partidos
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {groupMatches.map(m => {
                    const t1 = teams.find(t => t.id === m.team1Id)
                    const t2 = teams.find(t => t.id === m.team2Id)
                    const winner =
                      m.result
                        ? m.result.team1Score > m.result.team2Score ? 'team1'
                          : m.result.team2Score > m.result.team1Score ? 'team2'
                          : 'draw'
                        : null
                    const played = m.result !== null

                    return (
                      <div key={m.id} className="px-4 py-2.5 flex items-center gap-2">
                        {/* Team 1 */}
                        <div className={clsx('flex items-center gap-2 flex-1 min-w-0 justify-end', played && winner !== 'team1' && 'opacity-40')}>
                          {t1 ? (
                            <Link href={`/equipos/${t1.id}`} className="text-xs truncate text-right hover:underline">{t1.name}</Link>
                          ) : (
                            <span className="text-xs truncate text-right">{m.team1Id}</span>
                          )}
                          {t1?.logo && <Image src={t1.logo} alt={t1.name} width={18} height={18} className="rounded shrink-0" />}
                        </div>

                        {/* Score / date */}
                        <div className="shrink-0 text-center min-w-[64px]">
                          {m.result ? (
                            <span className="text-sm font-bold tabular-nums text-white/80">
                              {m.result.team1Score}
                              <span className="text-white/25 mx-1">–</span>
                              {m.result.team2Score}
                            </span>
                          ) : m.scheduledAt ? (
                            <span className="text-[11px] text-white/30">{formatDate(m.scheduledAt)}</span>
                          ) : (
                            <span className="text-xs text-white/20">vs</span>
                          )}
                        </div>

                        {/* Team 2 */}
                        <div className={clsx('flex items-center gap-2 flex-1 min-w-0', played && winner !== 'team2' && 'opacity-40')}>
                          {t2?.logo && <Image src={t2.logo} alt={t2.name} width={18} height={18} className="rounded shrink-0" />}
                          {t2 ? (
                            <Link href={`/equipos/${t2.id}`} className="text-xs truncate hover:underline">{t2.name}</Link>
                          ) : (
                            <span className="text-xs truncate">{m.team2Id}</span>
                          )}
                        </div>
                        <Link
                          href={`/partidos/${m.id}`}
                          className="text-[10px] text-white/20 hover:text-[#0097D7] shrink-0 ml-1 transition-colors"
                        >→</Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
