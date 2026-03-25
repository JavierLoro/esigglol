import type { Phase, Match, Team } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { clsx } from 'clsx'

interface Props {
  phase: Phase
  matches: Match[]
  teams: Team[]
}

type PoolType = 'normal' | 'advance' | 'eliminate' | 'decisive'

interface Pool {
  wins: number
  losses: number
  type: PoolType
  matches: Match[]
  teamIds: string[]
}

interface RoundColumn {
  round: number
  bo: number
  pools: Pool[]
  confirmed: boolean
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function computeRecords(matches: Match[], teamIds: string[]) {
  const records: Record<string, { wins: number; losses: number }> = {}
  for (const id of teamIds) records[id] = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (!m.result) continue
    const w = m.result.team1Score > m.result.team2Score ? m.team1Id : m.team2Id
    const l = w === m.team1Id ? m.team2Id : m.team1Id
    if (records[w]) records[w].wins++
    if (records[l]) records[l].losses++
  }
  return records
}

function getPoolType(wins: number, losses: number, advW: number, elimL: number): PoolType {
  const isAdv = wins === advW - 1
  const isElim = losses === elimL - 1
  if (isAdv && isElim) return 'decisive'
  if (isAdv) return 'advance'
  if (isElim) return 'eliminate'
  return 'normal'
}

function buildColumns(
  allMatches: Match[],
  teamIds: string[],
  advW: number,
  elimL: number,
  confirmedRounds: number[],
  phaseBo: number,
  roundBo: Record<string, number> | undefined,
): RoundColumn[] {
  const rounds = [...new Set(allMatches.map(m => m.round))].sort((a, b) => a - b)
  const maxRounds = advW + elimL - 1

  // Also generate placeholder columns for rounds not yet generated
  const allRoundNums = new Set(rounds)
  for (let r = 1; r <= maxRounds; r++) allRoundNums.add(r)
  const sortedRounds = [...allRoundNums].sort((a, b) => a - b)

  const columns: RoundColumn[] = []

  for (const round of sortedRounds) {
    const confirmed = confirmedRounds.includes(round)
    const roundMatches = allMatches.filter(m => m.round === round)
    const priorMatches = allMatches.filter(m => m.round < round && confirmedRounds.includes(m.round))
    const preRecords = computeRecords(priorMatches, teamIds)
    const bo = roundBo?.[String(round)] ?? phaseBo

    // Group matches by their pre-round W-L record
    const poolMap = new Map<string, Match[]>()
    for (const m of roundMatches) {
      const r1 = preRecords[m.team1Id] ?? { wins: 0, losses: 0 }
      const key = `${r1.wins}-${r1.losses}`
      if (!poolMap.has(key)) poolMap.set(key, [])
      poolMap.get(key)!.push(m)
    }

    // If no matches exist for this round, compute expected pools from theory
    if (roundMatches.length === 0) {
      const expectedPools = getExpectedPools(round, advW, elimL)
      for (const [w, l] of expectedPools) {
        const key = `${w}-${l}`
        if (!poolMap.has(key)) poolMap.set(key, [])
      }
    }

    const pools: Pool[] = [...poolMap.entries()]
      .map(([key, ms]) => {
        const [w, l] = key.split('-').map(Number)
        const poolTeamIds = teamIds.filter(id => {
          const r = preRecords[id] ?? { wins: 0, losses: 0 }
          return r.wins < advW && r.losses < elimL && r.wins === w && r.losses === l
        })
        return { wins: w, losses: l, type: getPoolType(w, l, advW, elimL), matches: ms, teamIds: poolTeamIds }
      })
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

    columns.push({ round, bo, pools, confirmed })
  }

  return columns
}

