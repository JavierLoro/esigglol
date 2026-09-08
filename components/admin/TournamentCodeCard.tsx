'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Loader2, RefreshCw, Users } from 'lucide-react'
import { adminRequest, errorMessage, isArrayOfRecords, isRecord } from '@/lib/admin-client'
import type { LobbyEvent, TournamentCodeDetails } from '@/lib/types'

interface TournamentCodeCardProps {
  code: string
  gameNumber: number
  onCopy: (code: string) => void
}

function isCodeDetails(value: unknown): value is TournamentCodeDetails {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.map === 'string'
    && typeof value.pickType === 'string'
}

function formatTimestamp(value: string): string {
  const numeric = Number(value)
  const date = new Date(Number.isFinite(numeric) ? numeric : value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function TournamentCodeCard({ code, gameNumber, onCopy }: TournamentCodeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<TournamentCodeDetails | null>(null)
  const [events, setEvents] = useState<LobbyEvent[]>([])
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [codeDetails, lobbyEvents] = await Promise.all([
        adminRequest<TournamentCodeDetails>(
          fetch(`/api/admin/partidos/codes?code=${encodeURIComponent(code)}`),
          isCodeDetails,
        ),
        adminRequest<LobbyEvent[]>(
          fetch(`/api/admin/partidos/lobby?code=${encodeURIComponent(code)}`),
          isArrayOfRecords,
        ),
      ])
      setDetails(codeDetails)
      setEvents(lobbyEvents)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !details && !loading) void load()
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={toggle} className="text-white/40 hover:text-white" aria-expanded={expanded}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="text-[11px] text-white/30 w-14 shrink-0">Game {gameNumber}</span>
        <code className="flex-1 min-w-0 truncate rounded-md bg-white/5 px-2 py-1 text-xs text-[#0097D7] font-mono select-all" title={code}>
          {code}
        </code>
        <button type="button" onClick={() => onCopy(code)} className="text-white/30 hover:text-[#0097D7]" title="Copiar código">
          <Copy size={13} />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-white/10 p-3 text-xs">
          {loading ? (
            <div className="flex items-center gap-2 text-white/40"><Loader2 size={13} className="animate-spin" />Consultando Riot...</div>
          ) : error ? (
            <div className="flex items-center justify-between gap-3 text-red-400" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="flex items-center gap-1 text-white/50 hover:text-white"><RefreshCw size={12} />Reintentar</button>
            </div>
          ) : details ? (
            <div className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <div><dt className="text-white/30">Mapa</dt><dd>{details.map}</dd></div>
                <div><dt className="text-white/30">Selección</dt><dd>{details.pickType}</dd></div>
                <div><dt className="text-white/30">Equipo</dt><dd>{details.teamSize} jugadores</dd></div>
                <div><dt className="text-white/30">Espectadores</dt><dd>{details.spectators ?? '—'}</dd></div>
              </dl>
              <div>
                <p className="mb-1 text-white/30">Metadata de control</p>
                <code className="block break-all rounded bg-white/5 p-2 font-mono text-[10px] text-white/60">{details.metaData || 'Sin metadata'}</code>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-white/50"><Users size={13} />Lobby · {events.length} eventos</div>
                {events.length > 0 ? (
                  <ol className="space-y-1 border-l border-white/10 pl-3">
                    {events.map((event, index) => (
                      <li key={`${event.timestamp}-${event.eventType}-${index}`}>
                        <span className="text-white/70">{event.eventType}</span>
                        <span className="ml-2 text-white/30">{formatTimestamp(event.timestamp)}</span>
                        {event.puuid ? <code className="ml-2 text-[10px] text-white/30">{event.puuid}</code> : null}
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-white/30">Sin actividad de lobby en el entorno stub.</p>}
              </div>
              <button type="button" onClick={() => void load()} className="flex items-center gap-1 self-start text-white/40 hover:text-white"><RefreshCw size={12} />Actualizar</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
