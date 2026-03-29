'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  lastUpdated: string | null
  isAdmin: boolean
  teamIds?: string[]
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'hace menos de 1 min'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

const POLL_INTERVAL = 15_000 // cada 15s

export default function RefreshStatsButton({ lastUpdated, isAdmin, teamIds }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function pollUntilDone(previousLastUpdated: string | null) {
    const check = async (): Promise<void> => {
      try {
        const res = await fetch('/api/riot/refresh-stats')
        const data = await res.json() as { lastUpdated: string | null; running: boolean; keyExpired: boolean }

        if (data.keyExpired) {
          setLoading(false)
          setError('La API key ha caducado. Actualízala en el panel de administración.')
          return
        }

        if (data.lastUpdated !== previousLastUpdated) {
          setLoading(false)
          router.refresh()
          return
        }

        if (data.running) {
          setTimeout(check, POLL_INTERVAL)
        } else {
          setLoading(false)
          setError('No se pudieron cargar los datos. Inténtalo de nuevo en unos minutos.')
        }
      } catch {
        setLoading(false)
        setError('Error de conexión. Inténtalo de nuevo.')
      }
    }

    setTimeout(check, POLL_INTERVAL)
  }

  useEffect(() => {
    fetch('/api/riot/refresh-stats')
      .then(r => r.json())
      .then((data: { running: boolean; lastUpdated: string | null; keyExpired: boolean }) => {
        if (data.running) {
          setLoading(true)
          pollUntilDone(lastUpdated)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/riot/refresh-stats', {
        method: 'POST',
        headers: teamIds ? { 'Content-Type': 'application/json' } : undefined,
        body: teamIds ? JSON.stringify({ teamIds }) : undefined,
      })
      const data = await res.json() as { status?: string; error?: string; message?: string }

      if (res.status === 429 || data.error) {
        setError(data.error ?? 'Error desconocido')
        setLoading(false)
        return
      }

      if (data.status === 'running') {
        await pollUntilDone(lastUpdated)
        return
      }

      await pollUntilDone(lastUpdated)
    } catch {
      setError('Error de red')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col sm:items-end gap-1">
      {isAdmin && (
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#0097D7] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007ab5] transition-colors"
        >
          {loading ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      )}
      {loading && (
        <span className="text-xs text-white/30">Procesando en background — puede tardar varios minutos</span>
      )}
      {!loading && lastUpdated && (
        <span className="text-xs text-white/30">Actualizado {timeAgo(lastUpdated)}</span>
      )}
      {!loading && error && (
        <span className="text-xs text-yellow-400">{error}</span>
      )}
    </div>
  )
}
