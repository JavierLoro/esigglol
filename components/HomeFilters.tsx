'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Crosshair, Swords } from 'lucide-react'
import type { Tournament } from '@/lib/types'

type GameFilter = 'all' | 'lol' | 'valorant'
type TournamentOption = Pick<Tournament, 'id' | 'name' | 'game'>

export default function HomeFilters({ tournaments, game, tournamentId }: { tournaments: TournamentOption[]; game: GameFilter; tournamentId?: string }) {
  const router = useRouter()
  const selected = tournaments.find(item => item.id === tournamentId)
  const available = tournaments.filter(item => game === 'all' || item.game === game)

  function gameHref(next: GameFilter) {
    if (next === 'all') return '/?game=all'
    const params = new URLSearchParams({ game: next })
    if (selected?.game === next) params.set('tournament', selected.id)
    return `/?${params}`
  }

  function chooseTournament(id: string) {
    const next = tournaments.find(item => item.id === id)
    router.push(next ? `/?${new URLSearchParams({ game: next.game, tournament: next.id })}` : gameHref(game), { scroll: false })
  }

  const filters = [
    { value: 'all' as const, label: 'Todos' },
    { value: 'lol' as const, label: 'LoL', Icon: Swords },
    { value: 'valorant' as const, label: 'Valorant', Icon: Crosshair },
  ]

  return <div className="rounded-xl border border-white/10 bg-[#0d1321] p-4 flex flex-wrap items-end gap-4">
    <div className="w-full space-y-2 sm:w-auto">
      <span className="block text-sm font-medium text-white/80">Filtrar partidos</span>
      <nav aria-label="Filtrar por juego" className="flex flex-wrap gap-2">
        {filters.map(({ value, label, Icon }) => <Link key={value} href={gameHref(value)} scroll={false} aria-current={game === value ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-400 ${game === value ? value === 'valorant' ? 'border-rose-300/50 bg-rose-300/10 text-rose-200' : 'border-sky-300/50 bg-sky-300/10 text-sky-200' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
          {Icon && <Icon size={15} aria-hidden="true" />}{label}
        </Link>)}
      </nav>
    </div>
    <label htmlFor="home-tournament-filter" className="flex w-full min-w-0 flex-col gap-2 text-sm font-medium text-white/80 sm:w-auto sm:max-w-xs sm:flex-1">
      Torneo
      <select id="home-tournament-filter" value={selected?.id ?? ''} onChange={event => chooseTournament(event.target.value)} className="min-h-10 w-full rounded-lg border border-white/20 bg-[#1b2739] px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-400">
        <option value="">Todos los torneos{game === 'lol' ? ' de LoL' : game === 'valorant' ? ' de Valorant' : ''}</option>
        {game === 'all' ? (['lol', 'valorant'] as const).map(group => <optgroup key={group} label={group === 'lol' ? 'LoL' : 'Valorant'}>{available.filter(item => item.game === group).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)
          : available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  </div>
}
