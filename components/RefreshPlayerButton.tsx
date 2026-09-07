'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

interface Props {
  summonerName: string
}

const POLL_INTERVAL = 1_500

export default function RefreshPlayerButton({ summonerName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function pollUntilDone(): Promise<void> {
    if (cancelledRef.current) return

    try {
      const res = await fetch('/api/riot/refresh-stats', { cache: 'no-store' })
      const data = await res.json() as { running?: boolean; keyExpired?: boolean }
      if (cancelledRef.current) return

      if (data.keyExpired) {
        setLoading(false)
        setError('La API key ha caducado.')
        return
      }

      if (!data.running) {
        setLoading(false)
        router.refresh()
        return
      }

      timerRef.current = setTimeout(() => { void pollUntilDone() }, POLL_INTERVAL)
    } catch {
      if (!cancelledRef.current) {
        setLoading(false)
        setError('Error de conexión')
      }
    }
  }

  async function handleRefresh() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/riot/refresh-stats/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summonerName }),
      })
      const data = await res.json() as { status?: string; error?: string; message?: string }

      if (!res.ok) {
        setLoading(false)
        setError(data.error ?? data.message ?? 'No se pudo iniciar la actualización')
        return
      }

      // Give Next's `after()` callback a chance to set the shared running flag.
      timerRef.current = setTimeout(() => { void pollUntilDone() }, 300)
    } catch {
      setLoading(false)
      setError('Error de conexión')
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        title="Actualizar stats de este jugador"
        aria-label={`Actualizar stats de ${summonerName}`}
        className="p-1.5 rounded text-white/35 hover:text-[#0097D7] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
      {error && <span className="text-[10px] text-yellow-400 whitespace-nowrap">{error}</span>}
    </div>
  )
}
