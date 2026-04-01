'use client'
import { useState, useEffect } from 'react'
import type { Match, Team, Phase } from '@/lib/types'
import { Plus, Trash2, Save, Trophy, Check, Loader2, X, Copy, Ticket, Users, FileJson2, ImageUp } from 'lucide-react'
import type { GameData } from '@/lib/types'
import { GameDataSchema } from '@/lib/schemas'
import { DEFAULT_SCREENSHOT_PROMPT } from '@/lib/screenshot-prompt'
import DateTimePicker from '@/components/admin/DateTimePicker'
import clsx from 'clsx'

export default function AdminPartidos() {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [selectedPhase, setSelectedPhase] = useState<string>('all')
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [parsing, setParsing] = useState<string | null>(null) // "matchId-gameIndex"
  const [parseError, setParseError] = useState<string | null>(null)
  const [hasTournamentConfig, setHasTournamentConfig] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState<string | null>(null)
  const [lobbyData, setLobbyData] = useState<Record<string, { summonerName: string; eventType: string }[]>>({})
  const [gameModal, setGameModal] = useState<{ matchId: string; gameIndex: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/partidos').then(r => r.json()),
      fetch('/api/data/equipos').then(r => r.json()),
      fetch('/api/admin/fases').then(r => r.json()),
    ]).then(([m, t, p]) => { setMatches(m); setTeams(t); setPhases(p) })
    fetch('/api/admin/tournament').then(r => r.json()).then(data => {
      if (data?.providerId) setHasTournamentConfig(true)
    }).catch(() => {})
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  async function addMatch() {
    const phaseId = selectedPhase !== 'all' ? selectedPhase : phases[0]?.id ?? ''
    const res = await fetch('/api/admin/partidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId, round: 1, team1Id: teams[0]?.id ?? '', team2Id: teams[1]?.id ?? '', result: null, riotMatchIds: [] }),
    })
    const [match] = await res.json()
    setMatches(prev => [...prev, match])
  }

  async function saveMatch(match: Match) {
    setSaving(match.id)
    const res = await fetch('/api/admin/partidos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(match),
    })
    const updated = await res.json()
    // Refrescar todos los matches para ver avances de bracket
    const all = await fetch('/api/admin/partidos').then(r => r.json())
    setMatches(all)
    // Refrescar fases por si cambió el estado
    const allPhases = await fetch('/api/admin/fases').then(r => r.json())
    setPhases(allPhases)
    setSaving(null)
    notify(updated.winnerId ? '¡Guardado — bracket actualizado!' : 'Guardado')
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} partido(s)?`)) return
    setDeleting(true)
    await fetch('/api/admin/partidos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setMatches(prev => prev.filter(m => !selected.has(m.id)))
    setSelected(new Set())
    setDeleting(false)
    notify(`${selected.size} partido(s) eliminado(s)`)
  }

  function update(id: string, patch: Partial<Match>) {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function updateScore(id: string, key: 'team1Score' | 'team2Score', val: string) {
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m
      const result = m.result ?? { team1Score: 0, team2Score: 0 }
      const newResult = { ...result, [key]: Number(val) }
      // Recalcular winnerId según scores
      const winnerId = newResult.team1Score > newResult.team2Score
        ? m.team1Id
        : newResult.team2Score > newResult.team1Score
          ? m.team2Id
          : undefined
      return { ...m, result: newResult, winnerId }
    }))
  }

  function setWinner(matchId: string, winnerId: string) {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m
      const phase = phases.find(p => p.id === m.phaseId)
      const bo = phase?.config.bo ?? 1
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
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(m => m.id)))
    }
  }

  function applyGameData(matchId: string, gameIndex: number, gameData: GameData) {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m
      const games = [...(m.games ?? [])]
      while (games.length <= gameIndex) games.push(undefined as unknown as GameData)
      games[gameIndex] = gameData
      return { ...m, games }
    }))
    notify(`Partida ${gameIndex + 1} cargada: ${gameData.duration}`)
  }

  async function uploadScreenshot(matchId: string, gameIndex: number, file: File, customPrompt?: string): Promise<GameData | null> {
    const key = `${matchId}-${gameIndex}`
    setParsing(key)
    setParseError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (customPrompt) formData.append('prompt', customPrompt)
      const res = await fetch('/api/admin/partidos/parse-screenshot', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setParseError(data.error ?? 'Error al parsear')
        return null
      }
      return data as GameData
    } catch {
      setParseError('Error de red al enviar la captura')
      return null
    } finally {
      setParsing(null)
    }
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
        m.id === matchId ? { ...m, tournamentCodes: data.codes } : m
      ))
      notify('Tournament codes generados')
    } catch {
      notify('Error de conexion')
    } finally {
      setGeneratingCodes(null)
    }
  }

  async function fetchLobbyEvents(code: string) {
    try {
      const res = await fetch(`/api/admin/partidos/lobby?code=${encodeURIComponent(code)}`)
      const events = await res.json()
      if (Array.isArray(events)) {
        setLobbyData(prev => ({ ...prev, [code]: events }))
      }
    } catch { /* ignore */ }
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

  const filtered = selectedPhase === 'all' ? matches : matches.filter(m => m.phaseId === selectedPhase)
  const allSelected = filtered.length > 0 && selected.size === filtered.length

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
          parsing={parsing === `${gameModal.matchId}-${gameModal.gameIndex}`}
          onParse={async (file, prompt) => {
            const result = await uploadScreenshot(gameModal.matchId, gameModal.gameIndex, file, prompt)
            return result
          }}
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
          {msg && <span className="text-green-400 text-sm">{msg}</span>}

          {/* Borrar seleccionados */}
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

          <select
            value={selectedPhase}
            onChange={e => { setSelectedPhase(e.target.value); setSelected(new Set()) }}
            className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
          >
            <option value="all">Todas las fases</option>
            {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button onClick={addMatch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors">
            <Plus size={15} /> Añadir partido
          </button>
        </div>
      </div>

      {/* Seleccionar todo */}
      {filtered.length > 0 && (
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

      {filtered.length === 0 && <p className="text-white/40 text-sm">No hay partidos. Añade el primero.</p>}

      <div className="flex flex-col gap-3">
        {filtered.map(match => {
          const phase = phases.find(p => p.id === match.phaseId)
          const team1 = teams.find(t => t.id === match.team1Id)
          const team2 = teams.find(t => t.id === match.team2Id)
          const isSelected = selected.has(match.id)

          return (
            <div
              key={match.id}
              className={clsx(
                'rounded-xl border bg-[#0d1321] p-4 flex flex-col gap-3 transition-colors',
                isSelected ? 'border-[#0097D7]/50 bg-[#0097D7]/5' : 'border-white/10',
              )}
            >
              {/* Cabecera: checkbox + fase + ronda + delete */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(match.id)}
                  className="accent-[#0097D7] shrink-0"
                />
                <select
                  value={match.phaseId}
                  onChange={e => update(match.id, { phaseId: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none"
                >
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
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
                <button onClick={() => { setSelected(new Set([match.id])); setTimeout(deleteSelected, 0) }} className="text-white/20 hover:text-red-400 transition-colors shrink-0 hidden">
                  <Trash2 size={15} />
                </button>
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
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                          max={phase?.config.bo ?? 5}
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
                          max={phase?.config.bo ?? 5}
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
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-white/30 w-16 shrink-0">Game {i + 1}</span>
                          <code className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-[#0097D7] font-mono select-all">
                            {code}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(code)}
                            className="text-white/30 hover:text-[#0097D7] transition-colors shrink-0"
                            title="Copiar"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => fetchLobbyEvents(code)}
                            className="text-white/30 hover:text-[#0097D7] transition-colors shrink-0"
                            title="Ver lobby"
                          >
                            <Users size={13} />
                          </button>
                          {lobbyData[code]?.length ? (
                            <span className="text-[10px] text-green-400">
                              {lobbyData[code].length} evento(s)
                            </span>
                          ) : null}
                        </div>
                      ))}
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

              {/* Partidas — captura o Riot ID */}
              <div>
                <label className="text-xs text-white/30 mb-1.5 block">
                  Partidas (BO{phase?.config.roundBo?.[String(match.round)] ?? phase?.config.bo ?? 1})
                </label>
                <div className="flex flex-col gap-2">
                  {Array.from(
                    { length: phase?.config.roundBo?.[String(match.round)] ?? phase?.config.bo ?? 1 },
                    (_, i) => {
                      const gameData = match.games?.[i]
                      const isParsing = parsing === `${match.id}-${i}`
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
                                  games.splice(i, 1, undefined as unknown as GameData)
                                  while (games.length > 0 && !games[games.length - 1]) games.pop()
                                  update(match.id, { games: games.length > 0 ? games : undefined })
                                }}
                                className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }
                  )}
                  {parseError && (
                    <span className="text-xs text-red-400">{parseError}</span>
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
    </div>
    </>
  )
}

// ─── Modal de datos de partida ────────────────────────────────────────────────

function GameDataModal({
  title,
  parsing,
  onParse,
  onApply,
  onClose,
}: {
  title: string
  parsing: boolean
  onParse: (file: File, prompt: string) => Promise<GameData | null>
  onApply: (data: GameData) => void
  onClose: () => void
}) {
  const [image, setImage] = useState<File | null>(null)
  const [prompt, setPrompt] = useState(DEFAULT_SCREENSHOT_PROMPT)
  const [result, setResult] = useState<GameData | null>(null)
  const [resultJson, setResultJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [jsonFile, setJsonFile] = useState<File | null>(null)

  async function handleParse() {
    if (!image) return
    setError(null)
    setResult(null)
    setResultJson('')
    const data = await onParse(image, prompt)
    if (data) {
      setResult(data)
      setResultJson(JSON.stringify(data, null, 2))
    } else {
      setError('No se pudo parsear la imagen')
    }
  }

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
          {/* ── Sección IA ── */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Parsear con IA</p>

            {/* Selector de imagen */}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors cursor-pointer w-fit">
              <ImageUp size={13} />
              {image ? image.name : 'Seleccionar imagen...'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImage(f); e.target.value = '' }}
              />
            </label>

            {/* Prompt editable */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30">Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 font-mono focus:outline-none focus:border-[#0097D7]/40 resize-y"
              />
            </div>

            <button
              type="button"
              onClick={handleParse}
              disabled={!image || parsing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-xs font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-40 w-fit"
            >
              {parsing ? <><Loader2 size={12} className="animate-spin" /> Parseando...</> : <>Parsear con IA</>}
            </button>

            {/* Preview JSON */}
            {resultJson && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/30">Resultado</label>
                <textarea
                  readOnly
                  value={resultJson}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-green-300 font-mono focus:outline-none resize-y"
                />
                <button
                  type="button"
                  onClick={() => result && onApply(result)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/30 border border-green-500/40 text-green-400 text-xs font-bold hover:bg-green-600/40 transition-colors w-fit"
                >
                  <Check size={12} /> Aplicar resultado
                </button>
              </div>
            )}
          </div>

          {/* ── Divisor ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/25">o sube el JSON directamente</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Sección JSON ── */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Subir JSON</p>
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
