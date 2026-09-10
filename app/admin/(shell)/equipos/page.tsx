'use client'
import { useState, useEffect } from 'react'
import type { Team, Player, Role } from '@/lib/types'
import Image from 'next/image'
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Upload, X } from 'lucide-react'
import { adminRequest, errorMessage, isOk, isPathResponse, isTeam, isTeamArray } from '@/lib/admin-client'
import TeamAccessControl from '@/components/admin/TeamAccessControl'

const PRIMARY_ROLES: Role[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente']
const SECONDARY_ROLES: Exclude<Role, 'Suplente'>[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill']

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

export default function AdminEquipos() {
  const [teams, setTeams] = useState<Team[]>([])
  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    adminRequest<Team[]>(fetch('/api/admin/equipos'), isTeamArray).then(setTeams).catch(error => setLoadError(errorMessage(error)))
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  async function saveTeam(team: Team) {
    const isDraft = draftIds.has(team.id)
    setSaving(team.id)
    try {
      if (isDraft) {
        const created = await adminRequest<Team>(fetch('/api/admin/equipos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: team.name, logo: team.logo, players: team.players }),
        }), isTeam)
        setTeams(prev => prev.map(candidate => candidate.id === team.id ? created : candidate))
        setDraftIds(prev => {
          const next = new Set(prev)
          next.delete(team.id)
          return next
        })
        setExpanded(created.id)
      } else {
        const saved = await adminRequest<Team>(fetch('/api/admin/equipos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(team) }), isTeam)
        setTeams(prev => prev.map(candidate => candidate.id === team.id ? saved : candidate))
      }
      notify('Cambios guardados')
    } catch (error) {
      // A draft is only a client-side preview. Remove it when the server did
      // not accept the create request so a rejected entity cannot look saved.
      if (isDraft) cancelDraft(team.id)
      notify(errorMessage(error))
    } finally { setSaving(null) }
  }

  function addTeam() {
    const team: Team = { id: `draft-${genId()}`, name: '', logo: '', players: [] }
    setTeams(prev => [...prev, team])
    setDraftIds(prev => new Set(prev).add(team.id))
    setExpanded(team.id)
  }

  function cancelDraft(id: string) {
    setTeams(prev => prev.filter(team => team.id !== id))
    setDraftIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setExpanded(current => current === id ? null : current)
  }

  async function deleteTeam(id: string) {
    if (!confirm('¿Eliminar este equipo?')) return
    setDeleting(id)
    try {
      const team = teams.find(candidate => candidate.id === id)
      await adminRequest(fetch('/api/admin/equipos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, version: team?.version }) }), isOk)
      setTeams(prev => prev.filter(t => t.id !== id)); notify('Equipo eliminado')
    } catch (error) { notify(errorMessage(error)) } finally { setDeleting(null) }
  }

  function updateTeam(id: string, patch: Partial<Team>) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  async function uploadLogo(teamId: string, file: File) {
    setUploading(teamId)
    setMsg('Subiendo logo...')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('teamId', teamId)
    try {
      const data = await adminRequest<{ path: string }>(fetch('/api/admin/equipos/upload-logo', { method: 'POST', body: formData }), isPathResponse)
      updateTeam(teamId, { logo: data.path }); notify('Logo guardado')
    } catch (error) { notify(errorMessage(error)) } finally { setUploading(null) }
  }

  function addPlayer(teamId: string) {
    const player: Player = { id: genId(), summonerName: '', primaryRole: 'Fill' }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: [...t.players, player] } : t))
  }

  function updatePlayer(teamId: string, playerId: string, patch: Partial<Player>) {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, players: t.players.map(p => p.id === playerId ? { ...p, ...patch } : p) } : t
    ))
  }

  function removePlayer(teamId: string, playerId: string) {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, players: t.players.filter(p => p.id !== playerId) } : t
    ))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Equipos</h1>
        <div className="flex items-center gap-3">
          {(msg || loadError) && <span className={(loadError || msg.startsWith('Error') || msg.startsWith('Sesión')) ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{loadError || msg}</span>}
          <button onClick={addTeam} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors">
            <Plus size={15} /> Añadir equipo
          </button>
        </div>
      </div>

      {loadError ? <p className="text-red-400 text-sm">No se pudieron cargar los equipos.</p> : teams.map(team => (
        <div key={team.id} className="rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#0d1321] hover:bg-white/5">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-expanded={expanded === team.id}
              aria-controls={`team-details-${team.id}`}
              onClick={() => setExpanded(e => e === team.id ? null : team.id)}
            >
              {expanded === team.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-medium flex-1">{team.name || 'Nuevo equipo'}</span>
              <span className="text-xs text-white/30">{team.players.length} jugadores</span>
            </button>
            <button onClick={e => {
              e.stopPropagation()
              if (draftIds.has(team.id)) cancelDraft(team.id)
              else deleteTeam(team.id)
            }} disabled={saving === team.id || deleting === team.id} aria-label={`${draftIds.has(team.id) ? 'Cancelar' : 'Eliminar'} equipo ${team.name || 'nuevo'}`} className="text-white/20 hover:text-red-400 transition-colors ml-2 disabled:opacity-50">
              <Trash2 size={15} />
            </button>
          </div>

          {expanded === team.id && (
            <div id={`team-details-${team.id}`} className="p-4 border-t border-white/10 flex flex-col gap-4">
              {!draftIds.has(team.id) && <TeamAccessControl teamId={team.id} />}
              {/* Datos del equipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Nombre del equipo</label>
                  <input
                    aria-label={`Nombre del equipo ${team.name || 'nuevo'}`}
                    value={team.name}
                    onChange={e => updateTeam(team.id, { name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#0097D7]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Logo</label>
                  <div className="flex items-center gap-3">
                    {team.logo && (
                      <Image
                        src={team.logo}
                        alt={team.name}
                        width={40}
                        height={40}
                        className="rounded-lg object-contain bg-white/5"
                      />
                    )}
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 transition-colors ${draftIds.has(team.id) ? 'cursor-not-allowed opacity-50' : 'hover:border-[#0097D7]/50 cursor-pointer'}`}>
                      <Upload size={14} />
                      {uploading === team.id ? 'Subiendo...' : 'Subir logo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadLogo(team.id, file)
                          e.target.value = ''
                        }}
                        disabled={uploading === team.id || draftIds.has(team.id)}
                        aria-label={`Subir logo de ${team.name || 'nuevo equipo'}`}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Jugadores */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Jugadores</span>
                  <button onClick={() => addPlayer(team.id)} className="flex items-center gap-1 text-xs text-[#0097D7] hover:text-[#33b3e8]">
                    <Plus size={13} /> Añadir
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {team.players.map(p => (
                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg bg-white/3 border border-white/5">
                      <input
                        aria-label={`Nombre del jugador ${p.summonerName || 'nuevo'} de ${team.name || 'nuevo equipo'}`}
                        value={p.summonerName}
                        onChange={e => updatePlayer(team.id, p.id, { summonerName: e.target.value })}
                        placeholder="Nick#TAG"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#0097D7]/50"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Rol principal de ${p.summonerName || 'nuevo jugador'} en ${team.name || 'nuevo equipo'}`}
                          value={p.primaryRole}
                          onChange={e => updatePlayer(team.id, p.id, { primaryRole: e.target.value as Role })}
                          className="flex-1 sm:flex-none px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                        >
                          {PRIMARY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          aria-label={`Rol secundario de ${p.summonerName || 'nuevo jugador'} en ${team.name || 'nuevo equipo'}`}
                          value={p.secondaryRole ?? ''}
                          onChange={e => updatePlayer(team.id, p.id, { secondaryRole: e.target.value as Exclude<Role, 'Suplente'> || undefined })}
                          className="flex-1 sm:flex-none px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 focus:outline-none"
                        >
                          <option value="">— 2º rol</option>
                          {SECONDARY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button aria-label={`Eliminar jugador ${p.summonerName || 'nuevo'} de ${team.name || 'nuevo equipo'}`} onClick={() => removePlayer(team.id, p.id)} className="ml-auto sm:ml-0 text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="self-end flex items-center gap-2">
                {draftIds.has(team.id) && (
                  <button
                    onClick={() => cancelDraft(team.id)}
                    disabled={saving === team.id}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:text-white transition-colors disabled:opacity-50"
                  >
                    <X size={14} /> Cancelar
                  </button>
                )}
                <button
                  onClick={() => saveTeam(team)}
                  disabled={saving === team.id}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving === team.id ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
