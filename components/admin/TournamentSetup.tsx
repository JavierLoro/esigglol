'use client'
import { useState, useEffect } from 'react'
import type { TournamentConfig } from '@/lib/types'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function TournamentSetup() {
  const [config, setConfig] = useState<TournamentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/tournament')
      .then(r => r.json())
      .then(data => { setConfig(data); setLoading(false) })
      .catch(() => setLoading(false))
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
      const data = await res.json()
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Error al registrar' })
      } else {
        setConfig(data)
        setMsg({ type: 'ok', text: 'Tournament registrado correctamente' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexion' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-white/40 text-sm">Cargando config tournament...</div>

  if (config) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Tournament API</h2>
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle size={16} />
          <span>Configurado</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-white/40">Provider ID</span>
          <span className="font-mono">{config.providerId}</span>
          <span className="text-white/40">Tournament ID</span>
          <span className="font-mono">{config.tournamentId}</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Tournament API</h2>
      <p className="text-xs text-white/40">Registra un provider y tournament en Riot para generar codes de partida. El callback se configura automaticamente.</p>

      <input
        type="text"
        placeholder="Nombre del torneo"
        value={tournamentName}
        onChange={e => setTournamentName(e.target.value)}
        required
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#0097D7]/50"
      />

      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
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
        Registrar
      </button>
    </form>
  )
}
