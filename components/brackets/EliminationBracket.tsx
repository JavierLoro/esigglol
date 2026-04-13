import type { Match, Team } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { clsx } from 'clsx'

interface Props {
  matches: Match[]
  teams: Team[]
  title?: string
  teamCount?: number
}

const SLOT = 112    // base slot height for first round (px)
const CARD_H = 96   // match card height: 2 × 48px team rows
const COL_W = 240   // match column width (px)
const CONN_W = 36   // SVG connector width between rounds (px)
const HEADER_H = 40 // round header height (px)

function TeamRow({ teamId, score, isWinner, isPlayed, teams }: {
  teamId: string
  score?: number
  isWinner: boolean
  isPlayed: boolean
  teams: Team[]
}) {
  const team = teams.find(t => t.id === teamId)

  return (
    <div className={clsx(
      'flex items-center gap-2.5 px-3 h-12 transition-opacity',
      isPlayed && !isWinner ? 'opacity-40' : 'opacity-100'
    )}>
      {team?.logo ? (
        <Image
          src={team.logo}
          alt={team.name}
          width={22}
          height={22}
          className={clsx('rounded shrink-0', isPlayed && !isWinner && 'grayscale')}
        />
      ) : (
        <div className="w-[22px] h-[22px] rounded bg-white/10 shrink-0" />
      )}
      {team ? (
        <Link href={`/equipos/${team.id}`} className={clsx(
          'flex-1 truncate text-sm hover:underline',
          isWinner ? 'text-white font-semibold' : 'text-white/70'
        )}>
          {team.name}
        </Link>
      ) : (
        <span className="flex-1 truncate text-sm text-white/25 italic">TBD</span>
      )}
      {score !== undefined && (
        <span className={clsx(
          'tabular-nums text-sm font-bold shrink-0 min-w-[20px] text-right',
          isWinner ? 'text-white' : 'text-white/40'
        )}>
          {score}
        </span>
      )}
    </div>
  )
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const isPlayed = match.result !== null
  const winner = isPlayed
    ? match.result!.team1Score > match.result!.team2Score ? 'team1' : 'team2'
    : null

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#0e1117]">
      <Link
        href={`/partidos/${match.id}`}
        className="absolute top-0.5 right-1 text-[9px] text-white/20 hover:text-[#0097D7] transition-colors z-10"
      >
        Ver
      </Link>
      {/* Winner accent bar */}
      {winner && (
        <div
          className={clsx(
            'absolute left-0 top-0 bottom-0 w-[3px]',
            winner === 'team1' ? 'top-0 h-1/2' : 'top-1/2 h-1/2'
          )}
          style={{ background: '#C89B3C' }}
        />
      )}
      <div className="border-b border-white/[0.06]">
        <TeamRow
          teamId={match.team1Id || 'TBD'}
          score={match.result?.team1Score}
          isWinner={winner === 'team1'}
          isPlayed={isPlayed}
          teams={teams}
        />
      </div>
      <TeamRow
        teamId={match.team2Id || 'TBD'}
        score={match.result?.team2Score}
        isWinner={winner === 'team2'}
        isPlayed={isPlayed}
        teams={teams}
      />
    </div>
  )
}

function getRoundName(ri: number, totalRounds: number) {
  const fromEnd = totalRounds - 1 - ri
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinal'
  if (fromEnd === 2) return 'Cuartos de final'
  return `Ronda ${ri + 1}`
}

function PendingRow({ teamId, teams }: { teamId?: string; teams: Team[] }) {
  const team = teamId ? teams.find(t => t.id === teamId) : undefined
  return (
    <div className="flex items-center gap-2.5 px-3 h-12">
      {team?.logo ? (
        <Image src={team.logo} alt={team.name} width={22} height={22} className="rounded shrink-0 opacity-50" />
      ) : (
        <div className="w-[22px] h-[22px] rounded bg-white/5 shrink-0" />
      )}
      {team ? (
        <span className="flex-1 truncate text-sm text-white/45">{team.name}</span>
      ) : (
        <span className="flex-1 truncate text-sm text-white/15 italic">TBD</span>
      )}
    </div>
  )
}

function PendingCard({ team1Id, team2Id, teams }: { team1Id?: string; team2Id?: string; teams: Team[] }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0e1117]/50">
      <div className="border-b border-white/[0.04]">
        <PendingRow teamId={team1Id} teams={teams} />
      </div>
      <PendingRow teamId={team2Id} teams={teams} />
    </div>
  )
}

