'use client'
import { useState, useEffect } from 'react'
import type { Phase, PhaseType, PhaseStatus, BOFormat, Team, Match } from '@/lib/types'
import { Plus, Trash2, Save, GripVertical, Zap, Check, Copy } from 'lucide-react'

const PHASE_TYPES: { value: PhaseType; label: string }[] = [
  { value: 'groups', label: 'Fase de Grupos' },
  { value: 'swiss', label: 'Formato Suizo' },
  { value: 'elimination', label: 'Eliminación clásica' },
  { value: 'final-four', label: 'Final Four' },
  { value: 'upper-lower', label: 'Upper/Lower Bracket' },
]

const BO_OPTIONS: BOFormat[] = [1, 2, 3, 5]

export default function AdminFases() {
  const [phases, setPhases] = useState<Phase[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function loadMatches() {
    fetch('/api/data/fases').then(r => r.json()).then(d => setAllMatches(d.matches ?? []))
  }

  useEffect(() => {
    fetch('/api/admin/fases').then(r => r.json()).then(setPhases)
    fetch('/api/admin/equipos').then(r => r.json()).then(setTeams)
    loadMatches()
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

  async function addPhase() {
    const res = await fetch('/api/admin/fases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nueva fase',
        type: 'elimination',
        status: 'upcoming',
        order: phases.length + 1,
        config: { bo: 1 },
      }),
    })
    const phase = await res.json()
    setPhases(prev => [...prev, phase])
  }

  async function savePhase(phase: Phase) {
    setSaving(phase.id)
    await fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(phase) })
    setSaving(null)
    notify('Guardado')
  }

  async function deletePhase(id: string) {
    if (!confirm('¿Eliminar esta fase?')) return
    await fetch('/api/admin/fases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPhases(prev => prev.filter(p => p.id !== id))
  }

  async function generateMatches(phase: Phase, type: 'groups' | 'swiss' | 'elimination' | 'final-four' | 'upper-lower', round?: number) {
    setGenerating(phase.id)
    // Guardar primero para que el endpoint tenga la config actualizada
    await fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(phase) })
    const res = await fetch('/api/admin/fases/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId: phase.id, type, round }),
    })
    const data = await res.json()
    setGenerating(null)
    loadMatches()
    notify(data.created > 0 ? `${data.created} partido${data.created !== 1 ? 's' : ''} generado${data.created !== 1 ? 's' : ''}` : 'No hay partidos nuevos que generar')
  }

  function update(id: string, patch: Partial<Phase>) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function updateConfig(id: string, patch: Partial<Phase['config']>) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, config: { ...p.config, ...patch } } : p))
  }

  async function confirmRound(phase: Phase, round: number) {
    const confirmed = [...(phase.config.confirmedRounds ?? []), round]
    const updated = { ...phase, config: { ...phase.config, confirmedRounds: confirmed } }
    setPhases(prev => prev.map(p => p.id === phase.id ? updated : p))
    await fetch('/api/admin/fases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    notify(`Ronda ${round} confirmada`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fases</h1>
        <div className="flex items-center gap-3">
          {msg && <span className="text-green-400 text-sm">{msg}</span>}
          <button onClick={addPhase} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors">
            <Plus size={15} /> Añadir fase
          </button>
        </div>
      </div>

      {phases.length === 0 && <p className="text-white/40 text-sm">No hay fases. Añade la primera.</p>}

      {phases.map((phase, i) => {
        const maxRounds = (phase.config.advanceWins ?? 2) + (phase.config.eliminateLosses ?? 2) - 1

        return (
          <div key={phase.id} className="rounded-xl border border-white/10 bg-[#0d1321] p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <GripVertical size={16} className="text-white/20" />
              <span className="text-xs text-white/30 w-6 text-center">{i + 1}</span>
              <input
                value={phase.name}
                onChange={e => update(phase.id, { name: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white focus:outline-none focus:border-[#0097D7]/50"
              />
              <button onClick={() => deletePhase(phase.id)} className="text-white/20 hover:text-red-400 transition-colors ml-auto">
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Tipo</label>
                <select
                  value={phase.type}
                  onChange={e => update(phase.id, { type: e.target.value as PhaseType })}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                >
                  {PHASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Estado</label>
                <select
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
                    value={phase.config.bo}
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
                    type="number"
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
                {(phase.config.groups ?? []).some(g => g.teamIds.length >= 2) && (
                  <button
                    onClick={() => generateMatches(phase, 'groups')}
                    disabled={generating === phase.id}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0097D7]/40 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/10 transition-colors disabled:opacity-50"
                  >
                    <Zap size={13} />
                    {generating === phase.id ? 'Generando...' : 'Generar partidos'}
                  </button>
                )}
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
                      value={phase.config.swissSize ?? 8}
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
                      value={phase.config.advanceWins ?? 2}
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
                      value={phase.config.eliminateLosses ?? 2}
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
                            value={val}
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
                </div>

                {phase.type === 'final-four' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phase.config.include3rdPlace ?? false}
                      className="accent-[#0097D7]"
                      onChange={e => updateConfig(phase.id, { include3rdPlace: e.target.checked })}
                    />
                    <span className="text-xs text-white/60">Incluir partido por 3er/4to puesto</span>
                  </label>
                )}

                {(phase.config.bracketTeamIds ?? []).length >= 2 && (
                  <button
                    onClick={() => generateMatches(phase, phase.type as 'elimination' | 'final-four' | 'upper-lower')}
                    disabled={generating === phase.id}
                    className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0097D7]/40 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/10 transition-colors disabled:opacity-50"
                  >
                    <Zap size={13} />
                    {generating === phase.id ? 'Generando...' : 'Generar bracket'}
                  </button>
                )}
              </div>
            )}

            <div className="self-end flex items-center gap-2">
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
                disabled={saving === phase.id}
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
