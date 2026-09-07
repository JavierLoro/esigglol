'use client'

import { useState, useEffect } from 'react'
import type { TournamentConfig } from '@/lib/types'
import { Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'

interface TournamentStatusResponse {
  providerId?: number
  tournamentId?: number
  configured?: boolean
  callbackUrl?: string | null
  error?: string
}

function isTournamentConfig(data: TournamentStatusResponse): data is TournamentStatusResponse & TournamentConfig {
  return typeof data.providerId === 'number' && typeof data.tournamentId === 'number'
}

export default function TournamentSetup() {
  const [config, setConfig] = useState<TournamentConfig | null>(null)
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/tournament')
      const data = await res.json() as TournamentStatusResponse
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la configuración')

      setCallbackUrl(data.callbackUrl ?? null)
      setConfig(data.configured === true && isTournamentConfig(data)
        ? { providerId: data.providerId, tournamentId: data.tournamentId }
        : null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)

    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentName }),
      })
      const data = await res.json() as TournamentStatusResponse
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Error al registrar' })
      } else if (isTournamentConfig(data)) {
        setConfig({ providerId: data.providerId, tournamentId: data.tournamentId })
        setCallbackUrl(data.callbackUrl ?? callbackUrl)
        setMsg({ type: 'ok', text: 'Tournament registrado correctamente' })
      } else {
        setMsg({ type: 'error', text: 'La respuesta del servidor no es válida' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!window.confirm('¿Seguro que quieres resetear la configuración del torneo? Tendrás que registrarlo de nuevo.')) return

    setResetting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/tournament', { method: 'DELETE' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'No se pudo resetear la configuración' })
        return
      }

      setConfig(null)
      setMsg({ type: 'ok', text: 'Configuración del torneo reseteada' })
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="text-white/40 text-sm">Cargando configuración del torneo...</div>

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-[#0d1321] p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Tournament API</h2>
        <div className="flex items-center gap-2 text-red-400 text-sm" role="alert">
          <AlertCircle size={16} />
          <span>{loadError}</span>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm hover:border-[#0097D7]/50 transition-colors"
        >
          <RotateCcw size={14} />
          Reintentar
        </button>
      </div>
    )
  }

  if (config) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Tournament API</h2>
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle size={16} />
          <span>Configurado</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <span className="text-white/40">Provider ID</span>
          <span className="font-mono">{config.providerId}</span>
          <span className="text-white/40">Tournament ID</span>
          <span className="font-mono">{config.tournamentId}</span>
          <span className="text-white/40">Callback URL</span>
          <code className="font-mono text-xs text-white/70 truncate" title={callbackUrl ?? undefined}>
            {callbackUrl ?? 'No disponible'}
          </code>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`} role={msg.type === 'error' ? 'alert' : undefined}>
            {msg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {msg.text}
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={resetting}
          className="flex items-center justify-center gap-2 self-start rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
        >
          {resetting && <Loader2 size={14} className="animate-spin" />}
          {resetting ? 'Reseteando...' : 'Resetear configuración'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Tournament API</h2>
      <div className="flex items-center gap-2 text-white/50 text-sm">
        <AlertCircle size={16} />
        <span>Sin configurar</span>
      </div>
      {callbackUrl && (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-white/40">Callback URL</span>
          <code className="font-mono text-white/70 truncate" title={callbackUrl}>{callbackUrl}</code>
        </div>
      )}
      <p className="text-xs text-white/40">Registra un provider y tournament en Riot para generar códigos de partida. El callback se configura automáticamente.</p>

      <input
        type="text"
        placeholder="Nombre del torneo"
        value={tournamentName}
        onChange={e => setTournamentName(e.target.value)}
        required
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#0097D7]/50"
      />

      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`} role={msg.type === 'error' ? 'alert' : undefined}>
          {msg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-lg bg-[#0097D7] px-4 py-2 text-sm font-medium hover:bg-[#0097D7]/80 disabled:opacity-50 transition-colors"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saving ? 'Registrando...' : 'Registrar'}
      </button>
    </form>
  )
}
