'use client'
import { useState, useEffect } from 'react'
import type { Team, Player, Role } from '@/lib/types'
import Image from 'next/image'
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Upload } from 'lucide-react'

const PRIMARY_ROLES: Role[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente']
const SECONDARY_ROLES: Exclude<Role, 'Suplente'>[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill']

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

export default function AdminEquipos() {
  const [teams, setTeams] = useState<Team[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/equipos').then(r => r.json()).then(setTeams)
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  async function saveTeam(team: Team) {
    setSaving(team.id)
    const res = await fetch('/api/admin/equipos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(team),
    })
    setSaving(null)
    if (res.ok) notify('Guardado')
  }

  async function addTeam() {
    const res = await fetch('/api/admin/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo equipo', logo: '/logos/default.png', players: [] }),
    })
    const team = await res.json()
    setTeams(prev => [...prev, team])
    setExpanded(team.id)
  }

  async function deleteTeam(id: string) {
    if (!confirm('¿Eliminar este equipo?')) return
    await fetch('/api/admin/equipos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  function updateTeam(id: string, patch: Partial<Team>) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  async function uploadLogo(teamId: string, file: File) {
    setUploading(teamId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('teamId', teamId)
    const res = await fetch('/api/admin/equipos/upload-logo', { method: 'POST', body: formData })
    setUploading(null)
    if (!res.ok) {
      const { error } = await res.json()
      notify(error || 'Error al subir logo')
      return
    }
    const { path } = await res.json()
    updateTeam(teamId, { logo: path })
    notify('Logo subido')
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
          {msg && <span className="text-green-400 text-sm">{msg}</span>}
          <button onClick={addTeam} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors">
            <Plus size={15} /> Añadir equipo
          </button>
        </div>
      </div>

      {teams.map(team => (
        <div key={team.id} className="rounded-xl border border-white/10 overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 bg-[#0d1321] cursor-pointer hover:bg-white/5"
            onClick={() => setExpanded(e => e === team.id ? null : team.id)}
          >
            {expanded === team.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="font-medium flex-1">{team.name}</span>
            <span className="text-xs text-white/30">{team.players.length} jugadores</span>
            <button onClick={e => { e.stopPropagation(); deleteTeam(team.id) }} className="text-white/20 hover:text-red-400 transition-colors ml-2">
              <Trash2 size={15} />
            </button>
          </div>

          {expanded === team.id && (
            <div className="p-4 border-t border-white/10 flex flex-col gap-4">
              {/* Datos del equipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Nombre del equipo</label>
                  <input
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
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:border-[#0097D7]/50 cursor-pointer transition-colors">
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
                        disabled={uploading === team.id}
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
                        value={p.summonerName}
                        onChange={e => updatePlayer(team.id, p.id, { summonerName: e.target.value })}
                        placeholder="Nick#TAG"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#0097D7]/50"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={p.primaryRole}
                          onChange={e => updatePlayer(team.id, p.id, { primaryRole: e.target.value as Role })}
                          className="flex-1 sm:flex-none px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                        >
                          {PRIMARY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={p.secondaryRole ?? ''}
                          onChange={e => updatePlayer(team.id, p.id, { secondaryRole: e.target.value as Exclude<Role, 'Suplente'> || undefined })}
                          className="flex-1 sm:flex-none px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 focus:outline-none"
                        >
                          <option value="">— 2º rol</option>
                          {SECONDARY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => removePlayer(team.id, p.id)} className="ml-auto sm:ml-0 text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => saveTeam(team)}
                disabled={saving === team.id}
                className="self-end flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving === team.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
