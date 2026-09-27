'use client'
import { useEffect, useState } from 'react'
import type { Tournament } from '@/lib/types'

export default function TournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [game, setGame] = useState<'lol' | 'valorant'>('lol')
  async function reload() { const res = await fetch('/api/admin/torneos'); if (res.ok) setItems(await res.json()); else setError('No se pudieron cargar los torneos') }
  useEffect(() => { fetch('/api/admin/torneos').then(res => { if (!res.ok) throw new Error(); return res.json() }).then(setItems).catch(() => setError('No se pudieron cargar los torneos')) }, [])
  async function save(t: Partial<Tournament>) {
    setError('')
    const res = await fetch('/api/admin/torneos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
    if (!res.ok) { setError((await res.json()).error); return }
    setName(''); await reload(); window.dispatchEvent(new Event('tournaments-updated'))
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Torneos</h1>{error && <p role="alert">{error}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void save({ name, game, slug: `${game}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`, platform: 'pc', region: 'eu', status: 'draft' }) }}>
      <input aria-label="Nombre del torneo" required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del torneo" className="border rounded p-2" />
      <select aria-label="Juego del torneo" value={game} onChange={e => setGame(e.target.value as 'lol' | 'valorant')}><option value="lol">LoL · PC · Europa</option><option value="valorant">Valorant · PC · Europa</option></select>
      <button className="bg-sky-700 rounded p-2">Crear borrador</button>
    </form>
    {items.map(t => <form key={`${t.id}-${t.status}`} className="border border-white/15 rounded p-4 flex flex-wrap gap-3 items-center" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void save({ ...t, name: String(form.get('name')), status: String(form.get('status')) as Tournament['status'] }) }}>
      <span>{t.game === 'lol' ? '⚔ LoL' : '◎ Valorant'}</span><input aria-label={`Nombre de ${t.name}`} name="name" defaultValue={t.name} required className="border rounded p-2" />
      <select name="status" aria-label={`Estado de ${t.name}`} defaultValue={t.status}><option value="draft">Borrador</option><option value="published">Publicado / reabrir</option><option value="archived">Archivado</option></select>
      <button className="rounded bg-white/10 p-2">Guardar</button><button type="button" className="rounded border border-white/20 px-3 py-2 text-sm" onClick={() => void save({ ...t, status: t.status === 'archived' ? 'published' : 'archived' })}>{t.status === 'archived' ? 'Reabrir torneo' : 'Archivar torneo'}</button><a className="text-sky-300 underline" href={`/admin/equipos?tournament=${t.id}&game=${t.game}`}>Gestionar participantes</a>
    </form>)}
  </div>
}