/** Compute the expected W-L pools for a given round number in a Swiss bracket */
function getExpectedPools(round: number, advW: number, elimL: number): [number, number][] {
  const pools: [number, number][] = []
  // In round R, total games played = R-1, so w+l = R-1
  const totalGames = round - 1
  for (let w = 0; w <= totalGames; w++) {
    const l = totalGames - w
    if (w >= advW || l >= elimL) continue // already classified/eliminated
    pools.push([w, l])
  }
  return pools
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function MatchRow({ match, teams, confirmed }: { match: Match; teams: Team[]; confirmed: boolean }) {
  const t1 = teams.find(t => t.id === match.team1Id)
  const t2 = teams.find(t => t.id === match.team2Id)
  const played = match.result !== null
  const winner = played
    ? match.result!.team1Score > match.result!.team2Score ? 'team1' : 'team2'
    : null

  if (!confirmed) return null

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Team 1 */}
      <div className={clsx('flex items-center gap-1.5 flex-1 min-w-0 justify-end', played && winner !== 'team1' && 'opacity-40')}>
        {t1 ? (
          <Link href={`/equipos/${t1.id}`} className="text-xs font-medium truncate hover:underline">{t1.name}</Link>
        ) : (
          <span className="text-xs font-medium truncate text-white/50">{match.team1Id}</span>
        )}
        {t1?.logo && <Image src={t1.logo} alt={t1.name} width={20} height={20} className="rounded shrink-0" />}
      </div>

      {/* Score */}
      <div className="shrink-0 text-center min-w-[40px]">
        {played ? (
          <span className="text-xs font-bold tabular-nums text-white/80">
            {match.result!.team1Score}
            <span className="text-white/20 mx-1">–</span>
            {match.result!.team2Score}
          </span>
        ) : (
          <span className="text-[10px] text-white/25 font-semibold uppercase">vs</span>
        )}
      </div>

      {/* Team 2 */}
      <div className={clsx('flex items-center gap-1.5 flex-1 min-w-0', played && winner !== 'team2' && 'opacity-40')}>
        {t2?.logo && <Image src={t2.logo} alt={t2.name} width={20} height={20} className="rounded shrink-0" />}
        {t2 ? (
          <Link href={`/equipos/${t2.id}`} className="text-xs font-medium truncate hover:underline">{t2.name}</Link>
        ) : (
          <span className="text-xs font-medium truncate text-white/50">{match.team2Id}</span>
        )}
      </div>
      <Link
        href={`/partidos/${match.id}`}
        className="text-[10px] text-white/20 hover:text-[#0097D7] shrink-0 ml-1 transition-colors"
      >→</Link>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function SwissView({ phase, matches, teams }: Props) {
  const teamIds = phase.config.swissTeamIds ?? []
  const advW = phase.config.advanceWins ?? 2
  const elimL = phase.config.eliminateLosses ?? 2
  const confirmedRounds = phase.config.confirmedRounds ?? []

  const columns = buildColumns(
    matches, teamIds, advW, elimL, confirmedRounds,
    phase.config.bo, phase.config.roundBo as Record<string, number> | undefined,
  )

  // Compute final classified/eliminated teams from confirmed rounds only
  const confirmedMatches = matches.filter(m => confirmedRounds.includes(m.round))
  const finalRecords = computeRecords(confirmedMatches, teamIds)
  const classified = teamIds.filter(id => (finalRecords[id]?.wins ?? 0) >= advW)
  const eliminated = teamIds.filter(id => (finalRecords[id]?.losses ?? 0) >= elimL)

  if (teamIds.length === 0 && matches.length === 0) {
    return (
      <p className="text-white/25 text-sm text-center py-6">
        Configura los equipos y genera las rondas desde el panel de administración.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Bracket */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max items-start">
          {columns.map(col => (
            <div key={col.round} className="flex flex-col gap-2 min-w-[200px] max-w-[260px]">
              {/* Round header */}
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Ronda {col.round}
                </span>
              </div>

              {/* Pools */}
              {col.pools.map(pool => (
                <PoolCardWithTeams
                  key={`${pool.wins}-${pool.losses}`}
                  pool={pool}
                  bo={col.bo}
                  confirmed={col.confirmed}
                  teams={teams}
                />
              ))}
            </div>
          ))}

          {/* Final results column */}
          {(classified.length > 0 || eliminated.length > 0) && (
            <div className="flex flex-col gap-2 min-w-[150px]">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Resultado
                </span>
              </div>

              {classified.length > 0 && (
                <div className="rounded-lg border border-[#0097D7]/25 bg-[#0097D7]/[0.04] p-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#0097D7] block mb-2">
                    Clasificados
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {classified.map(id => {
                      const team = teams.find(t => t.id === id)
                      return (
                        <div key={id} className="flex items-center gap-2">
                          {team?.logo && <Image src={team.logo} alt={team.name} width={18} height={18} className="rounded shrink-0" />}
                          {team ? (
                            <Link href={`/equipos/${team.id}`} className="text-xs font-medium text-[#0097D7] hover:underline truncate">
                              {team.name}
                            </Link>
                          ) : (
                            <span className="text-xs text-white/40">{id}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {eliminated.length > 0 && (
                <div className="rounded-lg border border-red-400/15 bg-red-400/[0.03] p-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/60 block mb-2">
                    Eliminados
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {eliminated.map(id => {
                      const team = teams.find(t => t.id === id)
                      return (
                        <div key={id} className="flex items-center gap-2 opacity-50">
                          {team?.logo && <Image src={team.logo} alt={team.name} width={18} height={18} className="rounded shrink-0 grayscale" />}
                          {team ? (
                            <Link href={`/equipos/${team.id}`} className="text-xs font-medium text-white/40 hover:underline truncate">
                              {team.name}
                            </Link>
                          ) : (
                            <span className="text-xs text-white/40">{id}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** PoolCard wrapper that passes teams to MatchRow */
function PoolCardWithTeams({ pool, bo, confirmed, teams }: { pool: Pool; bo: number; confirmed: boolean; teams: Team[] }) {
  const isAdvance = pool.type === 'advance' || pool.type === 'decisive'
  const isEliminate = pool.type === 'eliminate' || pool.type === 'decisive'

  return (
    <div className={clsx(
      'rounded-lg border flex flex-col',
      isAdvance && !isEliminate && 'border-[#0097D7]/25 bg-[#0097D7]/[0.04]',
      isEliminate && !isAdvance && 'border-red-400/15 bg-red-400/[0.03]',
      pool.type === 'decisive' && 'border-[#0097D7]/20 bg-[#0097D7]/[0.03]',
      pool.type === 'normal' && 'border-white/[0.08] bg-[#0e1117]',
    )}>
      {/* Type indicator */}
      {(isAdvance || isEliminate) && (
        <div className="px-3 pt-2 flex gap-2">
          {isAdvance && <span className="text-[9px] font-bold uppercase tracking-widest text-[#0097D7]">Clasificados</span>}
          {isEliminate && <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/60">Eliminados</span>}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-bold text-white/60">
          {pool.wins} – {pool.losses}
        </span>
        <span className="text-[9px] font-semibold text-white/20 uppercase">BO{bo}</span>
      </div>

      {/* Matches or placeholder */}
      <div className="px-2.5 pb-2.5 flex flex-col">
        {!confirmed ? (
          <div className="py-2 flex flex-col gap-1.5">
            <span className="text-[10px] text-white/20 italic text-center block mb-0.5">Pendiente de confirmación</span>
            {pool.teamIds.map(id => {
              const team = teams.find(t => t.id === id)
              return (
                <div key={id} className="flex items-center gap-1.5 px-0.5">
                  {team?.logo ? (
                    <Image src={team.logo} alt={team.name} width={16} height={16} className="rounded shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded bg-white/5 shrink-0" />
                  )}
                  <span className="text-xs text-white/40 truncate">{team?.name ?? id}</span>
                </div>
              )
            })}
          </div>
        ) : pool.matches.length === 0 ? (
          <div className="py-2 text-center">
            <span className="text-[10px] text-white/20">—</span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {pool.matches.map(m => (
              <MatchRow key={m.id} match={m} teams={teams} confirmed={confirmed} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
