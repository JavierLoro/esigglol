'use client'
import { useState } from 'react'

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/

export default function TwitchEmbed({ channel }: { channel: string }) {
  const [parent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const h = window.location.hostname
    if (IP_RE.test(h)) return null
    return h === '127.0.0.1' ? 'localhost' : h
  })

  if (!channel || !parent) return null

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
      <iframe
        src={`https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&autoplay=false`}
        allow="autoplay; fullscreen"
        allowFullScreen
        className="w-full h-full"
        title={`${channel} en Twitch`}
      />
    </div>
  )
}
