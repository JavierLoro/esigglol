'use client'
import { useState, useEffect } from 'react'
import type { Match, Team, Phase } from '@/lib/types'
import { Plus, Trash2, Save, Trophy, Check, Loader2, X, Copy, Ticket, FileJson2, ChevronDown, ChevronRight } from 'lucide-react'
import type { GameData } from '@/lib/types'
import { GameDataSchema } from '@/lib/schemas'
import DateTimePicker from '@/components/admin/DateTimePicker'
import clsx from 'clsx'
import { getEffectiveBO } from '@/lib/match-validation'
import { getPhaseTeamIds } from '@/lib/phase-validation'
import { adminRequest, errorMessage, isArrayOfRecords, isEntity, isOk } from '@/lib/admin-client'
import TournamentCodeCard from '@/components/admin/TournamentCodeCard'

export default function AdminPartidos() {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [hasTournamentConfig, setHasTournamentConfig] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState<string | null>(null)
  const [gameModal, setGameModal] = useState<{ matchId: string; gameIndex: number } | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([
      adminRequest<Match[]>(fetch('/api/admin/partidos'), isArrayOfRecords),
      // The public endpoint is intentionally cached for visitors. Admin data
      // must come from the authenticated endpoint so edits are visible
      // immediately and never leak through a shared cache.
      adminRequest<Team[]>(fetch('/api/admin/equipos', { cache: 'no-store' }), isArrayOfRecords),
      adminRequest<Phase[]>(fetch('/api/admin/fases'), isArrayOfRecords),
    ]).then(([m, t, p]) => { setMatches(m); setTeams(t); setPhases(p) }).catch(error => setLoadError(errorMessage(error)))
    adminRequest<{ providerId?: number; configured?: boolean }>(fetch('/api/admin/tournament'), value => typeof value === 'object' && value !== null).then(data => {
      setHasTournamentConfig(data.configured === true && typeof data.providerId === 'number')
    }).catch(error => setLoadError(errorMessage(error)))
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  async function addMatch(phaseId: string) {
    const phase = phases.find(candidate => candidate.id === phaseId)
    const participants = (phase ? getPhaseTeamIds(phase) : [])
      .map(teamId => teams.find(team => team.id === teamId))
      .filter((team): team is Team => Boolean(team))
    if (participants.length < 2) {
      notify('La fase necesita al menos dos participantes válidos')
      return
    }
    try {
    const data = await adminRequest(fetch('/api/admin/partidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId, round: 1, team1Id: participants[0].id, team2Id: participants[1].id, result: null, riotMatchIds: [] }),
    }), isArrayOfRecords)
    const match = data[0]
    if (!isEntity(match)) throw new Error('Respuesta inválida')
    setMatches(prev => [...prev, match as Match])
    setCollapsedPhases(prev => { const next = new Set(prev); next.delete(phaseId); return next })
    } catch (error) { notify(errorMessage(error)) }
  }

  function togglePhaseCollapse(phaseId: string) {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId)
      return next
    })
  }

  async function saveMatch(match: Match) {
    setSaving(match.id)
    try {
    const updated = await adminRequest<Match>(fetch('/api/admin/partidos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(match),
    }), (value): value is Match => isEntity(value))
    // Refrescar todos los matches para ver avances de bracket
    const all = await adminRequest<Match[]>(fetch('/api/admin/partidos'), isArrayOfRecords)
    setMatches(all)
    // Refrescar fases por si cambió el estado
    const allPhases = await adminRequest<Phase[]>(fetch('/api/admin/fases'), isArrayOfRecords)
    setPhases(allPhases)
    notify(updated.winnerId ? '¡Guardado — bracket actualizado!' : 'Guardado')
    } catch (error) { notify(errorMessage(error)) } finally { setSaving(null) }
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} partido(s)?`)) return
    setDeleting(true)
    const count = selected.size
    try {
    await adminRequest(fetch('/api/admin/partidos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    }), isOk)
    setMatches(prev => prev.filter(m => !selected.has(m.id)))
    setSelected(new Set())
    notify(`${count} partido(s) eliminado(s)`)
    } catch (error) { notify(errorMessage(error)) } finally { setDeleting(false) }
  }

  function update(id: string, patch: Partial<Match>) {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function updateScore(id: string, key: 'team1Score' | 'team2Score', val: string) {
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m
      const result = m.result ?? { team1Score: 0, team2Score: 0 }
      const newResult = { ...result, [key]: Number(val) }
      // A non-final score is only progress; the Ganador button records the
      // final marker explicitly. A score reaching the target is final.
      const phase = phases.find(p => p.id === m.phaseId)
      const wins = phase ? Math.ceil(getEffectiveBO(phase, m.round) / 2) : 1
      const winnerId = newResult.team1Score >= wins && newResult.team1Score > newResult.team2Score
        ? m.team1Id
        : newResult.team2Score >= wins && newResult.team2Score > newResult.team1Score
          ? m.team2Id
          : undefined
      return { ...m, result: newResult, winnerId }
    }))
  }

  function setWinner(matchId: string, winnerId: string) {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m
      const phase = phases.find(p => p.id === m.phaseId)
      const bo = phase ? getEffectiveBO(phase, m.round) : 1
      const wins = Math.ceil(bo / 2)
      const isTeam1 = winnerId === m.team1Id
      return {
        ...m,
        result: {
          team1Score: isTeam1 ? wins : 0,
          team2Score: isTeam1 ? 0 : wins,
        },
        winnerId,
      }
    }))
  }

  function clearResult(matchId: string) {
    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, result: null, winnerId: undefined } : m
    ))
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === matches.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(matches.map(m => m.id)))
    }
  }

  function applyGameData(matchId: string, gameIndex: number, gameData: GameData) {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m
      const games = [...(m.games ?? [])]
      while (games.length <= gameIndex) games.push(null)
      games[gameIndex] = gameData
      return { ...m, games }
    }))
    notify(`Partida ${gameIndex + 1} cargada: ${gameData.duration}`)
  }

  async function generateTournamentCodes(matchId: string) {
    setGeneratingCodes(matchId)
    try {
      const res = await fetch('/api/admin/partidos/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify(data.error || 'Error al generar codes')
        return
      }
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, tournamentCodes: data.codes, tournamentCodesGeneratedAt: new Date().toISOString() } : m
      ))
      notify(data.regenerated ? 'Tournament codes expirados: regenerados' : 'Tournament codes generados')
    } catch {
      notify('Error de conexion')
    } finally {
      setGeneratingCodes(null)
    }
  }

  function copyToClipboard(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => notify('Copiado'))
    } else {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      notify('Copiado')
    }
  }

  const allSelected = matches.length > 0 && selected.size === matches.length

  return (
    <>
    {/* Modal de datos de partida */}
    {gameModal && (() => {
      const modalMatch = matches.find(m => m.id === gameModal.matchId)
      const t1 = teams.find(t => t.id === modalMatch?.team1Id)
      const t2 = teams.find(t => t.id === modalMatch?.team2Id)
      return (
        <GameDataModal
          title={`Partida ${gameModal.gameIndex + 1}${t1 && t2 ? ` — ${t1.name} vs ${t2.name}` : ''}`}
          onApply={(gameData) => {
            applyGameData(gameModal.matchId, gameModal.gameIndex, gameData)
            setGameModal(null)
          }}
          onClose={() => setGameModal(null)}
        />
      )
    })()}
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Partidos</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {(msg || loadError) && <span className={(loadError || msg.startsWith('Error') || msg.startsWith('Sesión')) ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{loadError || msg}</span>}
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Eliminar ({selected.size})
            </button>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="accent-[#0097D7]"
          />
          {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
        </label>
      )}

      {matches.length === 0 && <p className="text-white/40 text-sm">No hay partidos. Añade el primero desde una fase.</p>}

      <div className="flex flex-col gap-4">
      {loadError ? <p className="text-red-400 text-sm">No se pudieron cargar los partidos.</p> : phases.map(phase => {
          const phaseMatches = matches.filter(m => m.phaseId === phase.id)
          const isCollapsed = collapsedPhases.has(phase.id)
          const completedCount = phaseMatches.filter(m => m.result !== null).length
          const participantCount = getPhaseTeamIds(phase).filter(teamId => teams.some(team => team.id === teamId)).length
          const canAddMatch = participantCount >= 2

          return (
            <div key={phase.id} className="flex flex-col gap-0">
              {/* ── Cabecera de fase ── */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-[#0d1321] hover:bg-white/[0.04] transition-colors w-full">
                <button
                  type="button"
                  id={`phase-toggle-${phase.id}`}
                  aria-expanded={!isCollapsed}
                  aria-controls={`phase-matches-${phase.id}`}
                  onClick={() => togglePhaseCollapse(phase.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  {isCollapsed
                    ? <ChevronRight size={15} className="text-white/30 shrink-0" />
                    : <ChevronDown  size={15} className="text-white/30 shrink-0" />
                  }
                  <span className="font-semibold text-sm truncate">{phase.name}</span>
                  <span className="text-xs text-white/30 shrink-0">
                    {completedCount}/{phaseMatches.length} completados
                  </span>
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); addMatch(phase.id) }}
                  disabled={!canAddMatch}
                  title={canAddMatch ? 'Añadir partido' : 'La fase necesita al menos dos participantes válidos'}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0097D7]/20 border border-[#0097D7]/30 text-[#0097D7] text-xs font-bold hover:bg-[#0097D7]/30 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={12} /> Añadir
                </button>
              </div>

              {/* ── Partidos de la fase (colapsables) ── */}
              {!isCollapsed && (
                <div
                  id={`phase-matches-${phase.id}`}
                  role="region"
                  aria-labelledby={`phase-toggle-${phase.id}`}
                  className="flex flex-col gap-3 pt-3"
                >
                  {phaseMatches.length === 0 && (
                    <p className="text-white/30 text-xs px-1">Sin partidos en esta fase.</p>
                  )}
                  {phaseMatches.map(match => {
                    const team1 = teams.find(t => t.id === match.team1Id)
                    const team2 = teams.find(t => t.id === match.team2Id)
                    const phaseTeamIds = getPhaseTeamIds(phase)
                    const selectableTeams = phaseTeamIds
                      ? teams.filter(team => phaseTeamIds.includes(team.id))
                      : teams
                    const selectTeams = (teamId: string) => teamId === 'TBD' || selectableTeams.some(team => team.id === teamId)
                      ? selectableTeams
                      : [team1, team2].filter((team): team is Team => Boolean(team && team.id === teamId))
                    const isSelected = selected.has(match.id)

                    return (
                      <div
                        key={match.id}
                        className={clsx(
                          'rounded-xl border bg-[#0d1321] p-4 flex flex-col gap-3 transition-colors',
                          isSelected ? 'border-[#0097D7]/50 bg-[#0097D7]/5' : 'border-white/10',
                        )}
                      >
                        {/* Cabecera: checkbox + ronda */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(match.id)}
                            className="accent-[#0097D7] shrink-0"
                          />
                          <span className="text-xs text-white/30 flex-1">Partido</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-white/30">R</span>
                            <input
                              type="number"
                              min={1}
                              value={match.round}
                              onChange={e => update(match.id, { round: Number(e.target.value) })}
                              className="w-12 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
                            />
                          </div>
                        </div>

              {/* Equipos + resultado */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                {/* Equipo 1 */}
                <div className="flex flex-col gap-1.5">
                  <select
                    value={match.team1Id}
                    onChange={e => update(match.id, { team1Id: e.target.value, winnerId: undefined })}
                    className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                  >
                    {match.team1Id === 'TBD' && <option value="TBD">Pendiente</option>}
                    {selectTeams(match.team1Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {/* Botón ganador equipo 1 */}
                  {match.result !== null && (
                    <button
                      type="button"
                      onClick={() => setWinner(match.id, match.team1Id)}
                      className={clsx(
                        'flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-bold transition-colors',
                        match.winnerId === match.team1Id
                          ? 'bg-[#0097D7]/20 border border-[#0097D7]/60 text-[#0097D7]'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70',
                      )}
                    >
                      <Trophy size={11} />
                      {match.winnerId === match.team1Id ? 'Ganador' : team1?.name ?? 'Equipo 1'}
                    </button>
                  )}
                </div>

                {/* Centro: toggle resultado + scores */}
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  {match.result === null ? (
                    <button
                      type="button"
                      onClick={() => update(match.id, { result: { team1Score: 0, team2Score: 0 } })}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white transition-colors whitespace-nowrap"
                    >
                      + Resultado
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={phase ? Math.ceil(getEffectiveBO(phase, match.round) / 2) : 3}
                          value={match.result.team1Score}
                          onChange={e => updateScore(match.id, 'team1Score', e.target.value)}
                          className={clsx(
                            'w-12 px-2 py-1 rounded bg-white/5 border text-sm text-center font-bold text-white focus:outline-none',
                            match.winnerId === match.team1Id ? 'border-[#0097D7]/50' : 'border-white/10',
                          )}
                        />
                        <span className="text-white/30 text-xs">-</span>
                        <input
                          type="number"
                          min={0}
                          max={phase ? Math.ceil(getEffectiveBO(phase, match.round) / 2) : 3}
                          value={match.result.team2Score}
                          onChange={e => updateScore(match.id, 'team2Score', e.target.value)}
                          className={clsx(
                            'w-12 px-2 py-1 rounded bg-white/5 border text-sm text-center font-bold text-white focus:outline-none',
                            match.winnerId === match.team2Id ? 'border-[#0097D7]/50' : 'border-white/10',
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => clearResult(match.id)}
                        className="text-[10px] text-white/20 hover:text-red-400 transition-colors"
                      >
                        Limpiar
                      </button>
                    </>
                  )}
                </div>

                {/* Equipo 2 */}
                <div className="flex flex-col gap-1.5">
                  <select
                    value={match.team2Id}
                    onChange={e => update(match.id, { team2Id: e.target.value, winnerId: undefined })}
                    className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                  >
                    {match.team2Id === 'TBD' && <option value="TBD">Pendiente</option>}
                    {selectTeams(match.team2Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {match.result !== null && (
                    <button
                      type="button"
                      onClick={() => setWinner(match.id, match.team2Id)}
                      className={clsx(
                        'flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-bold transition-colors',
                        match.winnerId === match.team2Id
                          ? 'bg-[#0097D7]/20 border border-[#0097D7]/60 text-[#0097D7]'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70',
                      )}
                    >
                      <Trophy size={11} />
                      {match.winnerId === match.team2Id ? 'Ganador' : team2?.name ?? 'Equipo 2'}
                    </button>
                  )}
                </div>
              </div>

              {/* Fecha con DateTimePicker */}
              <div>
                <label className="text-xs text-white/30 mb-1 block">Fecha y hora</label>
                <DateTimePicker
                  value={match.scheduledAt}
                  onChange={iso => update(match.id, { scheduledAt: iso })}
                />
              </div>

              {/* Tournament Codes */}
              {hasTournamentConfig && (
                <div>
                  <label className="text-xs text-white/30 mb-1.5 block">Tournament Codes</label>
                  {match.tournamentCodes?.length ? (
                    <div className="flex flex-col gap-1.5">
                      {match.tournamentCodes.map((code, i) => (
                        <TournamentCodeCard
                          key={code}
                          code={code}
                          gameNumber={i + 1}
                          onCopy={copyToClipboard}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => generateTournamentCodes(match.id)}
                        disabled={generatingCodes === match.id}
                        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:border-[#0097D7]/30 transition-colors disabled:opacity-50"
                        title="Comprueba si han expirado y los regenera"
                      >
                        {generatingCodes === match.id ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />}
                        Regenerar expirados
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => generateTournamentCodes(match.id)}
                      disabled={generatingCodes === match.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:border-[#0097D7]/30 transition-colors disabled:opacity-50"
                    >
                      {generatingCodes === match.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Generando...</>
                      ) : (
                        <><Ticket size={12} /> Generar Codes</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Partidas — datos manuales o Riot ID */}
              <div>
                <label className="text-xs text-white/30 mb-1.5 block">
                  Partidas (BO{phase?.config.roundBo?.[String(match.round)] ?? phase?.config.bo ?? 1})
                </label>
                <div className="flex flex-col gap-2">
                  {Array.from(
                    { length: phase?.config.roundBo?.[String(match.round)] ?? phase?.config.bo ?? 1 },
                    (_, i) => {
                      const gameData = match.games?.[i]
                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/30 w-16 shrink-0">Partida {i + 1}</span>
                            {/* Botón de datos — abre modal */}
                            <button
                              type="button"
                              onClick={() => setGameModal({ matchId: match.id, gameIndex: i })}
                              className={clsx(
                                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0',
                                gameData
                                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                                  : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70',
                              )}
                            >
                              {gameData ? (
                                <><Check size={11} /> {gameData.duration}</>
                              ) : (
                                <><FileJson2 size={11} /> Datos</>
                              )}
                            </button>
                            {/* Clear game data */}
                            {gameData && (
                              <button
                                type="button"
                                onClick={() => {
                                  const games = [...(match.games ?? [])]
                                  games.splice(i, 1, null)
                                  while (games.length > 0 && games[games.length - 1] === null) games.pop()
                                  update(match.id, { games: games.length > 0 ? games : undefined })
                                }}
                                className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                              >
                                <X size={12} />
                              </button>
                            )}
                            {/* Riot match ID — fallback para datos de Riot en página pública */}
                            <input
                              type="text"
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#0097D7]"
                              placeholder="EUW1_..."
                              value={match.riotMatchIds?.[i] ?? ''}
                              onChange={(e) => {
                                const value = e.target.value.trim()
                                const riotMatchIds = [...(match.riotMatchIds ?? [])]
                                riotMatchIds[i] = value || null
                                while (riotMatchIds.length > 0 && riotMatchIds[riotMatchIds.length - 1] === null) {
                                  riotMatchIds.pop()
                                }
                                update(match.id, {
                                  riotMatchIds: riotMatchIds.length > 0 ? riotMatchIds : undefined,
                                })
                              }}
                            />
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </div>

                        <div className="self-end flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`${window.location.origin}/overlay/partidos/${match.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white hover:border-white/30 transition-colors"
                            title="Copiar URL del overlay"
                          >
                            <Copy size={14} />
                            Overlay
                          </button>
                          <button
                            onClick={() => saveMatch(match)}
                            disabled={saving === match.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-50"
                          >
                            <Save size={14} />
                            {saving === match.id ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </>
  )
}

// ─── Modal de datos de partida ────────────────────────────────────────────────

function GameDataModal({
  title,
  onApply,
  onClose,
}: {
  title: string
  onApply: (data: GameData) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [jsonFile, setJsonFile] = useState<File | null>(null)

  function handleJsonUpload() {
    if (!jsonFile) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const validation = GameDataSchema.safeParse(parsed)
        if (!validation.success) {
          setError(`JSON inválido: ${validation.error.issues[0]?.message ?? 'formato incorrecto'}`)
          return
        }
        onApply(validation.data)
      } catch {
        setError('No se pudo leer el archivo JSON')
      }
    }
    reader.readAsText(jsonFile)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-[#0d1321] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="font-bold text-sm">{title}</h2>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-5 p-5">
          {/* ── Sección JSON ── */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Cargar datos de partida</p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors cursor-pointer">
                <FileJson2 size={13} />
                {jsonFile ? jsonFile.name : 'Seleccionar .json...'}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setJsonFile(f); setError(null) }; e.target.value = '' }}
                />
              </label>
              <button
                type="button"
                onClick={handleJsonUpload}
                disabled={!jsonFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-bold hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Subir JSON
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
