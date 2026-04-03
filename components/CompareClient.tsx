'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Team, Match } from '@/lib/types'
import type { PlayerRow } from '@/lib/types'
import type { PlayerChampionData } from '@/components/ChampionBubbles'
import { clsx } from 'clsx'
import RefreshStatsButton from '@/components/RefreshStatsButton'

interface Props {
  teams: Team[]
  allStats: Record<string, PlayerRow[]>
  matches: Match[]
  lastUpdated: string | null
  champData: Record<string, PlayerChampionData>
  isAdmin: boolean
  initialTeam1Id?: string
  initialTeam2Id?: string
}

const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 14, GRANDMASTER: 13, MASTER: 12,
  DIAMOND: 11, EMERALD: 10, PLATINUM: 9, GOLD: 8,
  SILVER: 7, BRONZE: 6, IRON: 5, UNRANKED: 0,
}
const RANK_ORDER: Record<string, number> = { I: 4, II: 3, III: 2, IV: 1 }

const ROLE_ORDER: Record<string, number> = { Top: 0, Jungle: 1, Mid: 2, Bot: 3, Support: 4, Fill: 5 }

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

type ChampFilter = 'mastery' | 'season' | 'kda' | 'recent'

const CHAMP_FILTERS: Array<{ key: ChampFilter; label: string }> = [
  { key: 'mastery', label: 'Maestría' },
  { key: 'season', label: 'Jugados' },
  { key: 'kda', label: 'KDA' },
  { key: 'recent', label: 'Recientes' },
]

interface DisplayChamp {
  championName: string
  label: string
}

function getTopChamps(filter: ChampFilter, data: PlayerChampionData, max = 4): DisplayChamp[] {
  switch (filter) {
    case 'mastery':
      return data.mastery.slice(0, max).map(c => ({
        championName: c.championName,
        label: `${c.masteryPoints.toLocaleString('es-ES')} pts`,
      }))
    case 'season':
      return data.season.slice(0, max).map(c => ({
        championName: c.championName,
        label: `${c.games}g ${c.winrate}%`,
      }))
    case 'kda':
      return data.season
        .filter(c => c.games >= 3)
        .sort((a, b) => b.kda - a.kda)
        .slice(0, max)
        .map(c => ({
          championName: c.championName,
          label: `KDA ${c.kda}`,
        }))
    case 'recent':
      return data.recent.slice(0, max).map(c => ({
        championName: c.championName,
        label: `${c.games}/20`,
      }))
  }
}

function tierScore(tier: string, rank: string, lp: number) {
  return (TIER_ORDER[tier] ?? 0) * 10000 + (RANK_ORDER[rank] ?? 0) * 1000 + lp
}

function avgStat(players: PlayerRow[], key: keyof PlayerRow): number {
  const nums = players.filter(p => p.primaryRole !== 'Suplente').map(p => p[key] as number)
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function H2H({ team1Id, team2Id, matches }: { team1Id: string; team2Id: string; matches: Match[] }) {
  const h2h = matches.filter(m =>
    (m.team1Id === team1Id && m.team2Id === team2Id) ||
    (m.team1Id === team2Id && m.team2Id === team1Id)
  )

  let t1wins = 0, t2wins = 0
  for (const m of h2h) {
    if (!m.result) continue
    const t1isTeam1 = m.team1Id === team1Id
    const t1won = m.result.team1Score > m.result.team2Score
    if ((t1isTeam1 && t1won) || (!t1isTeam1 && !t1won)) t1wins++
    else t2wins++
  }

  if (h2h.length === 0) return <p className="text-white/30 text-sm">Sin enfrentamientos previos</p>

  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Historial H2H</h3>
      <div className="flex items-center gap-4 justify-center">
        <span className="text-2xl font-bold text-[#0097D7]">{t1wins}</span>
        <span className="text-white/30">-</span>
        <span className="text-2xl font-bold text-[#0097D7]">{t2wins}</span>
      </div>
      <p className="text-center text-xs text-white/30 mt-1">{h2h.length} enfrentamientos en el torneo</p>
    </div>
  )
}

