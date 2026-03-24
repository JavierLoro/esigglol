'use client'
import { useState } from 'react'

interface Props {
  channel: string
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/

export default function TwitchEmbed({ channel }: Props) {
  const [src] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const hostname = window.location.hostname
    if (IP_RE.test(hostname)) return null
    const parent = hostname === '127.0.0.1' ? 'localhost' : hostname
    return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=false`
  })

  if (!channel) return null

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
      {src ? (
        <iframe
          src={src}
          width="100%"
          height="100%"
          allowFullScreen
          className="w-full h-full"
        />
      ) : (
        <p className="text-white/30 text-sm">
          El stream no está disponible desde una dirección IP.
        </p>
      )}
    </div>
  )
}
