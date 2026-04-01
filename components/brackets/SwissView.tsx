import type { Phase, Match, Team } from '@/lib/types'
import Image from 'next/image'
import Link from 'next/link'
import { clsx } from 'clsx'

// ── Layout constants ──────────────────────────────────────────────────────────
const MATCH_H = 96
const POOL_HEADER_H = 36
const TEAM_ROW_H = 36
const PLACEHOLDER_LABEL_H = 24
const POOL_GAP = 8
const COL_W = 220
const CONN_W = 36
const HEADER_H = 40
const EXIT_HEADER_H = 36
const EXIT_TEAM_H = 36
const MATCH_GAP = 6

// ── Math helpers ──────────────────────────────────────────────────────────────
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

/** Expected teams in pool (w, l) for a balanced N-team Swiss. */
function expectedPoolSize(w: number, l: number, N: number): number {
  const round = w + l
  if (round === 0) return N
  return Math.max(1, Math.round((comb(round, w) * N) / Math.pow(2, round)))
}

/**
 * Expected teams in an exit group (w, l).
 * Advance exits: w = advW, feeding pool was (w-1, l).
 * Eliminate exits: l = elimL, feeding pool was (w, l-1).
 */
function expectedExitSize(w: number, l: number, type: 'advance' | 'eliminate', N: number): number {
  const pick = type === 'advance' ? w - 1 : w
  return Math.max(1, Math.round((comb(w + l - 1, pick) * N) / Math.pow(2, w + l)))
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props { phase: Phase; matches: Match[]; teams: Team[] }
type PoolType = 'normal' | 'advance' | 'eliminate' | 'decisive'

interface Pool {
  wins: number
  losses: number
  type: PoolType
  matches: Match[]
  teamIds: string[]
  expectedCount: number
}

interface ExitGroup {
  wins: number
  losses: number
  type: 'advance' | 'eliminate'
  teams: string[]
  expectedCount: number
}

type ColumnItem =
  | { kind: 'pool'; pool: Pool }
  | { kind: 'exit'; group: ExitGroup }

interface RoundColumn {
  round: number
  bo: number
  pools: Pool[]
  exitGroups: ExitGroup[]
  confirmed: boolean
}

// ── Data helpers ──────────────────────────────────────────────────────────────
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

function getExpectedPools(round: number, advW: number, elimL: number): [number, number][] {
  const pools: [number, number][] = []
  const totalGames = round - 1
  for (let w = 0; w <= totalGames; w++) {
    const l = totalGames - w
    if (w >= advW || l >= elimL) continue
    pools.push([w, l])
  }
  return pools
}

function buildColumns(
  allMatches: Match[],
  totalTeams: number,
  teamIds: string[],
  advW: number,
  elimL: number,
  confirmedRounds: number[],
  phaseBo: number,
  roundBo: Record<string, number> | undefined,
): RoundColumn[] {
  const rounds = [...new Set(allMatches.map(m => m.round))].sort((a, b) => a - b)
  const maxRounds = advW + elimL - 1
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
    const poolMap = new Map<string, Match[]>()

    for (const m of roundMatches) {
      const r1 = preRecords[m.team1Id] ?? { wins: 0, losses: 0 }
      const key = `${r1.wins}-${r1.losses}`
      if (!poolMap.has(key)) poolMap.set(key, [])
      poolMap.get(key)!.push(m)
    }

    if (roundMatches.length === 0) {
      for (const [w, l] of getExpectedPools(round, advW, elimL)) {
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
        return {
          wins: w,
          losses: l,
          type: getPoolType(w, l, advW, elimL),
          matches: ms,
          teamIds: poolTeamIds,
          expectedCount: expectedPoolSize(w, l, totalTeams),
        }
      })
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

    columns.push({ round, bo, pools, exitGroups: [], confirmed })
  }

  return columns
}

