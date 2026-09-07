'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface RiotResultEvent {
  matchId: string
  gameId: string
}

export default function RiotResultNotifications() {
  const router = useRouter()
  const [notification, setNotification] = useState<RiotResultEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return
    const source = new EventSource('/api/admin/riot-events')
    const onResult = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as RiotResultEvent
        setNotification(event)
        router.refresh()
        window.setTimeout(() => setNotification(current => current === event ? null : current), 6000)
      } catch { /* ignore malformed events */ }
    }
    source.addEventListener('riot-result', onResult)
    return () => {
      source.removeEventListener('riot-result', onResult)
      source.close()
    }
  }, [router])

  if (!notification) return null
  return (
    <div role="status" className="fixed right-4 top-20 z-50 max-w-sm rounded-xl border border-green-500/40 bg-[#0d1321] px-4 py-3 text-sm text-green-300 shadow-xl">
      Resultado de Riot procesado (partido {notification.matchId}, juego {notification.gameId}).
    </div>
  )
}
