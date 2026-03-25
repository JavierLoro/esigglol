'use client'
import { useState } from 'react'
import Image from 'next/image'
import TwitchEmbed from './TwitchEmbed'

interface Props {
  channel: string
}

export default function LiveSection({ channel }: Props) {
  // Default true: show embed immediately; TwitchEmbed fires OFFLINE if not live.
  const [isLive, setIsLive] = useState<boolean | null>(true)

  return (
    <>
      {/* Hero épico */}
      <div className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,151,215,0.10),transparent)]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-32 bg-[#B30133]/6 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#0097D7]/70 mb-4">
            ESI Ciudad Real &nbsp;·&nbsp; Torneo LoL
          </p>
          <div className="flex items-center justify-center gap-5 sm:gap-8">
            <Image
              src="/logo-torneo.png"
              alt="Logo torneo"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-contain opacity-90 drop-shadow-[0_0_20px_rgba(0,151,215,0.4)]"
              unoptimized
            />
            <h1
              className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white leading-[1.05] text-center"
              style={{ textShadow: '0 0 60px rgba(0,151,215,0.3)' }}
            >
              I Copa Intercampus
              <br />
              <span className="text-[#0097D7]">UCLM</span>
            </h1>
            <Image
              src="/logo-torneo.png"
              alt="Logo torneo"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-contain opacity-90 drop-shadow-[0_0_20px_rgba(0,151,215,0.4)] scale-x-[-1]"
              unoptimized
            />
          </div>
          <div className="mt-5 h-px w-40 mx-auto bg-gradient-to-r from-transparent via-[#0097D7]/50 to-transparent" />

          {isLive && (
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#B30133]/15 border border-[#B30133]/30">
              <span className="h-2 w-2 rounded-full bg-[#B30133] animate-pulse" />
              <span className="text-xs font-bold text-[#B30133]/90 uppercase tracking-[0.2em]">En directo</span>
            </div>
          )}
        </div>
      </div>

      {/* Embed — el propio TwitchEmbed se oculta cuando el canal está offline */}
      {channel && (
        <section className={isLive ? 'max-w-7xl mx-auto px-4 pt-8 w-full' : 'h-0 overflow-hidden'}>
          <TwitchEmbed channel={channel} onLiveChange={setIsLive} />
        </section>
      )}
    </>
  )
}
