'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ValorantSandboxKey({ tournamentId }: { tournamentId: string }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const context = `?tournament=${encodeURIComponent(tournamentId)}&game=valorant`
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Pruebas de ranking · Valorant</h1>
    <p>Base de pruebas independiente · 6 equipos · 30 jugadores</p>
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setReady(false); setMessage('')
      try {
        const response = await fetch('/api/admin/pruebas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
        const data = await response.json()
        setReady(response.ok)
        setMessage(response.ok ? `Clave comprobada. Acto: ${data.act}. Ya puedes abrir el ranking.` : data.error ?? 'Consulta no disponible.')
      } catch { setMessage('No se pudo conectar. Vuelve a intentarlo.') }
      finally { setKey(''); setBusy(false) }
    }}>
      <label className="block" htmlFor="valorant-test-key">Clave de desarrollo de hoy</label>
      <input id="valorant-test-key" type="password" autoComplete="off" required value={key} onChange={event => setKey(event.target.value)} className="w-full max-w-xl rounded border border-white/20 bg-white/5 p-3" />
      <p className="text-sm text-white/60">Se mantiene en memoria hasta detener este entorno. No se guarda en archivos ni en SQLite.</p>
      <button disabled={busy} className="rounded bg-rose-800 px-4 py-2">{busy ? 'Comprobando…' : 'Comprobar clave'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <div className="flex flex-wrap gap-4">
      <Link href={`/ranking${context}`} className="underline">{ready ? 'Ver ranking con datos oficiales' : 'Ver ranking'}</Link>
      <Link href={`/equipos${context}`} className="underline">Ver equipos de pruebas</Link>
      <Link href={`/admin/equipos${context}`} className="underline">Administrar equipos</Link>
    </div>
  </div>
}
