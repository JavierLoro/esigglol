'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, Users, Trophy, Calendar, LogOut, Inbox } from 'lucide-react'
import { clsx } from 'clsx'
import RiotResultNotifications from '@/components/admin/RiotResultNotifications'
import { AdminTournamentProvider } from '@/components/admin/AdminTournamentContext'
import type { Tournament } from '@/lib/types'

const navItems = [
  { href: '/admin/apariencia', label: 'Apariencia', icon: LayoutDashboard, global: true },
  { href: '/admin/torneos', label: 'Torneos', icon: Trophy, global: true },
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, global: false },
  { href: '/admin/equipos', label: 'Equipos', icon: Users, global: false },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: Inbox, global: false },
  { href: '/admin/fases', label: 'Fases', icon: Trophy, global: false },
  { href: '/admin/partidos', label: 'Partidos', icon: Calendar, global: false },
] as const

const scopedPaths = new Set<string>(navItems.filter(item => !item.global).map(item => item.href))
const statusLabel = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' } as const

function adminHref(href: string, selected?: Tournament) {
  if (!scopedPaths.has(href) || !selected) return href
  return `${href}?${new URLSearchParams({ tournament: selected.id, game: selected.game })}`
}

async function handleLogout() {
  await fetch('/api/admin/login', { method: 'DELETE' })
  window.location.href = '/admin/login'
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const searchString = search.toString()
  const scoped = scopedPaths.has(pathname)
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [rememberedId, setRememberedId] = useState<string | null>(null)
  const [preferenceLoaded, setPreferenceLoaded] = useState(false)

  useEffect(() => {
    setRememberedId(sessionStorage.getItem('adminTournamentId'))
    setPreferenceLoaded(true)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/admin/torneos', { cache: 'no-store' })
        if (!response.ok) throw new Error('No se pudieron cargar los torneos')
        const items = await response.json() as Tournament[]
        if (active) { setTournaments(items); setLoadError(false) }
      } catch {
        if (active) setLoadError(true)
      }
    }
    void load()
    window.addEventListener('tournaments-updated', load)
    return () => { active = false; window.removeEventListener('tournaments-updated', load) }
  }, [])

  const requestedId = search.get('tournament')
  const explicit = tournaments?.find(item => item.id === requestedId)
  const preferredGame = search.get('game')
  const preferred = preferredGame ? tournaments?.find(item => item.game === preferredGame && item.status === 'published')
    ?? tournaments?.find(item => item.game === preferredGame) : undefined
  const selected = explicit ?? (!requestedId ? (
    preferred
    ?? tournaments?.find(item => item.id === rememberedId)
    ?? tournaments?.find(item => item.status === 'published')
    ?? tournaments?.[0]
  ) : undefined)
  const ready = !scoped || Boolean(preferenceLoaded && tournaments && selected && requestedId === selected.id && preferredGame === selected.game)

  useEffect(() => {
    if (!scoped || !preferenceLoaded || !tournaments || !selected) return
    if (requestedId === selected.id && preferredGame === selected.game) {
      sessionStorage.setItem('adminTournamentId', selected.id)
      return
    }
    const params = new URLSearchParams(searchString)
    params.set('tournament', selected.id)
    params.set('game', selected.game)
    // A full navigation resets forms and data from the previous edition.
    window.location.replace(`${pathname}?${params}`)
  }, [scoped, preferenceLoaded, tournaments, selected, requestedId, preferredGame, searchString, pathname])

  function selectTournament(id: string) {
    const next = tournaments?.find(item => item.id === id)
    if (!next) return
    sessionStorage.setItem('adminTournamentId', next.id)
    window.location.assign(adminHref(pathname, next))
  }

  const context = selected
  const archived = scoped && ready && selected?.status === 'archived'

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {scoped && ready && selected?.game === 'lol' && <RiotResultNotifications key={selected.id} />}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-white/10 bg-[#0d1321] flex-col">
        <div className="px-4 py-5 border-b border-white/10"><span className="text-sm font-bold text-[#0097D7]">Panel Admin</span></div>
        <nav aria-label="Administración" className="flex-1 p-2 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return <Link key={href} href={adminHref(href, context)} className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', active ? 'text-white bg-[#0097D7]/15 font-medium' : 'text-white/60 hover:text-white hover:bg-white/5')}><Icon size={16} />{label}</Link>
          })}
        </nav>
        <div className="p-2 border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"><LogOut size={16} />Cerrar sesión</button>
          <p className="px-3 pt-2 text-[11px] text-white/30 font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION}{process.env.NEXT_PUBLIC_GIT_SHA && <span className="ml-1">{process.env.NEXT_PUBLIC_GIT_SHA.slice(0, 7)}</span>}</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-4 pb-36 md:p-6">
        {scoped && ready && selected && <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0d1321] px-4 py-3">
          <label htmlFor="admin-tournament" className="text-sm font-medium text-white/80">Edición activa</label>
          <select id="admin-tournament" aria-label="Edición activa" value={selected.id} onChange={event => selectTournament(event.target.value)} className="min-w-0 max-w-full rounded-lg border border-white/20 bg-[#1b2739] px-3 py-2 text-sm text-white">
            {(['lol', 'valorant'] as const).map(game => <optgroup key={game} label={game === 'lol' ? 'League of Legends' : 'Valorant'}>{tournaments?.filter(item => item.game === game).map(item => <option key={item.id} value={item.id}>{item.name} · {statusLabel[item.status]}</option>)}</optgroup>)}
          </select>
          <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', selected.status === 'archived' ? 'bg-white/10 text-white/60' : selected.status === 'draft' ? 'bg-amber-300/10 text-amber-200' : 'bg-sky-300/10 text-sky-200')}>{selected.game === 'lol' ? 'LoL' : 'Valorant'} · {statusLabel[selected.status]}</span>
        </div>}
        {archived && <p role="status" className="mb-5 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70">Este torneo está archivado. Puedes consultar sus datos; para editarlo, <Link href="/admin/torneos" className="text-sky-300 underline">reábrelo en Torneos</Link>.</p>}
        {scoped && !ready ? <div role="status" className="text-sm text-white/60">{loadError ? 'No se pudieron cargar los torneos. Recarga la página.' : tournaments && requestedId && !explicit ? 'Torneo no encontrado. Selecciona uno desde Torneos.' : tournaments?.length === 0 ? <span>No hay torneos. <Link href="/admin/torneos" className="text-sky-300 underline">Crea uno en Torneos</Link>.</span> : 'Cargando torneo…'}</div> : scoped && selected ? <AdminTournamentProvider tournament={selected}>{children}</AdminTournamentProvider> : children}
      </div>

      <nav aria-label="Administración móvil" className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-white/10 bg-[#0d1321]/95 px-1 py-1 backdrop-blur">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={adminHref(href, context)} className={clsx('flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px]', pathname === href ? 'text-sky-300' : 'text-white/60 hover:text-white')}><Icon size={18} /><span className="truncate">{label}</span></Link>)}
        <button onClick={handleLogout} className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] text-white/60 hover:text-white"><LogOut size={18} /><span>Salir</span></button>
      </nav>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense><AdminShell>{children}</AdminShell></Suspense>
}
