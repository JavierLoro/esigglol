'use client'
import { useEffect, useState } from 'react'

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/

export default function TwitchEmbed({ channel }: { channel: string; onLiveChange?: (live: boolean) => void }) {
  const [parent, setParent] = useState<string | null>(null)

  useEffect(() => {
    const h = window.location.hostname
    if (IP_RE.test(h)) return
    setParent(h === '127.0.0.1' ? 'localhost' : h)
  }, [])

  if (!channel || !parent) return null

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
      <iframe
        src={`https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false`}
        allow="autoplay; fullscreen"
        className="w-full h-full"
        title={`${channel} en Twitch`}
      />
    </div>
  )
}
