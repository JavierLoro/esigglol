'use client'
import { useState, useEffect } from 'react'
import type { Phase, PhaseType, PhaseStatus, BOFormat, Team, Match } from '@/lib/types'
import { validatePhaseParticipants } from '@/lib/phase-validation'
import { Plus, Trash2, Save, GripVertical, Zap, Check, Copy } from 'lucide-react'
import { bracketSizeError } from '@/lib/bracket-sizes'
import { adminRequest, errorMessage, isArrayOfRecords, isEntity, isOk } from '@/lib/admin-client'

const PHASE_TYPES: { value: PhaseType; label: string }[] = [
  { value: 'groups', label: 'Fase de Grupos' },
  { value: 'swiss', label: 'Formato Suizo' },
  { value: 'elimination', label: 'Eliminación clásica' },
  { value: 'final-four', label: 'Final Four' },
  { value: 'upper-lower', label: 'Upper/Lower Bracket' },
]

const BO_OPTIONS: BOFormat[] = [1, 2, 3, 5]

function isBracketComplete(phase: Phase, matches: Match[]): boolean {
  const pm = matches.filter(m => m.phaseId === phase.id)
  if (pm.length === 0) return false
  if (phase.type === 'elimination') {
    const maxRound = Math.max(...pm.map(m => m.round))
    const finals = pm.filter(m => m.round === maxRound)
    return finals.length === 1 && finals[0].result !== null
  }
  if (phase.type === 'final-four') return !!(pm.find(m => m.round === 2)?.result)
  if (phase.type === 'upper-lower') return !!(pm.find(m => m.round === 99)?.result)
  return false
}

