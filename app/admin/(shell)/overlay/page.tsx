'use client'

import { useEffect, useState } from 'react'
import { useAdminTournament } from '@/components/admin/AdminTournamentContext'
import { adminRequest, errorMessage, isMatchArray, isPhaseArray, isTeamArray } from '@/lib/admin-client'
import { scopedFetch } from '@/lib/scoped-fetch'
import { DEFAULT_OVERLAY_COLOR, OverlayConfigSchema, overlayConfigError, overlayPages, overlaySections, resolveOverlay, overlayDetailLabels, type OverlayConfig, type OverlayKind, type OverlayDetails } from '@/lib/overlay'
import { getPublishedMatches, isPhasePublished } from '@/lib/publication'
import type { Match, Phase, Team } from '@/lib/types'

const isConfig = (value: unknown): value is OverlayConfig => OverlayConfigSchema.safeParse(value).success
const control = 'w-full rounded-lg border border-white/20 bg-[#1b2739] px-3 py-2 text-sm'
const button = 'rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40'
const viewLabels = { marcador: 'Marcador', previa: 'Previa', fase: 'Resumen de fase' }

export default function OverlayAdminPage() {
  const tournament = useAdminTournament()!
  const [data, setData] = useState<{ phases: Phase[]; matches: Match[]; teams: Team[] }>()
  const [config, setConfig] = useState<OverlayConfig>({ matchId: null, summary: null })
  const [saved, setSaved] = useState<OverlayConfig>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      adminRequest(scopedFetch('/api/admin/overlay'), isConfig),
      adminRequest(scopedFetch('/api/admin/fases'), isPhaseArray),
      adminRequest(scopedFetch('/api/admin/partidos'), isMatchArray),
      adminRequest(scopedFetch('/api/admin/equipos'), isTeamArray),
    ]).then(([config, phases, matches, teams]) => {
      if (active) { setConfig(config); setSaved(config); setData({ phases, matches, teams }) }
    }).catch(err => { if (active) setError(errorMessage(err)) })
    return () => { active = false }
  }, [tournament.id])

  async function save() {
    setBusy(true); setError(''); setNotice('')
    try {
      const next = await adminRequest(scopedFetch('/api/admin/overlay', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }), isConfig)
      setSaved(next); setConfig(next); setNotice('Configuración guardada. OBS se actualizará en un máximo de 30 segundos.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function copy(path: string) {
    setError(''); setNotice('')
    try {
      const url = `${window.location.origin}${path}`
      if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else {
        const input = document.createElement('textarea')
        const focused = document.activeElement as HTMLElement | null
        input.value = url
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        try {
          input.select()
          if (!document.execCommand('copy')) throw new Error('No se pudo copiar')
        } finally { input.remove(); focused?.focus() }
      }
      setNotice('URL copiada')
    }
    catch { setError('No se pudo copiar. Copia la dirección del enlace de previsualización.') }
  }

  function changeDetails(view: OverlayKind, details: OverlayDetails) {
    setConfig(current => ({ ...current, visibility: { ...current.visibility, [view]: { ...current.visibility?.[view], ...details } } }))
  }

  const matches = data ? getPublishedMatches(data.phases, data.matches) : []
  const phases = data?.phases.filter(isPhasePublished) ?? []
  const phase = phases.find(p => p.id === config.summary?.phaseId)
  const sections = phase ? overlaySections(phase, matches) : []
  const pages = phase && config.summary ? overlayPages(phase, matches, config.summary.section, config.visibility?.fase?.content) : []
  const automatic = data ? resolveOverlay({ ...config, summary: null }, data.phases, data.matches).summary : undefined
  const summaryPhase = phase ?? data?.phases.find(p => p.id === automatic?.phaseId)
  const hasStandings = summaryPhase?.type === 'groups' || summaryPhase?.type === 'swiss'
  const validation = data ? overlayConfigError(config, data.phases, data.matches) : null
  const matchLabel = (match: Match) => `${data?.phases.find(p => p.id === match.phaseId)?.name} · ${data?.teams.find(t => t.id === match.team1Id)?.name ?? 'Por determinar'} vs ${data?.teams.find(t => t.id === match.team2Id)?.name ?? 'Por determinar'} · ${match.result ? `${match.result.team1Score} : ${match.result.team2Score}` : 'Pendiente'}`
  const selected = matches.find(m => m.id === saved?.matchId)
  const canPin = phases.find(p => overlaySections(p, matches).length > 0)

  return <div className="max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">Emisión / OBS</h1><p className="mt-2 text-sm text-white/60">Tres URLs permanentes para {tournament.name}. Guarda la configuración para actualizar las fuentes abiertas.</p></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sky-200">{notice}</p>}
    {!data ? <p>Cargando configuración…</p> : <>
      <p className="rounded-lg border border-sky-300/20 bg-sky-300/5 p-4 text-sm">Seleccionado para emisión: <strong>{selected ? matchLabel(selected) : saved?.matchId ? 'Contenido no disponible' : 'Ningún partido'}</strong></p>
      <fieldset disabled={busy || tournament.status === 'archived'} className="space-y-5 disabled:opacity-60">
        <div className="space-y-3 rounded-xl border border-white/15 p-4">
          <label htmlFor="overlay-color" className="block font-semibold">Color de los overlays</label>
          <div className="flex flex-wrap items-center gap-3">
            <input id="overlay-color" type="color" className="h-11 w-16 cursor-pointer rounded border border-white/20 bg-transparent p-1" value={config.accentColor ?? DEFAULT_OVERLAY_COLOR} onChange={e => setConfig({ ...config, accentColor: e.target.value })} />
            <span className="font-mono text-sm">{config.accentColor ?? DEFAULT_OVERLAY_COLOR}</span>
            <button type="button" className={button} onClick={() => setConfig({ ...config, accentColor: undefined })}>Restablecer rosa</button>
          </div>
          <p className="text-sm text-white/60">Se aplica al neón, los bordes y los resultados de las tres fuentes de este torneo al guardar. Los recorridos conservan sus bordes cian y ámbar.</p>
        </div>
        <label className="block space-y-2"><span>Partido de emisión</span><select className={control} value={config.matchId ?? ''} onChange={e => setConfig({ ...config, matchId: e.target.value || null })}>
          <option value="">Sin partido seleccionado</option>
          {config.matchId && !matches.some(m => m.id === config.matchId) && <option value={config.matchId}>Contenido no disponible — quita o cambia la selección</option>}
          {matches.map(match => <option key={match.id} value={match.id}>{matchLabel(match)}</option>)}
        </select></label>
        <div className="space-y-4 rounded-xl border border-white/15 p-4">
          <h2 className="font-semibold">Resumen de fase</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.visibility?.fase?.history ?? true} onChange={e => setConfig({ ...config, visibility: { ...config.visibility, fase: { ...config.visibility?.fase, history: e.target.checked } } })} />Resaltar recorrido de los dos equipos</label>
          <p className="text-sm text-white/60">El suizo muestra todas las rondas publicadas juntas. Los partidos del primer equipo llevan borde cian continuo; los del segundo, ámbar discontinuo. Sus enfrentamientos entre sí llevan ambas marcas. El resaltado también se aplica a los demás formatos, conservando todos sus encuentros.</p>
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-white/70">{config.summary ? 'Fase fijada para los descansos' : 'Sigue la fase, grupo/ronda y página del partido'}</span>
            {config.summary ? <button type="button" className={button} onClick={() => setConfig({ ...config, summary: null })}>Seguir al partido</button>
              : <button type="button" className={button} disabled={!canPin} onClick={() => setConfig({ ...config, summary: automatic ?? { phaseId: canPin!.id, section: overlaySections(canPin!, matches)[0].id, page: 1 } })}>Fijar otra fase</button>}
          </div>
          {config.summary && <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2"><span>Fase</span><select aria-label="Fase" className={control} value={config.summary.phaseId} onChange={e => { const next = phases.find(p => p.id === e.target.value)!; setConfig({ ...config, summary: { phaseId: next.id, section: overlaySections(next, matches)[0].id, page: 1 } }) }}>
              {!phase && <option value={config.summary.phaseId}>Fase no disponible</option>}
              {phases.filter(p => overlaySections(p, matches).length > 0).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
            <label className="space-y-2"><span>Grupo / ronda</span><select aria-label="Grupo / ronda" className={control} value={config.summary.section} onChange={e => setConfig({ ...config, summary: { ...config.summary!, section: e.target.value, page: 1 } })}>
              {!sections.some(s => s.id === config.summary?.section) && <option value={config.summary.section}>Selección no disponible</option>}
              {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            <label className="space-y-2"><span>Página</span><select aria-label="Página" className={control} value={config.summary.page} onChange={e => setConfig({ ...config, summary: { ...config.summary!, page: Number(e.target.value) } })}>
              {!pages[config.summary.page - 1] && <option value={config.summary.page}>Página no disponible</option>}
              {pages.map((_, i) => <option key={i} value={i + 1}>{i + 1} / {pages.length}</option>)}
            </select></label>
          </div>}
        </div>
        <section className="space-y-4" aria-label="Visibilidad de los overlays">
          <h2 className="text-lg font-semibold">Qué mostrar</h2>
          <p className="text-sm text-white/60">Lo esencial incluye nombres, logos y resultados. Puedes ocultar los logos; los demás detalles empiezan desactivados. Al ocultar un elemento, su espacio queda transparente y los demás componentes mantienen su posición.</p>
          {(['marcador', 'previa', 'fase'] as const).map(view => {
            const options = Object.entries(overlayDetailLabels[view]).filter(([key]) => !(key === 'maps' && tournament.game !== 'valorant') && !(view === 'fase' && hasStandings && config.visibility?.fase?.content === 'standings' && (key === 'bo' || key === 'status'))) as [keyof OverlayDetails, string][]
            const details: OverlayDetails = config.visibility?.[view] ?? {}
            return <fieldset key={view} className="space-y-3 rounded-xl border border-white/15 p-4">
              <legend className="px-2 font-semibold">{viewLabels[view]}</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} onClick={() => changeDetails(view, Object.fromEntries(Object.keys(overlayDetailLabels[view]).map(key => [key, key === 'logos'])))}>Solo lo esencial</button>
                <button type="button" className={button} onClick={() => changeDetails(view, Object.fromEntries(options.map(([key]) => [key, true])))}>Mostrar todos los detalles</button>
              </div>
              {view === 'fase' && hasStandings && <label className="block space-y-2"><span>Contenido de grupos y suizo</span><select className={control} value={config.visibility?.fase?.content ?? ''} onChange={e => setConfig({ ...config, summary: config.summary ? { ...config.summary, page: 1 } : config.summary, visibility: { ...config.visibility, fase: { ...config.visibility?.fase, content: (e.target.value || undefined) as 'both' | 'standings' | 'matches' | undefined } } })}>
                <option value="">Según la fase: grupos con clasificación; suizo completo</option>
                <option value="both">Ambos</option><option value="standings">Solo clasificación</option><option value="matches">Solo partidos</option>
              </select></label>}
              <div className="grid gap-3 sm:grid-cols-2">{options.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={details[key] ?? (key === 'logos')} onChange={e => changeDetails(view, { [key]: e.target.checked })} />{label}</label>)}</div>
            </fieldset>
          })}
        </section>
        {validation && <p className="text-amber-200 text-sm">{validation}</p>}
        <button className="rounded-lg bg-sky-600 px-5 py-2 font-semibold disabled:opacity-40" disabled={Boolean(validation)} onClick={save}>{busy ? 'Guardando…' : 'Guardar configuración'}</button>
      </fieldset>
    </>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Fuentes de navegador</h2><p className="text-sm text-white/60">En OBS, añade una fuente «Navegador», pega la URL y configura 1920 × 1080. Las tres fuentes tienen el lienzo transparente; solo los componentes conservan su fondo. Coloca tu imagen, vídeo o juego debajo de la fuente para personalizar el fondo. Las fuentes consultan la selección y los resultados cada 30 segundos.</p>
      {(['marcador', 'previa', 'fase'] as const).map(view => {
        const path = `/overlay/torneos/${tournament.id}/${view}`
        const label = viewLabels[view]
        return <div key={view} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/15 p-3"><strong className="mr-auto">{label}</strong><button className={button} onClick={() => copy(path)}>Copiar URL de {label.toLowerCase()}</button><a className={button} href={path} target="_blank" rel="noreferrer">Previsualizar {label.toLowerCase()}</a></div>
      })}
    </section>
  </div>
}
