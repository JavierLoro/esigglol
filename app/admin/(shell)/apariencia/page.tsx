'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { SiteBranding } from '@/lib/site-branding'

export default function AppearancePage() {
  const [value, setValue] = useState<SiteBranding | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/admin/apariencia').then(r => { if (!r.ok) throw new Error(); return r.json() }).then(setValue).catch(() => setMessage('No se pudo cargar el banner. Recarga la página.'))
  }, [])
  return <div className="max-w-2xl space-y-6"><h1 className="text-2xl font-bold">Apariencia de Inicio</h1>
    <p className="text-white/60">Título, subtítulo, logo y canal de Twitch de la portada, comunes a todos los juegos y torneos.</p>
    <p role="status">{message}</p>
    {value && <form className="space-y-5" onSubmit={async event => {
      event.preventDefault()
      const form = event.currentTarget
      setBusy(true); setMessage('')
      try {
        const response = await fetch('/api/admin/apariencia', { method: 'POST', body: new FormData(form) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar')
        setValue(data); setMessage('Banner guardado. Ya se muestra en Inicio.')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo conectar') }
      finally { setBusy(false) }
    }}>
      <label className="block">Título<textarea name="title" required maxLength={150} defaultValue={value.title} className="mt-2 block w-full rounded border border-white/20 p-3" rows={3} /><span className="text-xs text-white/50">Puedes usar saltos de línea.</span></label>
      <label className="block">Subtítulo · «ESI Ciudad Real · Torneo LoL»<input name="subtitle" maxLength={150} defaultValue={value.subtitle} className="mt-2 block w-full rounded border border-white/20 p-3" /></label>
      <label className="block">Canal de Twitch<input name="channel" maxLength={25} pattern="[A-Za-z0-9_]*" defaultValue={value.channel} placeholder="Nombre del canal, sin URL" className="mt-2 block w-full rounded border border-white/20 p-3" /><span className="text-xs text-white/50">Déjalo vacío para ocultar Twitch en Inicio.</span></label>
      <label className="block">Logo · PNG, JPG o WebP, hasta 2 MB<input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full" /></label>
      <Image src={value.logo} alt="Logo actual del banner" width={100} height={100} unoptimized className="object-contain" />
      <button disabled={busy} className="rounded bg-sky-700 px-4 py-2 disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar banner'}</button>
    </form>}
  </div>
}