function StatBar({ label, val1, val2, format }: { label: string; val1: number; val2: number; format?: (n: number) => string }) {
  const max = Math.max(val1, val2) || 1
  const fmt = format ?? (n => n.toFixed(0))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-white/40">
        <span className={val1 >= val2 ? 'text-white font-medium' : ''}>{fmt(val1)}</span>
        <span className="text-white/30">{label}</span>
        <span className={val2 >= val1 ? 'text-white font-medium' : ''}>{fmt(val2)}</span>
      </div>
      <div className="flex gap-1 items-center h-1.5">
        <div className="flex-1 bg-white/5 rounded-full overflow-hidden flex justify-end">
          <div className="h-full bg-[#0097D7] rounded-full transition-all" style={{ width: `${(val1 / max) * 100}%` }} />
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[#0097D7] rounded-full transition-all" style={{ width: `${(val2 / max) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function PlayerCard({
  player,
  champFilter,
  champDataMap,
  mirrored,
  selected,
  onSelect,
  dragHandlers,
}: {
  player: PlayerRow
  champFilter: ChampFilter
  champDataMap: Record<string, PlayerChampionData>
  mirrored: boolean
  selected: boolean
  onSelect: () => void
  dragHandlers: {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
}) {
  const champs = champDataMap[player.summonerName]
    ? getTopChamps(champFilter, champDataMap[player.summonerName], 6)
    : []

  const iconBaseUrl = champDataMap[player.summonerName]?.iconBaseUrl ?? ''

  return (
    <div
      className={clsx(
        'px-3 py-3 flex items-center gap-2 cursor-pointer transition-all select-none',
        mirrored && 'flex-row-reverse',
        selected && 'bg-[#0097D7]/10 ring-1 ring-[#0097D7]/40 rounded-lg',
      )}
      onClick={onSelect}
      draggable={dragHandlers.draggable}
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      onDragEnd={dragHandlers.onDragEnd}
    >
      {/* Profile icon */}
      {player.profileIconId ? (
        <Image src={`/api/ddragon/profileicon/${player.profileIconId}`} alt="" width={36} height={36} className="rounded-lg shrink-0" unoptimized />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-white/10 shrink-0" />
      )}

      {/* Name + rank + winrate */}
      <div className={clsx('flex flex-col min-w-0 flex-1', mirrored && 'items-end')}>
        <span className="text-sm font-medium truncate">{player.summonerName.split('#')[0]}</span>
        <div className={clsx('flex items-center gap-1', mirrored && 'flex-row-reverse')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/ddragon/ranked/${player.tier.toLowerCase()}.svg`} alt="" className="w-4 h-4 shrink-0" />
          <span className={clsx('text-xs font-semibold', TIER_COLORS[player.tier])}>
            {player.tier === 'UNRANKED' ? 'Unranked' : `${player.tier} ${player.rank}`}
          </span>
          {player.tier !== 'UNRANKED' && (
            <span className="text-[10px] text-white/30">{player.lp}LP</span>
          )}
        </div>
        {(player.wins + player.losses) > 0 && (
          <span className={clsx(
            'text-[10px] font-semibold',
            player.winrate >= 55 ? 'text-green-400' : player.winrate >= 50 ? 'text-white/40' : 'text-red-400/70',
          )}>
            {player.winrate}% WR
          </span>
        )}
      </div>

      {/* Champion bubbles — inline, hidden on small screens */}
      {champs.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1.5 min-w-0">
          {champs.map(c => (
            <div key={c.championName} className="group relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors">
                {iconBaseUrl ? (
                  <Image
                    src={`${iconBaseUrl}/${c.championName}.png`}
                    alt={c.championName}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover scale-[1.12]"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-[#0a0e1a] border border-white/15 rounded-md px-2 py-1 text-center shadow-xl whitespace-nowrap">
                  <p className="text-[10px] font-semibold text-white leading-none">{c.championName}</p>
                  <p className="text-[9px] text-white/50">{c.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompareClient({ teams, allStats, matches, lastUpdated, champData, isAdmin, initialTeam1Id, initialTeam2Id }: Props) {
  const [team1Id, setTeam1Id] = useState(teams.find(t => t.id === initialTeam1Id)?.id ?? teams[0]?.id ?? '')
  const [team2Id, setTeam2Id] = useState(teams.find(t => t.id === initialTeam2Id)?.id ?? teams[1]?.id ?? '')
  const [champFilter, setChampFilter] = useState<ChampFilter>('mastery')

  const team1 = teams.find(t => t.id === team1Id)
  const team2 = teams.find(t => t.id === team2Id)
  const stats1 = allStats[team1Id] ?? []
  const stats2 = allStats[team2Id] ?? []

  const starters1 = stats1
    .filter(p => p.primaryRole !== 'Suplente')
    .sort((a, b) => (ROLE_ORDER[a.primaryRole] ?? 99) - (ROLE_ORDER[b.primaryRole] ?? 99))
  const starters2 = stats2
    .filter(p => p.primaryRole !== 'Suplente')
    .sort((a, b) => (ROLE_ORDER[a.primaryRole] ?? 99) - (ROLE_ORDER[b.primaryRole] ?? 99))

  const subs1 = stats1.filter(p => p.primaryRole === 'Suplente')
  const subs2 = stats2.filter(p => p.primaryRole === 'Suplente')

  // Order state: indices into starters arrays
  const [order1, setOrder1] = useState<number[]>([])
  const [order2, setOrder2] = useState<number[]>([])

  // Reset order when teams change (effectiveOrder handles length mismatch)
  const effectiveOrder1 = order1.length === starters1.length ? order1 : starters1.map((_, i) => i)
  const effectiveOrder2 = order2.length === starters2.length ? order2 : starters2.map((_, i) => i)

  const ordered1 = effectiveOrder1.map(i => starters1[i])
  const ordered2 = effectiveOrder2.map(i => starters2[i])

  // Tap-to-swap state
  const [selected, setSelected] = useState<{ side: 1 | 2; idx: number } | null>(null)

  function handleSelect(side: 1 | 2, idx: number) {
    if (selected && selected.side === side && selected.idx !== idx) {
      const setOrder = side === 1 ? setOrder1 : setOrder2
      const currentOrder = side === 1 ? effectiveOrder1 : effectiveOrder2
      const newOrder = [...currentOrder]
      const temp = newOrder[selected.idx]
      newOrder[selected.idx] = newOrder[idx]
      newOrder[idx] = temp
      setOrder(newOrder)
      setSelected(null)
    } else if (selected && selected.side === side && selected.idx === idx) {
      setSelected(null)
    } else {
      setSelected({ side, idx })
    }
  }

  // Drag state
  const dragIdx = useRef<number | null>(null)
  const dragSide = useRef<1 | 2 | null>(null)

  function makeDragHandlers(side: 1 | 2, idx: number) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        dragIdx.current = idx
        dragSide.current = side
        e.dataTransfer.effectAllowed = 'move'
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '0.4'
        }
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragSide.current === side) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        if (dragSide.current !== side || dragIdx.current === null || dragIdx.current === idx) return
        const setOrder = side === 1 ? setOrder1 : setOrder2
        const currentOrder = side === 1 ? effectiveOrder1 : effectiveOrder2
        const newOrder = [...currentOrder]
        const temp = newOrder[dragIdx.current]
        newOrder[dragIdx.current] = newOrder[idx]
        newOrder[idx] = temp
        setOrder(newOrder)
      },
      onDragEnd: () => {
        dragIdx.current = null
        dragSide.current = null
        // Reset opacity on all draggable elements
        document.querySelectorAll('[draggable=true]').forEach(el => {
          (el as HTMLElement).style.opacity = ''
        })
      },
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selectores + Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="grid grid-cols-2 gap-4 flex-1 w-full">
          {[{ id: team1Id, set: setTeam1Id }, { id: team2Id, set: setTeam2Id }].map(({ id, set }, idx) => (
            <div key={idx}>
              <select
                value={id}
                onChange={e => set(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#0097D7]/50"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <RefreshStatsButton lastUpdated={lastUpdated} isAdmin={isAdmin} teamIds={[team1Id, team2Id]} />
      </div>

      {team1 && team2 && team1Id !== team2Id && (
        <>
          {/* Cabecera equipos */}
          <div className="grid grid-cols-2 gap-4">
            {[{ team: team1, stats: starters1 }, { team: team2, stats: starters2 }].map(({ team, stats }) => (
              <Link key={team.id} href={`/equipos/${team.id}`} className="rounded-xl border border-white/10 p-4 flex items-center gap-3 hover:border-white/25 hover:bg-white/[0.03] transition-colors">
                {team.logo && <Image src={team.logo} alt={team.name} width={48} height={48} className="rounded object-contain" />}
                <div>
                  <h2 className="font-bold">{team.name}</h2>
                  <p className="text-xs text-white/40">{stats.length} titulares</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Stats comparadas */}
          <div className="rounded-xl border border-white/10 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Estadísticas medias (titulares)</h3>
            <StatBar
              label="Nivel medio"
              val1={avgStat(starters1, 'level')}
              val2={avgStat(starters2, 'level')}
            />
            <StatBar
              label="Elo promedio"
              val1={avgStat(starters1.map(p => ({ ...p, ts: tierScore(p.tier, p.rank, p.lp) })) as unknown as PlayerRow[], 'ts' as keyof PlayerRow)}
              val2={avgStat(starters2.map(p => ({ ...p, ts: tierScore(p.tier, p.rank, p.lp) })) as unknown as PlayerRow[], 'ts' as keyof PlayerRow)}
              format={n => {
                const tier = Object.entries(TIER_ORDER).sort((a, b) => b[1] - a[1]).find(([, v]) => v <= Math.floor(n / 10000))?.[0] ?? 'UNRANKED'
                return tier
              }}
            />
            <StatBar
              label="Winrate %"
              val1={avgStat(starters1, 'winrate')}
              val2={avgStat(starters2, 'winrate')}
              format={n => `${n.toFixed(1)}%`}
            />
            <StatBar
              label="Partidas (temporada)"
              val1={avgStat(starters1, 'wins') + avgStat(starters1, 'losses')}
              val2={avgStat(starters2, 'wins') + avgStat(starters2, 'losses')}
            />
          </div>

          {/* H2H */}
          <H2H team1Id={team1Id} team2Id={team2Id} matches={matches} />

          {/* Comparativa jugador por jugador */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {/* Header with champion filter */}
            <div className="px-4 py-2 bg-white/5 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Jugadores</span>
              <div className="flex gap-1">
                {CHAMP_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setChampFilter(f.key)}
                    className={clsx(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors',
                      champFilter === f.key
                        ? 'bg-[#0097D7] text-white'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/5',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="px-4 py-1.5 text-[10px] text-white/20 bg-white/[0.02]">
              Haz click en dos jugadores del mismo equipo para intercambiarlos · arrastra para reordenar
            </p>

            <div className="divide-y divide-white/5">
              {ordered1.map((p1, i) => {
                const p2 = ordered2[i]
                return (
                  <div key={`row-${i}`} className="grid grid-cols-2 divide-x divide-white/5">
                    {p1 ? (
                      <PlayerCard
                        player={p1}
                        champFilter={champFilter}
                        champDataMap={champData}
                        mirrored={false}
                        selected={selected?.side === 1 && selected.idx === i}
                        onSelect={() => handleSelect(1, i)}
                        dragHandlers={makeDragHandlers(1, i)}
                      />
                    ) : (
                      <div className="px-4 py-3 text-white/20 text-sm">-</div>
                    )}
                    {p2 ? (
                      <PlayerCard
                        player={p2}
                        champFilter={champFilter}
                        champDataMap={champData}
                        mirrored={true}
                        selected={selected?.side === 2 && selected.idx === i}
                        onSelect={() => handleSelect(2, i)}
                        dragHandlers={makeDragHandlers(2, i)}
                      />
                    ) : (
                      <div className="px-4 py-3 text-white/20 text-sm">-</div>
                    )}
                  </div>
                )
              })}
              {/* Extra rows if team 2 has more starters */}
              {ordered2.length > ordered1.length && ordered2.slice(ordered1.length).map((p2, i) => (
                <div key={`extra-${i}`} className="grid grid-cols-2 divide-x divide-white/5">
                  <div className="px-4 py-3 text-white/20 text-sm">-</div>
                  <PlayerCard
                    player={p2}
                    champFilter={champFilter}
                    champDataMap={champData}
                    mirrored={true}
                    selected={selected?.side === 2 && selected.idx === ordered1.length + i}
                    onSelect={() => handleSelect(2, ordered1.length + i)}
                    dragHandlers={makeDragHandlers(2, ordered1.length + i)}
                  />
                </div>
              ))}

              {/* Suplentes */}
              {(subs1.length > 0 || subs2.length > 0) && (
                <>
                  <div className="grid grid-cols-2 divide-x divide-white/5 bg-white/[0.02]">
                    <div className="px-4 py-1.5 text-[10px] font-bold text-white/30 uppercase tracking-wider">Suplentes</div>
                    <div className="px-4 py-1.5 text-[10px] font-bold text-white/30 uppercase tracking-wider text-right">Suplentes</div>
                  </div>
                  {Array.from({ length: Math.max(subs1.length, subs2.length) }).map((_, i) => (
                    <div key={`sub-${i}`} className="grid grid-cols-2 divide-x divide-white/5 opacity-70">
                      {subs1[i] ? (
                        <PlayerCard
                          player={subs1[i]}
                          champFilter={champFilter}
                          champDataMap={champData}
                          mirrored={false}
                          selected={false}
                          onSelect={() => {}}
                          dragHandlers={{ draggable: false, onDragStart: () => {}, onDragOver: () => {}, onDrop: () => {}, onDragEnd: () => {} }}
                        />
                      ) : (
                        <div className="px-4 py-3 text-white/20 text-sm">-</div>
                      )}
                      {subs2[i] ? (
                        <PlayerCard
                          player={subs2[i]}
                          champFilter={champFilter}
                          champDataMap={champData}
                          mirrored={true}
                          selected={false}
                          onSelect={() => {}}
                          dragHandlers={{ draggable: false, onDragStart: () => {}, onDragOver: () => {}, onDrop: () => {}, onDragEnd: () => {} }}
                        />
                      ) : (
                        <div className="px-4 py-3 text-white/20 text-sm">-</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {team1Id === team2Id && (
        <p className="text-white/40 text-sm text-center py-8">Selecciona dos equipos diferentes para comparar.</p>
      )}
    </div>
  )
}
