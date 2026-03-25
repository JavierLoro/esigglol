'use client'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

interface Props {
  channel: string
  onLiveChange?: (live: boolean) => void
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/
const EMBED_ID = 'twitch-embed-root'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySDK = any

export default function TwitchEmbed({ channel, onLiveChange }: Props) {
  // Default true: show embed immediately; OFFLINE event hides it if channel is not live.
  // Twitch.Player.ONLINE only fires on transitions, not on initial load when already live.
  const [isLive, setIsLive] = useState(true)
  const onLiveChangeRef = useRef(onLiveChange)
  useEffect(() => { onLiveChangeRef.current = onLiveChange }, [onLiveChange])

  useEffect(() => {
    if (!channel) return

    const hostname = window.location.hostname
    if (IP_RE.test(hostname)) return

    const parent = hostname === '127.0.0.1' ? 'localhost' : hostname

    function initEmbed() {
      const Twitch: AnySDK = (window as AnySDK).Twitch
      const embed = new Twitch.Embed(EMBED_ID, {
        width: '100%',
        height: '100%',
        channel,
        parent: [parent],
        autoplay: false,
        layout: 'video',
      })

      embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
        const player = embed.getPlayer()
        player.addEventListener(Twitch.Player.ONLINE, () => {
          setIsLive(true)
          onLiveChangeRef.current?.(true)
        })
        player.addEventListener(Twitch.Player.OFFLINE, () => {
          setIsLive(false)
          onLiveChangeRef.current?.(false)
        })
      })
    }

    const tw = (window as AnySDK).Twitch
    if (tw?.Embed) {
      initEmbed()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://embed.twitch.tv/embed/v1.js'
    script.onload = initEmbed
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [channel])

  if (!channel) return null

  return (
    <div
      id={EMBED_ID}
      className={clsx(
        'w-full rounded-xl overflow-hidden border border-white/10 bg-black',
        isLive ? 'aspect-video' : 'h-0 overflow-hidden border-0'
      )}
    />
  )
}
