'use client'
import { useEffect, useState } from 'react'
import type { Tournament } from '@/lib/types'
import { adminRequest, errorMessage, isOk } from '@/lib/admin-client'

export default function TournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [game, setGame] = useState<'lol' | 'valorant'>('lol')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function reload() { const res = await fetch('/api/admin/torneos'); if (res.ok) setItems(await res.json()); else setError('No se pudieron cargar los torneos') }
  useEffect(() => { fetch('/api/admin/torneos').then(res => { if (!res.ok) throw new Error(); return res.json() }).then(setItems).catch(() => setError('No se pudieron cargar los torneos')) }, [])
  async function save(t: Partial<Tournament>) {
    setError('')
    setMessage('')
    const res = await fetch('/api/admin/torneos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
    if (!res.ok) { setError((await res.json()).error); return }
    setName(''); await reload(); window.dispatchEvent(new Event('tournaments-updated'))
  }
  async function remove(t: Tournament) {
    if (!confirm(`¿Eliminar definitivamente el torneo «${t.name}»? Se borrarán sus equipos, accesos, solicitudes, fases, partidos, estadísticas y configuración de OBS. Esta acción no se puede deshacer.`)) return
    setError(''); setMessage(''); setDeleting(t.id)
    try {
      await adminRequest(fetch('/api/admin/torneos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) }), isOk)
      setItems(current => current.filter(item => item.id !== t.id))
      if (sessionStorage.getItem('adminTournamentId') === t.id) sessionStorage.removeItem('adminTournamentId')
      window.dispatchEvent(new Event('tournaments-updated'))
      setMessage(`Torneo «${t.name}» eliminado`)
    } catch (error) { setError(errorMessage(error)) } finally { setDeleting(null) }
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Torneos</h1>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void save({ name, game, slug: `${game}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`, platform: 'pc', region: 'eu', status: 'draft' }) }}>
      <input aria-label="Nombre del torneo" required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del torneo" className="border rounded p-2" />
      <select aria-label="Juego del torneo" value={game} onChange={e => setGame(e.target.value as 'lol' | 'valorant')}><option value="lol">LoL · PC · Europa</option><option value="valorant">Valorant · PC · Europa</option></select>
      <button className="bg-sky-700 rounded p-2">Crear borrador</button>
    </form>
    {items.map(t => <form key={`${t.id}-${t.status}`} className="border border-white/15 rounded p-4 flex flex-wrap gap-3 items-center" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void save({ ...t, name: String(form.get('name')), status: String(form.get('status')) as Tournament['status'] }) }}>
      <span>{t.game === 'lol' ? '⚔ LoL' : '◎ Valorant'}</span><input aria-label={`Nombre de ${t.name}`} name="name" defaultValue={t.name} required className="border rounded p-2" />
      <select name="status" aria-label={`Estado de ${t.name}`} defaultValue={t.status}><option value="draft">Borrador</option><option value="published">Publicado / reabrir</option><option value="archived">Archivado</option></select>
      <button disabled={deleting === t.id} className="rounded bg-white/10 p-2">Guardar</button><button type="button" disabled={deleting === t.id} className="rounded border border-white/20 px-3 py-2 text-sm" onClick={() => void save({ ...t, status: t.status === 'archived' ? 'published' : 'archived' })}>{t.status === 'archived' ? 'Reabrir torneo' : 'Archivar torneo'}</button><a className="text-sky-300 underline" href={`/admin/equipos?tournament=${t.id}&game=${t.game}`}>Gestionar participantes</a>
      <button type="button" disabled={deleting !== null} aria-label={`Eliminar torneo ${t.name}`} className="rounded border border-red-400/40 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50" onClick={() => void remove(t)}>{deleting === t.id ? 'Eliminando…' : 'Eliminar torneo'}</button>
    </form>)}
  </div>
}
