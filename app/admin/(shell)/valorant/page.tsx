'use client'
import { useState } from 'react'
import ValorantProfileCard from '@/components/ValorantProfileCard'
import type { CompetitiveProfile } from '@/lib/valorant'

type QueryData = { availability: string; fetchedAt?: string; data?: unknown; lastAttemptAt?: string }
type Preview = {
  fixture?: boolean
  error?: string
  identity?: QueryData
  content?: QueryData
  history?: QueryData
  detail?: QueryData
  profile?: Partial<CompetitiveProfile>
  lastKnownProfile?: Partial<CompetitiveProfile>
}

export default function ValorantPreview() {
  const [riotId, setRiotId] = useState('')
  const [previousId, setPreviousId] = useState('')
  const [output, setOutput] = useState<Preview>()
  const [stale, setStale] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load(fixture = false) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(fixture ? '/api/admin/valorant?mode=fixture' : `/api/admin/valorant?riotId=${encodeURIComponent(riotId)}`, { cache: 'no-store' })
      const next: Preview = await response.json()
      if (!response.ok) { setError(next.error ?? 'Consulta no disponible'); return }
      let retained = false
      if (!fixture && !output?.fixture && previousId === riotId && output) {
        for (const key of ['identity', 'content', 'history', 'detail'] as const) {
          const old = output[key]
          const latest = next[key]
          if (old?.data && latest?.availability !== 'available') {
            retained = true
            next[key] = { ...latest, availability: latest?.availability ?? 'unavailable', data: old.data, fetchedAt: old.fetchedAt, lastAttemptAt: latest?.fetchedAt }
          }
        }
        if (next.profile?.availability !== 'available') {
          next.lastKnownProfile = output.profile?.availability === 'available' ? output.profile : output.lastKnownProfile
          retained ||= Boolean(next.lastKnownProfile)
        }
      }
      setStale(retained)
      setOutput(next)
      setPreviousId(fixture ? '' : riotId)
    } catch { setError('Fallo temporal de conexión. Los datos anteriores conservan su fecha.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">Perfil competitivo · Valorant</h1>
    <p>Prototipo privado de desarrollo. La publicación de datos personales está pendiente de acceso de producción y consentimiento RSO.</p>
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void load() }}>
      <input aria-label="Riot ID" placeholder="Nombre#TAG" required value={riotId} onChange={e => setRiotId(e.target.value)} className="border rounded p-2" />
      <button disabled={busy} className="bg-rose-800 rounded p-2">{busy ? 'Consultando…' : 'Consultar perfil oficial'}</button>
    </form>
    <button disabled={busy} className="rounded bg-white/10 p-2" onClick={() => void load(true)}>Ver fixture de desarrollo</button>
    {error && <p role="alert">{error}</p>}
    {stale && <p role="status">La última consulta no está disponible. Se conservan datos anteriores con su fecha.</p>}
    {output?.fixture && <p className="text-amber-300">DATOS SIMULADOS · Fixture privado de desarrollo</p>}
    <p>Un rango observado en una partida no es el rango actual. No aparecer en una página de clasificación significa «no disponible».</p>
    {output && <ValorantProfileCard profile={output.profile} />}
    {output?.lastKnownProfile && <div><h2>Última clasificación conocida (datos anteriores)</h2><ValorantProfileCard profile={output.lastKnownProfile} /></div>}
    {output && <details><summary>Estado e historial de las consultas oficiales</summary><pre className="text-xs whitespace-pre-wrap overflow-auto rounded border p-4">{JSON.stringify(output, null, 2)}</pre></details>}
  </div>
}
