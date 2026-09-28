'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Swords, Menu, X, ChevronDown } from 'lucide-react'
import type { Tournament } from '@/lib/types'

const sections = [
  { href: '/fases', label: 'Fases' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/comparar', label: 'Comparar' },
]
const games = [{ id: 'lol', label: '⚔ LoL' }, { id: 'valorant', label: '◎ Valorant' }] as const
const optionClass = 'block rounded px-4 py-3 text-sm text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400'

export default function Navbar() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [open, setOpen] = useState(false)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [status, setStatus] = useState('Cargando…')
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => fetch('/api/data/torneos', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setTournaments(data); setStatus('Sin torneos') })
      .catch(() => { if (!controller.signal.aborted) setStatus('No disponible') })
    void refresh()
    window.addEventListener('tournaments-updated', refresh)
    return () => { controller.abort(); window.removeEventListener('tournaments-updated', refresh) }
  }, [])
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!header.current?.contains(event.target as Node)) {
        header.current?.querySelectorAll('details[open]').forEach(el => el.removeAttribute('open'))
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  function close() {
    setOpen(false)
    header.current?.querySelectorAll('details[open]').forEach(el => el.removeAttribute('open'))
  }
  function destination(href: string, tournament: Tournament) {
    return `${href}?${new URLSearchParams({ game: tournament.game, tournament: tournament.id })}`
  }
  function tournamentOption(href: string, t: Tournament, label: string) {
    return <Link key={t.id} href={destination(href, t)} onClick={close} className={optionClass}>{label}</Link>
  }
  const selected = tournaments.find(t => t.id === search.get('tournament'))
  const currentGame = search.get('game')
  const homeHref = selected ? destination('/', selected)
    : currentGame === 'lol' || currentGame === 'valorant' ? `/?game=${currentGame}` : '/'
  if (pathname.startsWith('/overlay')) return null

  return <header ref={header} onKeyDown={event => {
    if (event.key === 'Escape') {
      const details = (event.target as HTMLElement).closest('details')
      if (details?.open) { details.open = false; details.querySelector('summary')?.focus() }
      else close()
    }
  }} className="bg-[#0d1321]/95 backdrop-blur sticky top-0 z-50 border-b border-white/8">
    <div className="h-0.5 bg-gradient-to-r from-[#0097D7] via-[#33b3e8] to-[#B30133]" />
    <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center gap-x-4">
      <Link href="/" onClick={close} className="h-14 flex items-center gap-2 font-bold text-base text-white shrink-0">
        <span className="w-7 h-7 rounded bg-[#0097D7] flex items-center justify-center"><Swords size={15} /></span>
        <span>ESI<span className="text-[#0097D7]">gg</span>.lol</span>
      </Link>
      <button onClick={() => setOpen(value => !value)} aria-label="Menú" aria-expanded={open} aria-controls="public-navigation" className="ml-auto md:hidden p-2 text-white/75">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav id="public-navigation" aria-label="Navegación principal" className={clsx('order-last w-full md:order-none md:w-auto md:flex md:items-center', open ? 'block' : 'hidden')}>
        <Link href={homeHref} onClick={close} aria-current={pathname === '/' ? 'page' : undefined} className={clsx('px-4 py-4 flex items-center text-sm font-medium border-b-2 focus-visible:outline-2 focus-visible:outline-sky-400', pathname === '/' ? 'text-white border-[#0097D7]' : 'text-white/60 border-transparent hover:text-white')}>Inicio</Link>
        {sections.map(({ href, label }) => <details key={href} name="public-section" className="relative group/section">
          <summary className={clsx('list-none cursor-pointer px-4 py-4 flex items-center gap-2 text-sm font-medium border-b-2 focus-visible:outline-2 focus-visible:outline-sky-400', pathname === href ? 'text-white border-[#0097D7]' : 'text-white/60 border-transparent hover:text-white')}>
            {label}<ChevronDown size={14} className="group-open/section:rotate-180" />
          </summary>
          <div className="md:absolute md:top-full md:left-0 md:w-72 p-2 rounded-lg bg-[#111a2c] border border-white/10 shadow-xl max-h-[65vh] overflow-y-auto">
            {games.filter(game => href !== '/comparar' || game.id === 'lol').map(game => {
              const options = tournaments.filter(t => t.game === game.id)
              if (options.length === 0) return null
              if (options.length === 1) return tournamentOption(href, options[0], game.label)
              return <details key={game.id} className="group/game">
                <summary className={`${optionClass} list-none cursor-pointer flex items-center justify-between`}>{game.label}<ChevronDown size={14} className="group-open/game:rotate-180" /></summary>
                <div className="ml-4 border-l border-white/15">
                  {options.map(t => tournamentOption(href, t, t.name))}
                </div>
              </details>
            })}
            {tournaments.length === 0 && <span className="block px-4 py-3 text-sm text-white/40">{status === 'Sin torneos' ? 'Sin torneos activos' : status}</span>}
          </div>
        </details>)}
        <Link href="/equipo" onClick={close} className={optionClass}>Mi equipo</Link>
        <Link href="/admin" onClick={close} className="block px-4 py-3 text-xs text-white/40 md:hidden">Admin</Link>
      </nav>
      <Link href="/admin" className="hidden md:block ml-auto text-xs text-white/40 hover:text-white">Admin</Link>
    </div>
    {selected && !pathname.startsWith('/admin') && pathname !== '/equipo' && <div className="max-w-7xl mx-auto px-4 pb-2 text-xs text-white/60">{selected.game === 'lol' ? '⚔ LoL' : '◎ Valorant'} · {selected.name}</div>}
  </header>
}