export default function AdminFases() {
  const [phases, setPhases] = useState<Phase[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [loadError, setLoadError] = useState('')

  function loadMatches() {
    return adminRequest<Match[]>(fetch('/api/admin/partidos'), isArrayOfRecords).then(setAllMatches)
  }

  useEffect(() => {
    Promise.all([
      adminRequest<Phase[]>(fetch('/api/admin/fases'), isArrayOfRecords),
      adminRequest<Team[]>(fetch('/api/admin/equipos'), isArrayOfRecords), loadMatches(),
    ]).then(([p, t]) => { setPhases(p); setTeams(t) }).catch(error => setLoadError(errorMessage(error)))
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  function copyOverlayUrl(phaseId: string) {
    const url = `${window.location.origin}/overlay/fases/${phaseId}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
    } else {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    notify('URL de overlay copiada')
  }

  function addPhase() {
    setPhases(prev => [...prev, {
      id: `draft-${crypto.randomUUID()}`,
      name: 'Nueva fase',
      type: 'elimination',
      status: 'upcoming',
      order: prev.length + 1,
      config: { bo: 1 },
    }])
  }

  async function savePhase(phase: Phase) {
    const participantErrors = validatePhaseParticipants(phase.type, phase.config)
    if (participantErrors.length > 0) { notify(participantErrors[0]); return }
    setSaving(phase.id)
    try {
      const isDraft = phase.id.startsWith('draft-')
      const body = isDraft ? {
        name: phase.name, type: phase.type, status: phase.status, order: phase.order, config: phase.config,
      } : phase
      const saved = await adminRequest(fetch('/api/admin/fases', { method: isDraft ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), isEntity) as Phase
      if (isDraft) setPhases(prev => prev.map(candidate => candidate.id === phase.id ? saved : candidate))
      notify('Guardado')
    } catch (error) { notify(errorMessage(error)) } finally { setSaving(null) }
  }

  async function deletePhase(id: string) {
    if (id.startsWith('draft-')) { setPhases(prev => prev.filter(p => p.id !== id)); return }
    const matchCount = allMatches.filter(m => m.phaseId === id).length
    const msg = matchCount > 0
      ? `¿Eliminar esta fase? Se eliminarán también ${matchCount} partido${matchCount !== 1 ? 's' : ''} asociado${matchCount !== 1 ? 's' : ''}.`
      : '¿Eliminar esta fase?'
    if (!confirm(msg)) return
    try {
      await adminRequest(fetch('/api/admin/fases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }), isOk)
      setPhases(prev => prev.filter(p => p.id !== id)); setAllMatches(prev => prev.filter(m => m.phaseId !== id)); notify('Fase eliminada')
    } catch (error) { notify(errorMessage(error)) }
  }

  async function generateMatches(phase: Phase, type: 'groups' | 'swiss' | 'elimination' | 'final-four' | 'upper-lower', round?: number) {
    const count = type === 'swiss' ? (phase.config.swissTeamIds?.length ?? 0) : (phase.config.bracketTeamIds?.length ?? 0)
    const sizeError = bracketSizeError(type, count)
    if (sizeError) { notify(sizeError); return }
    setGenerating(phase.id)
    try {
    // Guardar primero para que el endpoint tenga la config actualizada
    await adminRequest(fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(phase) }), isEntity)
    const data = await adminRequest<{ created: number }>(fetch('/api/admin/fases/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId: phase.id, round }),
    }), (value): value is { created: number } => typeof value === 'object' && value !== null && 'created' in value && typeof value.created === 'number')
    await loadMatches()
    notify(data.created > 0 ? `${data.created} partido${data.created !== 1 ? 's' : ''} generado${data.created !== 1 ? 's' : ''}` : 'No hay partidos nuevos que generar')
    } catch (error) { notify(errorMessage(error)) } finally { setGenerating(null) }
  }

  function update(id: string, patch: Partial<Phase>) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function updateConfig(id: string, patch: Partial<Phase['config']>) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, config: { ...p.config, ...patch } } : p))
  }

  async function confirmBracket(phase: Phase) {
    const updated = { ...phase, config: { ...phase.config, confirmedBracket: true } }
    try {
      await adminRequest(fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }), isEntity)
      setPhases(prev => prev.map(p => p.id === phase.id ? updated : p)); notify('Bracket confirmado')
    } catch (error) { notify(errorMessage(error)) }
  }

  async function confirmRound(phase: Phase, round: number) {
    const confirmed = [...new Set([...(phase.config.confirmedRounds ?? []), round])]
    const updated = { ...phase, config: { ...phase.config, confirmedRounds: confirmed } }
    try {
      await adminRequest(fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }), isEntity)
      setPhases(prev => prev.map(p => p.id === phase.id ? updated : p)); notify(`Ronda ${round} confirmada`)
    } catch (error) { notify(errorMessage(error)) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fases</h1>
        <div className="flex items-center gap-3">
          {(msg || loadError) && <span className={(loadError || msg.startsWith('Error') || msg.startsWith('Sesión')) ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{loadError || msg}</span>}
          <button onClick={addPhase} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors">
            <Plus size={15} /> Añadir fase
          </button>
        </div>
      </div>

      {loadError ? <p className="text-red-400 text-sm">No se pudieron cargar las fases.</p> : phases.length === 0 && <p className="text-white/40 text-sm">No hay fases. Añade la primera.</p>}

      {phases.map((phase, i) => {
        const maxRounds = (phase.config.advanceWins ?? 2) + (phase.config.eliminateLosses ?? 2) - 1
        const participantErrors = validatePhaseParticipants(phase.type, phase.config)
        const structureLocked = allMatches.some(match => match.phaseId === phase.id)

        return (
          <div key={phase.id} className="rounded-xl border border-white/10 bg-[#0d1321] p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <GripVertical size={16} className="text-white/20" />
              <span className="text-xs text-white/30 w-6 text-center">{i + 1}</span>
              <input
                aria-label={`Nombre de la fase ${i + 1}: ${phase.name}`}
                value={phase.name}
                onChange={e => update(phase.id, { name: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white focus:outline-none focus:border-[#0097D7]/50"
              />
              <button aria-label={`Eliminar fase ${phase.name}`} onClick={() => deletePhase(phase.id)} className="text-white/20 hover:text-red-400 transition-colors ml-auto">
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Tipo</label>
                <select
                  aria-label={`Tipo de la fase ${phase.name}`}
                  value={phase.type}
                  disabled={structureLocked}
                  onChange={e => update(phase.id, { type: e.target.value as PhaseType })}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                >
                  {PHASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Estado</label>
                <select
                  aria-label={`Estado de la fase ${phase.name}`}
                  value={phase.status}
                  onChange={e => update(phase.id, { status: e.target.value as PhaseStatus })}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                >
                  <option value="upcoming">Próximamente</option>
                  <option value="active">En curso</option>
                  <option value="completed">Finalizado</option>
                </select>
              </div>
              {phase.type !== 'swiss' && (
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Formato BO</label>
                  <select
                    aria-label={`Formato de la fase ${phase.name}`}
                    value={phase.config.bo}
                    disabled={structureLocked}
                    onChange={e => updateConfig(phase.id, { bo: Number(e.target.value) as BOFormat })}
                    className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                  >
                    {BO_OPTIONS.map(b => <option key={b} value={b}>BO{b}</option>)}
                  </select>
                </div>
              )}
              {phase.type === 'groups' && (
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Pasan por grupo</label>
                  <input
                    aria-label={`Equipos que pasan por grupo en la fase ${phase.name}`}
                    type="number"
                    disabled={structureLocked}
                    min={1}
                    value={phase.config.advanceCount ?? 2}
                    onChange={e => updateConfig(phase.id, { advanceCount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Configuración de grupos */}
            {phase.type === 'groups' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Grupos</span>
                  <button
                    disabled={structureLocked}
                    onClick={() => updateConfig(phase.id, {
                      groups: [...(phase.config.groups ?? []), { id: String.fromCharCode(65 + (phase.config.groups?.length ?? 0)), teamIds: [] }]
                    })}
                    className="text-xs text-[#0097D7] hover:text-[#33b3e8] flex items-center gap-1"
                  >
                    <Plus size={13} /> Añadir grupo
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(phase.config.groups ?? []).map((g, gi) => (
                    <div key={g.id} className="rounded-lg border border-white/10 p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0097D7]">Grupo {g.id}</span>
                        <button
                          aria-label={`Eliminar grupo ${g.id} de la fase ${phase.name}`}
                          disabled={structureLocked}
                          onClick={() => updateConfig(phase.id, { groups: (phase.config.groups ?? []).filter((_, i) => i !== gi) })}
                          className="text-white/20 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {teams.map(t => {
                          const checked = g.teamIds.includes(t.id)
                          return (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-white/5">
                              <input
                                type="checkbox"
                                aria-label={`${t.name}, grupo ${g.id} de la fase ${phase.name}`}
                                disabled={structureLocked}
                                checked={checked}
                                className="accent-[#0097D7]"
                                onChange={() => {
                                  const newGroups = [...(phase.config.groups ?? [])]
                                  newGroups[gi] = {
                                    ...g,
                                    teamIds: checked
                                      ? g.teamIds.filter(id => id !== t.id)
                                      : [...g.teamIds, t.id],
                                  }
                                  updateConfig(phase.id, { groups: newGroups })
                                }}
                              />
                              <span className="text-xs text-white/70 truncate">{t.name}</span>
                            </label>
                          )
                        })}
                      </div>
                      {g.teamIds.length > 0 && (
                        <p className="text-xs text-white/30">{g.teamIds.length} equipo{g.teamIds.length !== 1 ? 's' : ''} seleccionado{g.teamIds.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  ))}
                </div>
                {participantErrors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">
                    {participantErrors.map(error => <p key={error} role="alert">{error}</p>)}
                  </div>
                )}
                {(phase.config.groups ?? []).some(g => g.teamIds.length >= 2) && (() => {
                  const hasMatches = allMatches.some(m => m.phaseId === phase.id)
                  return hasMatches ? (
                    <span className="mt-3 flex items-center gap-1 text-xs text-green-400/80 font-medium">
                      <Check size={13} /> Generado
                    </span>
                  ) : (
                    <button
                      onClick={() => generateMatches(phase, 'groups')}
                      disabled={generating === phase.id || participantErrors.length > 0}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0097D7]/40 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/10 transition-colors disabled:opacity-50"
                    >
                      <Zap size={13} />
                      {generating === phase.id ? 'Generando...' : 'Generar partidos'}
                    </button>
                  )
                })()}
              </div>
            )}

            {/* Configuración suizo */}
              {phase.type === 'swiss' && (
              <div className="flex flex-col gap-4">
                {/* Parámetros suizo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Tamaño</label>
                    <select
                      aria-label={`Tamaño de la fase ${phase.name}`}
                      value={phase.config.swissSize ?? 8}
                      disabled={structureLocked}
                      onChange={e => updateConfig(phase.id, { swissSize: Number(e.target.value) as 8 | 16 })}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                    >
                      <option value={8}>8 equipos</option>
                      <option value={16}>16 equipos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Victorias para clasificar</label>
                    <select
                      aria-label={`Victorias para clasificar en la fase ${phase.name}`}
                      value={phase.config.advanceWins ?? 2}
                      disabled={structureLocked}
                      onChange={e => updateConfig(phase.id, { advanceWins: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                    >
                      <option value={2}>2 victorias</option>
                      <option value={3}>3 victorias</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Derrotas para eliminar</label>
                    <select
                      aria-label={`Derrotas para eliminar en la fase ${phase.name}`}
                      value={phase.config.eliminateLosses ?? 2}
                      disabled={structureLocked}
                      onChange={e => updateConfig(phase.id, { eliminateLosses: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                    >
                      <option value={2}>2 derrotas</option>
                      <option value={3}>3 derrotas</option>
                    </select>
                  </div>
                </div>

                {/* BO por ronda */}
                <div>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">
                    Formato por ronda ({maxRounds} rondas máx.)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: maxRounds }, (_, ri) => {
                      const r = ri + 1
                      const roundBo = phase.config.roundBo ?? {}
                      const val = roundBo[String(r)] ?? phase.config.bo
                      return (
                        <div key={r} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-white/40">R{r}</span>
                          <select
                            aria-label={`Formato de la ronda ${r} de la fase ${phase.name}`}
                            value={val}
                            disabled={structureLocked}
                            onChange={e => updateConfig(phase.id, {
                              roundBo: { ...(phase.config.roundBo ?? {}), [String(r)]: Number(e.target.value) as BOFormat }
                            })}
                            className="bg-transparent text-sm text-white focus:outline-none"
                          >
                            {BO_OPTIONS.map(b => <option key={b} value={b}>BO{b}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Selección de equipos */}
                <div>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Equipos en el suizo</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 rounded-lg border border-white/10 p-3">
                    {teams.map(t => {
                      const checked = (phase.config.swissTeamIds ?? []).includes(t.id)
                      return (
                        <label key={t.id} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-white/5">
                          <input
                            type="checkbox"
                            aria-label={`${t.name}, equipos del suizo de la fase ${phase.name}`}
                            disabled={structureLocked}
                            checked={checked}
                            className="accent-[#0097D7]"
                            onChange={() => {
                              const current = phase.config.swissTeamIds ?? []
                              updateConfig(phase.id, {
                                swissTeamIds: checked
                                  ? current.filter(id => id !== t.id)
                                  : [...current, t.id],
                              })
                            }}
                          />
                          <span className="text-xs text-white/70 truncate">{t.name}</span>
                        </label>
                      )
                    })}
                  </div>
                  {(phase.config.swissTeamIds ?? []).length > 0 && (
                    <p className="text-xs text-white/30 mt-1">{(phase.config.swissTeamIds ?? []).length} equipos seleccionados</p>
                  )}
                  {participantErrors.map(error => <p key={error} className="text-xs text-red-400 mt-1" role="alert">{error}</p>)}
                </div>

                {/* Botones generar / confirmar rondas */}
                {(phase.config.swissTeamIds ?? []).length >= 2 && (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: maxRounds }, (_, ri) => {
                      const r = ri + 1
                      const phaseMatches = allMatches.filter(m => m.phaseId === phase.id)
                      const roundHasMatches = phaseMatches.some(m => m.round === r)
                      const isConfirmed = (phase.config.confirmedRounds ?? []).includes(r)
                      return (
                        <div key={r} className="flex items-center gap-2">
                          <span className="text-xs text-white/40 w-16">Ronda {r}</span>
                          {!roundHasMatches ? (
                            <button
                              onClick={() => generateMatches(phase, 'swiss', r)}
                              disabled={generating === phase.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0097D7]/40 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/10 transition-colors disabled:opacity-50"
                            >
                              <Zap size={13} />
                              {generating === phase.id ? 'Generando...' : 'Generar'}
                            </button>
                          ) : isConfirmed ? (
                            <span className="flex items-center gap-1 text-xs text-green-400/80 font-medium">
                              <Check size={13} /> Confirmada
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmRound(phase, r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-400/40 text-green-400 text-xs font-bold hover:bg-green-400/10 transition-colors"
                            >
                              <Check size={13} /> Confirmar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Configuración de bracket (elimination / final-four / upper-lower) */}
            {['elimination', 'final-four', 'upper-lower'].includes(phase.type) && (
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">
                    Equipos en el bracket
                    {phase.type === 'upper-lower' && ' (4 u 8 equipos)'}
                    {phase.type === 'final-four' && ' (4 equipos)'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 rounded-lg border border-white/10 p-3">
                    {teams.map(t => {
                      const checked = (phase.config.bracketTeamIds ?? []).includes(t.id)
                      return (
                        <label key={t.id} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-white/5">
                          <input
                            type="checkbox"
                            aria-label={`${t.name}, equipos del bracket de la fase ${phase.name}`}
                            disabled={structureLocked}
                            checked={checked}
                            className="accent-[#0097D7]"
                            onChange={() => {
                              const current = phase.config.bracketTeamIds ?? []
                              updateConfig(phase.id, {
                                bracketTeamIds: checked
                                  ? current.filter(id => id !== t.id)
                                  : [...current, t.id],
                              })
                            }}
                          />
                          <span className="text-xs text-white/70 truncate">{t.name}</span>
                        </label>
                      )
                    })}
                  </div>
              {(phase.config.bracketTeamIds ?? []).length > 0 && (
                    <p className="text-xs text-white/30 mt-1">{(phase.config.bracketTeamIds ?? []).length} equipos seleccionados</p>
                  )}
                  {participantErrors.map(error => <p key={error} className="text-xs text-red-400 mt-1" role="alert">{error}</p>)}
                </div>

                {phase.type === 'final-four' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label={`Incluir partido por el tercer puesto en la fase ${phase.name}`}
                      disabled={structureLocked}
                      checked={phase.config.include3rdPlace ?? false}
                      className="accent-[#0097D7]"
                      onChange={e => updateConfig(phase.id, { include3rdPlace: e.target.checked })}
                    />
                    <span className="text-xs text-white/60">Incluir partido por 3er/4to puesto</span>
                  </label>
                )}

                {(phase.config.bracketTeamIds ?? []).length >= 2 && (() => {
                  const pm = allMatches.filter(m => m.phaseId === phase.id)
                  const hasMatches = pm.length > 0
                  const isConfirmed = phase.config.confirmedBracket === true
                  const complete = isBracketComplete(phase, allMatches)
                  const hasUnplayed = pm.some(m => !m.result)
                  const canGenNext = hasMatches && !hasUnplayed && !complete

                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isConfirmed && !complete && (
                        <button
                          onClick={() => generateMatches(phase, phase.type as 'elimination' | 'final-four' | 'upper-lower')}
                          disabled={generating === phase.id || (hasMatches && hasUnplayed)}
                          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0097D7]/40 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/10 transition-colors disabled:opacity-50"
                        >
                          <Zap size={13} />
                          {generating === phase.id ? 'Generando...' : canGenNext ? 'Generar siguiente ronda' : 'Generar bracket'}
                        </button>
                      )}
                      {isConfirmed ? (
                        <span className="self-start flex items-center gap-1 text-xs text-green-400/80 font-medium">
                          <Check size={13} /> Confirmado
                        </span>
                      ) : hasMatches ? (
                        <button
                          onClick={() => confirmBracket(phase)}
                          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-400/40 text-green-400 text-xs font-bold hover:bg-green-400/10 transition-colors"
                        >
                          <Check size={13} /> Confirmar
                        </button>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
            )}

            <div className="self-end flex items-center gap-2">
              {structureLocked && <span className="text-xs text-amber-300/80">Estructura bloqueada: la fase ya tiene partidos</span>}
              <button
                onClick={() => copyOverlayUrl(phase.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white hover:border-white/30 transition-colors"
                title="Copiar URL del overlay"
              >
                <Copy size={14} />
                Overlay
              </button>
              <button
                onClick={() => savePhase(phase)}
                disabled={saving === phase.id || participantErrors.length > 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving === phase.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