function ConnectorSVG({ numPairs, slotH }: { numPairs: number; slotH: number }) {
  const totalH = numPairs * slotH * 2
  const mx = CONN_W / 2

  return (
    <svg width={CONN_W} height={totalH} style={{ flexShrink: 0, display: 'block' }}>
      <g stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none">
        {Array.from({ length: numPairs }, (_, k) => {
          const y1 = (2 * k + 0.5) * slotH
          const y2 = (2 * k + 1.5) * slotH
          const ym = (y1 + y2) / 2
          return (
            <g key={k}>
              <line x1={0} y1={y1} x2={mx} y2={y1} />
              <line x1={0} y1={y2} x2={mx} y2={y2} />
              <line x1={mx} y1={y1} x2={mx} y2={y2} />
              <line x1={mx} y1={ym} x2={CONN_W} y2={ym} />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default function EliminationBracket({ matches, teams, title, teamCount }: Props) {
  if (matches.length === 0) {
    const numRounds = teamCount && teamCount >= 2 ? Math.log2(teamCount) : 0
    if (numRounds >= 1) {
      const placeholderRounds = Array.from({ length: numRounds }, (_, ri) => ({
        ri,
        count: teamCount! / Math.pow(2, ri + 1),
      }))
      return (
        <div className="flex flex-col gap-3">
          {title && (
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{title}</h3>
          )}
          <div className="flex overflow-x-auto pb-3">
            {placeholderRounds.map(({ ri, count }) => {
              const slotH = SLOT * Math.pow(2, ri)
              const isLast = ri === placeholderRounds.length - 1
              const vPad = (slotH - CARD_H) / 2
              return (
                <div key={ri} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: COL_W, flexShrink: 0 }}>
                    <div style={{ height: HEADER_H }} className="flex items-center justify-center">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-white/20">
                        {getRoundName(ri, numRounds)}
                      </span>
                    </div>
                    {Array.from({ length: count }, (_, i) => (
                      <div
                        key={i}
                        style={{ height: slotH, paddingTop: vPad, paddingBottom: vPad, paddingLeft: 6, paddingRight: 6, boxSizing: 'border-box' }}
                      >
                        <PendingCard teams={teams} />
                      </div>
                    ))}
                  </div>
                  {!isLast && (
                    <div style={{ paddingTop: HEADER_H }}>
                      <ConnectorSVG numPairs={Math.floor(count / 2)} slotH={slotH} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return (
      <p className="text-white/25 text-sm py-4">
        {title && <span className="text-white/40 font-medium">{title} — </span>}
        No hay partidos generados.
      </p>
    )
  }

  const existingRounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)
  const numExpected = teamCount && teamCount >= 2 ? Math.log2(teamCount) : existingRounds.length
  const totalRounds = Math.max(existingRounds.length, numExpected)

  return (
    <div className="flex flex-col gap-3">
      {title && (
        <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{title}</h3>
      )}
      <div className="flex overflow-x-auto pb-3">
        {Array.from({ length: totalRounds }, (_, ri) => {
          const round = existingRounds[ri]
          const roundMatches = round !== undefined ? matches.filter(m => m.round === round) : []
          const isPlaceholder = round === undefined
          const slotH = SLOT * Math.pow(2, ri)
          const isLast = ri === totalRounds - 1
          const vPad = (slotH - CARD_H) / 2
          const placeholderCount = teamCount ? Math.round(teamCount / Math.pow(2, ri + 1)) : 1

          // Equipos avanzando: de la ronda anterior (si existe y tiene resultados)
          const prevRound = ri > 0 ? existingRounds[ri - 1] : undefined
          const prevRoundMatches = prevRound !== undefined
            ? matches.filter(m => m.round === prevRound).sort((a, b) => a.id.localeCompare(b.id))
            : []

          return (
            <div key={ri} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* Round column */}
              <div style={{ width: COL_W, flexShrink: 0 }}>
                {/* Header */}
                <div style={{ height: HEADER_H }} className="flex items-center justify-center">
                  <span className={clsx(
                    'text-[11px] font-bold uppercase tracking-widest',
                    isPlaceholder ? 'text-white/20' : 'text-white/35',
                  )}>
                    {getRoundName(ri, totalRounds)}
                  </span>
                </div>

                {/* Match slots */}
                {isPlaceholder
                  ? Array.from({ length: placeholderCount }, (_, i) => (
                      <div
                        key={i}
                        style={{ height: slotH, paddingTop: vPad, paddingBottom: vPad, paddingLeft: 6, paddingRight: 6, boxSizing: 'border-box' }}
                      >
                        <PendingCard
                          team1Id={prevRoundMatches[i * 2]?.winnerId}
                          team2Id={prevRoundMatches[i * 2 + 1]?.winnerId}
                          teams={teams}
                        />
                      </div>
                    ))
                  : roundMatches.map(match => (
                      <div
                        key={match.id}
                        style={{ height: slotH, paddingTop: vPad, paddingBottom: vPad, paddingLeft: 6, paddingRight: 6, boxSizing: 'border-box' }}
                      >
                        <MatchCard match={match} teams={teams} />
                      </div>
                    ))
                }
              </div>

              {/* SVG connector */}
              {!isLast && (
                <div style={{ paddingTop: HEADER_H }}>
                  <ConnectorSVG
                    numPairs={Math.floor((isPlaceholder ? placeholderCount : roundMatches.length) / 2)}
                    slotH={slotH}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