function buildExitGroups(
  allMatches: Match[],
  totalTeams: number,
  teamIds: string[],
  advW: number,
  elimL: number,
  confirmedRounds: number[],
): Map<number, ExitGroup[]> {
  const confirmed = allMatches.filter(m => confirmedRounds.includes(m.round))
  const records = computeRecords(confirmed, teamIds)
  const map = new Map<number, ExitGroup[]>()

  // Clasificados: wins === advW, losses 0..elimL-1
  for (let l = 0; l < elimL; l++) {
    const targetRound = advW + l + 1
    const teams = teamIds.filter(id => {
      const r = records[id] ?? { wins: 0, losses: 0 }
      return r.wins === advW && r.losses === l
    })
    if (!map.has(targetRound)) map.set(targetRound, [])
    map.get(targetRound)!.push({
      wins: advW,
      losses: l,
      type: 'advance',
      teams,
      expectedCount: expectedExitSize(advW, l, 'advance', totalTeams),
    })
  }

  // Eliminados: losses === elimL, wins 0..advW-1
  for (let w = 0; w < advW; w++) {
    const targetRound = w + elimL + 1
    const teams = teamIds.filter(id => {
      const r = records[id] ?? { wins: 0, losses: 0 }
      return r.wins === w && r.losses === elimL
    })
    if (!map.has(targetRound)) map.set(targetRound, [])
    map.get(targetRound)!.push({
      wins: w,
      losses: elimL,
      type: 'eliminate',
      teams,
      expectedCount: expectedExitSize(w, elimL, 'eliminate', totalTeams),
    })
  }

  return map
}

// ── Height helpers ────────────────────────────────────────────────────────────
function poolHeight(pool: Pool, confirmed: boolean): number {
  if (confirmed) {
    const n = Math.max(pool.matches.length, 1)
    return POOL_HEADER_H + MATCH_H * n + MATCH_GAP * (n - 1)
  }
  const rows = Math.max(pool.teamIds.length, pool.expectedCount)
  return POOL_HEADER_H + PLACEHOLDER_LABEL_H + TEAM_ROW_H * rows
}

function exitGroupHeight(group: ExitGroup): number {
  return EXIT_HEADER_H + EXIT_TEAM_H * Math.max(group.teams.length, group.expectedCount)
}

function getColumnItems(col: RoundColumn): ColumnItem[] {
  const items: ColumnItem[] = [
    ...col.pools.map(p => ({ kind: 'pool' as const, pool: p })),
    ...col.exitGroups.map(g => ({ kind: 'exit' as const, group: g })),
  ]
  return items.sort((a, b) => {
    const wa = a.kind === 'pool' ? a.pool.wins : a.group.wins
    const la = a.kind === 'pool' ? a.pool.losses : a.group.losses
    const wb = b.kind === 'pool' ? b.pool.wins : b.group.wins
    const lb = b.kind === 'pool' ? b.pool.losses : b.group.losses
    return wb - wa || la - lb
  })
}

function itemHeight(item: ColumnItem, confirmed: boolean): number {
  return item.kind === 'pool' ? poolHeight(item.pool, confirmed) : exitGroupHeight(item.group)
}

function colTotalHeight(col: RoundColumn): number {
  const items = getColumnItems(col)
  if (items.length === 0) return HEADER_H
  return HEADER_H + items.reduce((s, it) => s + itemHeight(it, col.confirmed), 0) + POOL_GAP * (items.length - 1)
}

function itemCenterY(idx: number, items: ColumnItem[], col: RoundColumn): number {
  let y = HEADER_H
  for (let i = 0; i < idx; i++) y += itemHeight(items[i], col.confirmed) + POOL_GAP
  return y + itemHeight(items[idx], col.confirmed) / 2
}

