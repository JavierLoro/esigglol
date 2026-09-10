'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Clock3, UserPlus, UserRoundPen, X } from 'lucide-react'
import type { Team, TeamChangeRequest } from '@/lib/types'

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<TeamChangeRequest[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  async function load() {
    const [requestsResponse, teamsResponse] = await Promise.all([fetch('/api/admin/solicitudes', { cache: 'no-store' }), fetch('/api/admin/equipos', { cache: 'no-store' })])
    if (requestsResponse.ok) setRequests(await requestsResponse.json())
    if (teamsResponse.ok) setTeams(await teamsResponse.json())
  }
  useEffect(() => {
    Promise.all([fetch('/api/admin/solicitudes', { cache: 'no-store' }), fetch('/api/admin/equipos', { cache: 'no-store' })]).then(async ([requestsResponse, teamsResponse]) => {
      if (requestsResponse.ok) setRequests(await requestsResponse.json())
      if (teamsResponse.ok) setTeams(await teamsResponse.json())
    })
  }, [])
  async function resolve(request: TeamChangeRequest, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? prompt('Motivo del rechazo (opcional)') ?? '' : ''
    setBusy(request.id)
    const response = await fetch(`/api/admin/solicitudes/${request.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    const result = await response.json()
    setBusy('')
    if (!response.ok) setMessage(typeof result.error === 'string' ? result.error : 'No se pudo resolver la solicitud')
    else { setMessage(action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada'); await load() }
  }
  const teamName = (id: string) => teams.find(team => team.id === id)?.name ?? 'Equipo eliminado'
  return <div className="max-w-5xl flex flex-col gap-5">
    <div><h1 className="text-xl font-bold">Solicitudes de equipos</h1><p className="mt-1 text-sm text-white/35">Revisa los cambios antes de incorporarlos a la competición.</p></div>
    {message && <p role="status" className="text-sm text-[#7dd3fc]">{message}</p>}
    <div className="flex gap-2 text-sm"><span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-200">{requests.filter(item => item.status === 'pending').length} pendientes</span><span className="rounded-full bg-white/5 px-3 py-1 text-white/40">{requests.length} totales</span></div>
    <div className="divide-y divide-white/8 border-y border-white/10">
      {requests.length === 0 && <p className="py-10 text-center text-sm text-white/35">No hay solicitudes.</p>}
      {requests.map(request => {
        const team = teams.find(item => item.id === request.teamId)
        const player = team?.players.find(item => item.id === request.playerId)
        const Icon = request.type === 'new_player' ? UserPlus : request.type === 'summoner_name' ? UserRoundPen : Clock3
        return <article key={request.id} className="grid gap-4 py-5 md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:items-center">
          <div className="size-10 rounded-lg bg-white/5 grid place-items-center text-[#33b3e8]"><Icon size={18} /></div>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{teamName(request.teamId)}</h2><span className={`text-xs ${request.status === 'pending' ? 'text-amber-300' : request.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>{request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span></div>
            {request.type === 'summoner_name' && <p className="mt-1 text-sm text-white/50"><span className="line-through text-white/25">{player?.summonerName ?? 'Jugador'}</span> <span className="mx-2">→</span> {String(request.payload.summonerName)}</p>}
            {request.type === 'new_player' && <p className="mt-1 text-sm text-white/50">{String(request.payload.summonerName)} · {String(request.payload.primaryRole)}{request.payload.secondaryRole ? ` / ${String(request.payload.secondaryRole)}` : ''}</p>}
            {request.type === 'team_logo' && typeof request.payload.logo === 'string' && <div className="mt-2 flex items-center gap-3">{team?.logo && <Image src={team.logo} alt="Logo actual" width={44} height={44} className="size-11 object-contain opacity-40" />}<span className="text-white/25">→</span><Image src={request.payload.logo} alt="Logo solicitado" width={56} height={56} className="size-14 object-contain rounded bg-white/5" /></div>}
            {request.rejectionReason && <p className="mt-1 text-xs text-red-300/70">{request.rejectionReason}</p>}
          </div>
          {request.status === 'pending' && <div className="flex gap-2"><button disabled={busy === request.id} onClick={() => void resolve(request, 'reject')} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/50 hover:text-red-300"><X size={15} className="inline mr-1" />Rechazar</button><button disabled={busy === request.id} onClick={() => void resolve(request, 'approve')} className="rounded-lg bg-[#0097D7] px-3 py-2 text-sm font-semibold"><Check size={15} className="inline mr-1" />Aprobar</button></div>}
        </article>
      })}
    </div>
  </div>
}
