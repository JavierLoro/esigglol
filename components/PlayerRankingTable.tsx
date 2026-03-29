'use client'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PlayerRow } from '@/lib/types'
import { clsx } from 'clsx'
import { ChevronUp, ChevronDown, TriangleAlert } from 'lucide-react'

type SortKey = 'rank' | 'level' | 'winrate' | 'wins' | 'lp'

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

const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 14, GRANDMASTER: 13, MASTER: 12,
  DIAMOND: 11, EMERALD: 10, PLATINUM: 9, GOLD: 8,
  SILVER: 7, BRONZE: 6, IRON: 5, UNRANKED: 0,
}
const RANK_ORDER: Record<string, number> = { I: 4, II: 3, III: 2, IV: 1 }

interface Props {
  rows: PlayerRow[]
}

export default function PlayerRankingTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showSubs, setShowSubs] = useState(true)

  const getPrimary = (r: PlayerRow) => r.primaryRole ?? ''
  const isSub = (r: PlayerRow) => r.primaryRole === 'Suplente'

  const roles = ['all', ...Array.from(new Set(rows.flatMap(r => [getPrimary(r), r.secondaryRole].filter((x): x is string => Boolean(x)))))]

  const sorted = useMemo(() => {
    const filtered = rows.filter(r => {
      if (!showSubs && isSub(r)) return false
      if (roleFilter !== 'all' && getPrimary(r) !== roleFilter && r.secondaryRole !== roleFilter) return false
      if (search && !r.summonerName.toLowerCase().includes(search.toLowerCase()) &&
          !r.teamName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      // Players with apiError always go last
      if (a.apiError !== b.apiError) return a.apiError ? 1 : -1

      let diff = 0
      if (sortKey === 'rank') {
        diff = (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) ||
               (RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) ||
               (a.lp - b.lp)
      } else if (sortKey === 'level') diff = a.level - b.level
      else if (sortKey === 'winrate') diff = a.winrate - b.winrate
      else if (sortKey === 'wins') diff = a.wins - b.wins
      else if (sortKey === 'lp') diff = a.lp - b.lp
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rows, sortKey, sortDir, search, roleFilter, showSubs])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortIcon = (k: SortKey) => {
    if (sortKey !== k) return <ChevronUp size={12} className="text-white/20" />
    return sortDir === 'desc' ? <ChevronDown size={12} className="text-[#0097D7]" /> : <ChevronUp size={12} className="text-[#0097D7]" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            placeholder="Buscar jugador o equipo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#0097D7]/50 w-full sm:w-56"
          />
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer sm:ml-auto">
            <input type="checkbox" checked={showSubs} onChange={e => setShowSubs(e.target.checked)} className="accent-[#0097D7]" />
            Mostrar suplentes
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                roleFilter === r ? 'bg-[#0097D7] text-white' : 'bg-white/5 text-white/50 hover:text-white'
              )}
            >
              {r === 'all' ? 'Todos' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-white/5">
            <tr className="text-white/40 text-xs border-b border-white/10">
              <th className="text-left px-4 py-3 w-8">#</th>
              <th className="text-left px-4 py-3">Jugador</th>
              <th className="text-left px-3 py-3">Equipo</th>
              <th className="text-left px-3 py-3">Rol</th>
              <th className="px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('rank')}>
                <span className="flex items-center justify-center gap-1">Rango {sortIcon('rank')}</span>
              </th>
              <th className="px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('lp')}>
                <span className="flex items-center justify-center gap-1">LP {sortIcon('lp')}</span>
              </th>
              <th className="px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('winrate')}>
                <span className="flex items-center justify-center gap-1">Winrate {sortIcon('winrate')}</span>
              </th>
              <th className="px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('wins')}>
                <span className="flex items-center justify-center gap-1">Partidas {sortIcon('wins')}</span>
              </th>
              <th className="px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('level')}>
                <span className="flex items-center justify-center gap-1">Nivel {sortIcon('level')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.summonerName}-${r.teamId}`} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-white/30">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {r.profileIconId ? (
                      <Image src={`/api/ddragon/profileicon/${r.profileIconId}`} alt="" width={28} height={28} className="rounded shrink-0" unoptimized />
                    ) : (
                      <div className="w-7 h-7 rounded bg-white/10 shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{r.summonerName.split('#')[0]}</span>
                      <span className="text-xs text-white/30">#{r.summonerName.split('#')[1]}</span>
                    </div>
                    {isSub(r) && <span className="text-xs text-white/30">(sup)</span>}
                    {r.apiError && <TriangleAlert size={13} className="text-yellow-400 shrink-0" />}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {r.teamId ? (
                    <Link href={`/equipos/${r.teamId}`} className="flex items-center gap-2 hover:text-white transition-colors group">
                      {r.teamLogo && <Image src={r.teamLogo} alt={r.teamName} width={18} height={18} className="rounded" />}
                      <span className="text-white/70 text-xs group-hover:text-white">{r.teamName}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      {r.teamLogo && <Image src={r.teamLogo} alt={r.teamName} width={18} height={18} className="rounded" />}
                      <span className="text-white/70 text-xs">{r.teamName}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  <span className="text-white/70">{getPrimary(r)}</span>
                  {r.secondaryRole && <span className="text-white/30"> / {r.secondaryRole}</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={clsx('font-bold text-xs flex items-center justify-center gap-1.5', TIER_COLORS[r.tier])}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/ddragon/ranked/${r.tier.toLowerCase()}.svg`} alt={r.tier} className="w-8 h-8 shrink-0" />
                    {r.tier === 'UNRANKED' ? 'Unranked' : `${r.tier} ${r.rank}`}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-white/70">{r.lp}</td>
                <td className="px-3 py-3 text-center">
                  <span className={clsx(
                    'font-medium',
                    r.winrate >= 55 ? 'text-green-400' : r.winrate >= 50 ? 'text-white/70' : 'text-red-400/70'
                  )}>
                    {r.winrate}%
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-white/50 text-xs">
                  <span className="text-green-400">{r.wins}V</span>
                  <span className="text-white/20 mx-1">/</span>
                  <span className="text-red-400">{r.losses}D</span>
                </td>
                <td className="px-3 py-3 text-center text-white/40">{r.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-white/30 text-sm">No hay resultados</div>
        )}
      </div>
    </div>
  )
}