function findItemIdx(items: ColumnItem[], wins: number, losses: number): number {
  return items.findIndex(it =>
    it.kind === 'pool'
      ? it.pool.wins === wins && it.pool.losses === losses
      : it.group.wins === wins && it.group.losses === losses
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SwissMatchCard({ match, teamById }: { match: Match; teamById: Map<string, Team> }) {
  const isPlayed = match.result !== null
  const winner = isPlayed
    ? match.result!.team1Score > match.result!.team2Score ? 'team1' : 'team2'
    : null
  const t1 = teamById.get(match.team1Id)
  const t2 = teamById.get(match.team2Id)
  const t1Wins = winner === 'team1'
  const t2Wins = winner === 'team2'

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="relative flex overflow-hidden rounded-lg border border-white/[0.08] bg-[#0e1117] hover:border-white/20 transition-colors"
      style={{ height: MATCH_H }}
    >
      {/* Winner bar */}
      {winner && (
        <div
          className={clsx('absolute left-0 w-[3px] z-10', winner === 'team1' ? 'top-0 h-1/2' : 'top-1/2 h-1/2')}
          style={{ background: '#C89B3C' }}
        />
      )}

      {/* Team area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className={clsx('flex-1 flex items-center gap-2 px-2.5 border-b border-white/[0.06]', isPlayed && !t1Wins && 'opacity-40')}>
          {t1?.logo ? (
            <Image src={t1.logo} alt={t1.name} width={18} height={18} className={clsx('rounded shrink-0', isPlayed && !t1Wins && 'grayscale')} />
          ) : (
            <div className="w-[18px] h-[18px] rounded bg-white/10 shrink-0" />
          )}
          <span className={clsx('flex-1 truncate text-sm', t1Wins ? 'text-white font-semibold' : 'text-white/70')}>
            {t1?.name ?? match.team1Id}
          </span>
        </div>
        <div className={clsx('flex-1 flex items-center gap-2 px-2.5', isPlayed && !t2Wins && 'opacity-40')}>
          {t2?.logo ? (
            <Image src={t2.logo} alt={t2.name} width={18} height={18} className={clsx('rounded shrink-0', isPlayed && !t2Wins && 'grayscale')} />
          ) : (
            <div className="w-[18px] h-[18px] rounded bg-white/10 shrink-0" />
          )}
          <span className={clsx('flex-1 truncate text-sm', t2Wins ? 'text-white font-semibold' : 'text-white/70')}>
            {t2?.name ?? match.team2Id}
          </span>
        </div>
      </div>

      {/* Score column */}
      <div className="flex flex-col w-9 shrink-0 border-l border-white/[0.06]">
        <div className={clsx('flex-1 flex items-center justify-center border-b border-white/[0.06]', isPlayed && !t1Wins && 'opacity-40')}>
          <span className={clsx('tabular-nums text-sm font-bold', t1Wins ? 'text-white' : 'text-white/50')}>
            {isPlayed ? match.result!.team1Score : '–'}
          </span>
        </div>
        <div className={clsx('flex-1 flex items-center justify-center', isPlayed && !t2Wins && 'opacity-40')}>
          <span className={clsx('tabular-nums text-sm font-bold', t2Wins ? 'text-white' : 'text-white/50')}>
            {isPlayed ? match.result!.team2Score : '–'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function PoolBlock({ pool, bo, confirmed, teamById }: { pool: Pool; bo: number; confirmed: boolean; teamById: Map<string, Team> }) {
  const h = poolHeight(pool, confirmed)

  return (
    <div
      className="rounded-lg border overflow-hidden border-white/[0.08] bg-[#0e1117]"
      style={{ height: h }}
    >
      <div className="flex items-center justify-center gap-2 px-3" style={{ height: POOL_HEADER_H }}>
        <span className="text-sm font-bold text-white/60">{pool.wins} – {pool.losses}</span>
        <span className="text-[9px] font-semibold text-white/20 uppercase">BO{bo}</span>
      </div>
      {confirmed ? (
        pool.matches.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height: MATCH_H }}>
            <span className="text-[10px] text-white/20">—</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: MATCH_GAP }}>
            {pool.matches.map(m => <SwissMatchCard key={m.id} match={m} teamById={teamById} />)}
          </div>
        )
      ) : (
        <>
          <div className="flex items-center justify-center" style={{ height: PLACEHOLDER_LABEL_H }}>
            <span className="text-[10px] text-white/20 italic">Pendiente</span>
          </div>
          {Array.from({ length: Math.max(pool.teamIds.length, pool.expectedCount) }, (_, i) => {
            const id = pool.teamIds[i]
            const team = id ? teamById.get(id) : undefined
            return (
              <div key={id ?? `placeholder-${i}`} className="flex items-center gap-1.5 px-2.5" style={{ height: TEAM_ROW_H }}>
                {team?.logo ? (
                  <Image src={team.logo} alt={team.name} width={16} height={16} className="rounded shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded bg-white/5 shrink-0" />
                )}
                <span className="text-xs text-white/40 truncate">{team?.name ?? (id ?? '—')}</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function ExitGroupBlock({ group, teamById }: { group: ExitGroup; teamById: Map<string, Team> }) {
  const isAdv = group.type === 'advance'
  const count = Math.max(group.teams.length, group.expectedCount)
  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden',
        isAdv ? 'border-blue-500/30 bg-blue-950/20' : 'border-red-500/30 bg-red-950/20',
      )}
      style={{ height: exitGroupHeight(group) }}
    >
      <div className="flex items-center justify-center gap-2 px-3" style={{ height: EXIT_HEADER_H }}>
        <span className={clsx('text-sm font-bold', isAdv ? 'text-blue-400' : 'text-red-400')}>
          {group.wins} – {group.losses}
        </span>
        <span className="text-[9px] font-semibold text-white/20 uppercase">
          {isAdv ? 'Clasif.' : 'Elim.'}
        </span>
      </div>
      {Array.from({ length: count }, (_, i) => {
        const teamId = group.teams[i]
        const team = teamId ? teamById.get(teamId) : undefined
        return (
          <div
            key={teamId ?? `placeholder-${i}`}
            className={clsx('flex items-center gap-1.5 px-2.5', teamId && !isAdv && 'opacity-50')}
            style={{ height: EXIT_TEAM_H }}
          >
            {team?.logo ? (
              <Image src={team.logo} alt={team.name} width={16} height={16} className={clsx('rounded shrink-0', !isAdv && 'grayscale')} />
            ) : (
              <div className="w-4 h-4 rounded bg-white/5 shrink-0" />
            )}
            <span className={clsx('text-xs truncate', teamId ? 'text-white/60' : 'text-white/20 italic')}>
              {team?.name ?? (teamId ?? 'TBD')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SwissConnector({
  curCol, nextCol, curOffset, nextOffset, globalH,
}: {
  curCol: RoundColumn; nextCol: RoundColumn
  curOffset: number; nextOffset: number; globalH: number
}) {
  const svgH = globalH
  const mx = CONN_W / 2
  const lines: [number, number, number, number][] = []

  const curItems = getColumnItems(curCol)
  const nextItems = getColumnItems(nextCol)

  for (let i = 0; i < curItems.length; i++) {
    const item = curItems[i]
    if (item.kind !== 'pool') continue
    const pool = item.pool
    const srcY = itemCenterY(i, curItems, curCol) + curOffset

    const wIdx = findItemIdx(nextItems, pool.wins + 1, pool.losses)
    const lIdx = findItemIdx(nextItems, pool.wins, pool.losses + 1)
    const t1Y = wIdx >= 0 ? itemCenterY(wIdx, nextItems, nextCol) + nextOffset : null
    const t2Y = lIdx >= 0 ? itemCenterY(lIdx, nextItems, nextCol) + nextOffset : null
    pushConnectorLines(lines, srcY, t1Y, t2Y, mx)
  }

  return (
    <svg width={CONN_W} height={svgH} style={{ flexShrink: 0, display: 'block' }}>
      <g stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none">
        {lines.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  )
}

function pushConnectorLines(
  lines: [number, number, number, number][],
  srcY: number,
  t1Y: number | null,
  t2Y: number | null,
  mx: number,
) {
  if (t1Y !== null && t2Y !== null) {
    const minY = Math.min(t1Y, t2Y, srcY)
    const maxY = Math.max(t1Y, t2Y, srcY)
    lines.push([0, srcY, mx, srcY])
    lines.push([mx, minY, mx, maxY])
    lines.push([mx, t1Y, CONN_W, t1Y])
    lines.push([mx, t2Y, CONN_W, t2Y])
  } else if (t1Y !== null) {
    lines.push([0, srcY, mx, srcY])
    lines.push([mx, Math.min(srcY, t1Y), mx, Math.max(srcY, t1Y)])
    lines.push([mx, t1Y, CONN_W, t1Y])
  } else if (t2Y !== null) {
    lines.push([0, srcY, mx, srcY])
    lines.push([mx, Math.min(srcY, t2Y), mx, Math.max(srcY, t2Y)])
    lines.push([mx, t2Y, CONN_W, t2Y])
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SwissView({ phase, matches, teams }: Props) {
  const teamIds = phase.config.swissTeamIds ?? []
  const advW = phase.config.advanceWins ?? 2
  const elimL = phase.config.eliminateLosses ?? 2
  const confirmedRounds = phase.config.confirmedRounds ?? []
  const totalTeams = teamIds.length

  const rawColumns = buildColumns(
    matches, totalTeams, teamIds, advW, elimL, confirmedRounds,
    phase.config.bo, phase.config.roundBo as Record<string, number> | undefined,
  )

  const exitMap = buildExitGroups(matches, totalTeams, teamIds, advW, elimL, confirmedRounds)

  const columns: RoundColumn[] = rawColumns.map(col => ({
    ...col,
    exitGroups: exitMap.get(col.round) ?? [],
  }))

  // Add extra final column for exits beyond the last regular round
  const maxColRound = rawColumns.at(-1)?.round ?? 0
  for (const [r, groups] of exitMap) {
    if (r > maxColRound) {
      columns.push({ round: r, bo: 0, pools: [], exitGroups: groups, confirmed: true })
    }
  }
  columns.sort((a, b) => a.round - b.round)

  if (teamIds.length === 0 && matches.length === 0) {
    return (
      <p className="text-white/25 text-sm text-center py-6">
        Configura los equipos y genera las rondas desde el panel de administración.
      </p>
    )
  }

  const teamById = new Map(teams.map(t => [t.id, t]))
  const globalMaxH = Math.max(...columns.map(colTotalHeight), HEADER_H)
  const colOffset = (col: RoundColumn) => Math.round((globalMaxH - colTotalHeight(col)) / 2)

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
        {columns.map((col, ci) => (
          <div key={col.round} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ width: COL_W, flexShrink: 0, height: globalMaxH, display: 'flex', flexDirection: 'column' }}>
              {/* Header — always at the top */}
              {col.pools.length > 0 ? (
                <div style={{ height: HEADER_H }} className="flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                    Ronda {col.round}
                  </span>
                </div>
              ) : (
                <div style={{ height: HEADER_H }} />
              )}
              {/* Items — centered in remaining height */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: POOL_GAP,
                padding: '0 4px',
              }}>
                {getColumnItems(col).map(item =>
                  item.kind === 'pool' ? (
                    <PoolBlock
                      key={`pool-${item.pool.wins}-${item.pool.losses}`}
                      pool={item.pool}
                      bo={col.bo}
                      confirmed={col.confirmed}
                      teamById={teamById}
                    />
                  ) : (
                    <ExitGroupBlock
                      key={`exit-${item.group.wins}-${item.group.losses}`}
                      group={item.group}
                      teamById={teamById}
                    />
                  )
                )}
              </div>
            </div>
            {ci < columns.length - 1 && (
              <SwissConnector
                curCol={col}
                nextCol={columns[ci + 1]}
                curOffset={colOffset(col)}
                nextOffset={colOffset(columns[ci + 1])}
                globalH={globalMaxH}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
