'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Clock3, ImageUp, LogOut, Plus, RefreshCw, Send, Shield } from 'lucide-react'
import type { Player, Role, Team, TeamChangeRequest } from '@/lib/types'

const PRIMARY: Role[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente']
const SECONDARY: Exclude<Role, 'Suplente'>[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill']
type PortalData = { team: Team; requests: TeamChangeRequest[] }

export default function TeamPanelPage() {
  const [data, setData] = useState<PortalData | null>(null)
  const [message, setMessage] = useState('')
  const [namePlayer, setNamePlayer] = useState<Player | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ summonerName: '', primaryRole: 'Fill' as Role, secondaryRole: '' })

  async function load() {
    const response = await fetch('/api/team', { cache: 'no-store' })
    if (response.status === 401 || response.status === 403) { window.location.assign('/equipo/login'); return }
    if (response.ok) setData(await response.json())
  }
  useEffect(() => {
    fetch('/api/team', { cache: 'no-store' }).then(async response => {
      if (response.status === 401 || response.status === 403) { window.location.assign('/equipo/login'); return }
      if (response.ok) setData(await response.json())
    })
  }, [])
  function notify(value: string) { setMessage(value); window.setTimeout(() => setMessage(''), 3500) }

  async function saveRoles(player: Player, patch: Partial<Player>) {
    if (!data?.team.version) return
    const secondaryRole = Object.prototype.hasOwnProperty.call(patch, 'secondaryRole') ? patch.secondaryRole : player.secondaryRole
    const response = await fetch(`/api/team/players/${player.id}/roles`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: data.team.version, primaryRole: patch.primaryRole ?? player.primaryRole, secondaryRole }) })
    if (!response.ok) { notify((await response.json()).error ?? 'No se pudo guardar'); await load(); return }
    const team = await response.json() as Team
    setData(current => current ? { ...current, team } : current); notify('Rol actualizado')
  }

  async function requestJson(body: object) {
    const response = await fetch('/api/team/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) { notify(typeof result.error === 'string' ? result.error : 'Revisa los datos'); return false }
    await load(); notify('Solicitud enviada'); return true
  }

  async function requestLogo(file: File) {
    const form = new FormData(); form.append('file', file)
    const response = await fetch('/api/team/requests/logo', { method: 'POST', body: form })
    const result = await response.json()
    if (!response.ok) notify(result.error ?? 'No se pudo enviar el logo')
    else { await load(); notify('Logo enviado para revisión') }
  }

  if (!data) return <div className="min-h-[60vh] grid place-items-center text-white/40"><RefreshCw className="animate-spin" /></div>
  const pending = data.requests.filter(request => request.status === 'pending')
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-center gap-4 pb-7 border-b border-white/10">
        <div className="size-20 rounded-xl border border-white/10 bg-white/5 grid place-items-center overflow-hidden">
          {data.team.logo ? <Image src={data.team.logo} alt={`Logo de ${data.team.name}`} width={80} height={80} className="size-full object-contain p-2" /> : <Shield size={32} className="text-white/20" />}
        </div>
        <div className="min-w-0"><p className="text-sm text-[#33b3e8]">Panel del equipo</p><h1 className="text-3xl font-semibold tracking-tight truncate">{data.team.name}</h1><p className="text-sm text-white/35 mt-1">{data.team.players.length} jugadores · {pending.length} solicitudes pendientes</p></div>
        <div className="ml-auto flex items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-white/65 hover:text-white"><ImageUp size={15} className="inline mr-2" />Solicitar logo<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void requestLogo(file); event.target.value = '' }} /></label>
          <button onClick={async () => { await fetch('/api/team/login', { method: 'DELETE' }); window.location.assign('/equipo/login') }} className="inline-flex items-center gap-2 rounded-lg border border-red-400/25 px-3 py-2 text-sm font-medium text-red-300 hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-200 transition-colors"><LogOut size={16} />Cerrar sesión</button>
        </div>
      </header>
      {message && <div role="status" className="mt-4 rounded-lg border border-[#0097D7]/25 bg-[#0097D7]/10 px-4 py-2 text-sm text-[#7dd3fc]">{message}</div>}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="text-lg font-semibold">Plantilla</h2><p className="text-sm text-white/35">Los cambios de rol se aplican al momento.</p></div><button onClick={() => setAdding(true)} className="text-sm text-[#33b3e8] hover:text-white"><Plus size={15} className="inline mr-1" />Solicitar jugador</button></div>
        <div className="border-y border-white/10 divide-y divide-white/8">
          {data.team.players.map(player => <div key={player.id} className="grid gap-3 py-4 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto] md:items-center">
            <button onClick={() => { setNamePlayer(player); setNewName(player.summonerName) }} className="text-left min-w-0 group"><span className="font-medium truncate block">{player.summonerName}</span><span className="text-xs text-white/30 group-hover:text-[#33b3e8]">Solicitar cambio de nombre</span></button>
            <select aria-label={`Rol principal de ${player.summonerName}`} value={player.primaryRole} onChange={event => void saveRoles(player, { primaryRole: event.target.value as Role })} className="rounded-lg border border-white/10 px-2 py-2 text-sm"><option disabled>Rol principal</option>{PRIMARY.map(role => <option key={role}>{role}</option>)}</select>
            <select aria-label={`Rol secundario de ${player.summonerName}`} value={player.secondaryRole ?? ''} onChange={event => void saveRoles(player, { secondaryRole: (event.target.value || undefined) as Player['secondaryRole'] })} className="rounded-lg border border-white/10 px-2 py-2 text-sm"><option value="">Sin segundo rol</option>{SECONDARY.map(role => <option key={role}>{role}</option>)}</select>
            <span className="hidden md:block text-white/15"><Check size={16} /></span>
          </div>)}
        </div>
      </section>

      <section className="mt-10"><h2 className="text-lg font-semibold">Solicitudes</h2><div className="mt-3 space-y-2">{data.requests.length === 0 && <p className="text-sm text-white/35 py-4">Aún no has enviado ninguna solicitud.</p>}{data.requests.map(request => <div key={request.id} className="flex items-center gap-3 rounded-lg bg-white/[.025] px-4 py-3"><Clock3 size={16} className={request.status === 'pending' ? 'text-amber-300' : request.status === 'approved' ? 'text-green-400' : 'text-red-400'} /><div className="min-w-0 flex-1"><p className="text-sm">{request.type === 'team_logo' ? 'Cambio de logo' : request.type === 'new_player' ? `Nuevo jugador: ${String(request.payload.summonerName)}` : `Nuevo Riot ID: ${String(request.payload.summonerName)}`}</p>{request.rejectionReason && <p className="text-xs text-red-300/70 mt-1">{request.rejectionReason}</p>}</div><span className="text-xs text-white/35">{request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span></div>)}</div></section>

      {(namePlayer || adding) && <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) { setNamePlayer(null); setAdding(false) } }}><form onSubmit={async event => { event.preventDefault(); if (namePlayer) { if (await requestJson({ type: 'summoner_name', playerId: namePlayer.id, summonerName: newName })) setNamePlayer(null) } else if (await requestJson({ type: 'new_player', ...newPlayer, secondaryRole: newPlayer.secondaryRole || undefined })) setAdding(false) }} className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1321] p-6 shadow-2xl"><h2 className="text-xl font-semibold">{namePlayer ? 'Cambiar Riot ID' : 'Solicitar nuevo jugador'}</h2><p className="mt-1 text-sm text-white/40">La organización revisará el cambio antes de publicarlo.</p><label className="block mt-5 mb-2 text-sm text-white/60" htmlFor="summoner">Riot ID</label><input id="summoner" autoFocus value={namePlayer ? newName : newPlayer.summonerName} onChange={event => namePlayer ? setNewName(event.target.value) : setNewPlayer(value => ({ ...value, summonerName: event.target.value }))} placeholder="Nick#TAG" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" />{adding && <div className="grid grid-cols-2 gap-3 mt-4"><select value={newPlayer.primaryRole} onChange={event => setNewPlayer(value => ({ ...value, primaryRole: event.target.value as Role }))} className="rounded-lg border border-white/10 px-2 py-2">{PRIMARY.map(role => <option key={role}>{role}</option>)}</select><select value={newPlayer.secondaryRole} onChange={event => setNewPlayer(value => ({ ...value, secondaryRole: event.target.value }))} className="rounded-lg border border-white/10 px-2 py-2"><option value="">Sin segundo rol</option>{SECONDARY.map(role => <option key={role}>{role}</option>)}</select></div>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setNamePlayer(null); setAdding(false) }} className="px-4 py-2 text-sm text-white/50">Cancelar</button><button className="rounded-lg bg-[#0097D7] px-4 py-2 text-sm font-semibold"><Send size={14} className="inline mr-2" />Enviar solicitud</button></div></form></div>}
    </div>
  )
}
