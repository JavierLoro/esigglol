'use client'
import { useEffect, useState } from 'react'
import type { Team } from '@/lib/types'

export default function TeamLoginPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/data/equipos').then(res => res.json()).then((items: Team[]) => setTeams(items)).catch(() => setError('No se pudieron cargar los equipos')) }, [])

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    const response = await fetch('/api/team/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, password }) })
    setLoading(false)
    if (response.ok) window.location.href = '/equipo'
    else setError((await response.json().catch(() => ({}))).error ?? 'No se pudo iniciar sesión')
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center px-5 py-12">
      <form onSubmit={login} className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0d1321] p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Acceso de equipos</h1>
        <p className="mt-1 text-sm text-white/40">Usa la clave facilitada por la organización.</p>
        <label className="mt-7 block text-sm text-white/60 mb-2" htmlFor="team">Equipo</label>
        <select id="team" required value={teamId} onChange={event => setTeamId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 focus:outline-none focus:border-[#0097D7]">
          <option value="">Selecciona tu equipo</option>
          {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <label className="block text-sm text-white/60 mt-5 mb-2" htmlFor="password">Contraseña</label>
        <input id="password" type="password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 focus:outline-none focus:border-[#0097D7]" />
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-lg bg-[#0097D7] py-2.5 font-semibold hover:bg-[#33b3e8] disabled:opacity-50">{loading ? 'Entrando…' : 'Entrar al panel'}</button>
      </form>
    </div>
  )
}
