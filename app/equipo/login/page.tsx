'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { KeyRound, ShieldCheck } from 'lucide-react'
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

  const selected = teams.find(team => team.id === teamId)
  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid lg:grid-cols-[1fr_30rem]">
      <section className="hidden lg:flex flex-col justify-end p-14 border-r border-white/8 bg-[radial-gradient(circle_at_20%_20%,rgba(0,151,215,.18),transparent_38%)]">
        <ShieldCheck size={38} className="text-[#0097D7] mb-6" />
        <h1 className="max-w-xl text-5xl font-semibold tracking-tight leading-[1.05]">Tu plantilla, al día antes de entrar a la Grieta.</h1>
        <p className="mt-5 max-w-lg text-white/45 text-lg">Actualiza los roles y envía al torneo los cambios que necesitan revisión.</p>
      </section>
      <section className="flex items-center px-5 py-12 sm:px-10 bg-[#0d1321]">
        <form onSubmit={login} className="w-full max-w-sm mx-auto">
          <div className="flex items-center gap-3 mb-8">
            {selected?.logo ? <Image src={selected.logo} alt="" width={48} height={48} className="size-12 object-contain rounded-lg bg-white/5" /> : <div className="size-12 rounded-lg bg-[#0097D7]/15 flex items-center justify-center"><KeyRound className="text-[#0097D7]" /></div>}
            <div><h1 className="text-xl font-semibold">Acceso de equipos</h1><p className="text-sm text-white/40">Usa la clave facilitada por organización.</p></div>
          </div>
          <label className="block text-sm text-white/60 mb-2" htmlFor="team">Equipo</label>
          <select id="team" required value={teamId} onChange={event => setTeamId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 focus:outline-none focus:border-[#0097D7]">
            <option value="">Selecciona tu equipo</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <label className="block text-sm text-white/60 mt-5 mb-2" htmlFor="password">Contraseña</label>
          <input id="password" type="password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 focus:outline-none focus:border-[#0097D7]" />
          {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-lg bg-[#0097D7] py-2.5 font-semibold hover:bg-[#33b3e8] disabled:opacity-50">{loading ? 'Entrando…' : 'Entrar al panel'}</button>
        </form>
      </section>
    </div>
  )
}
