'use client'

import { useState } from 'react'

export default function TeamLogo({ name, logo, hidden = false }: { name: string; logo?: string; hidden?: boolean }) {
  const [failed, setFailed] = useState<string>()
  return <span className="obs-logo" data-obs-hidden={hidden || undefined}>
    {logo && failed !== logo
      // OBS uses the original uploaded asset, without an image optimizer round trip.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={logo} alt="" onError={() => setFailed(logo)} />
      : <span aria-hidden="true">{name === 'Por determinar' ? '?' : name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>}
  </span>
}
