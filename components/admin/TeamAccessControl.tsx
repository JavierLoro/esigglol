'use client'
import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'

interface AccessData { configured: boolean; password?: string; enabled?: boolean; lastLoginAt?: string }

export default function TeamAccessControl({ teamId }: { teamId: string }) {
  const [access, setAccess] = useState<AccessData | null>(null)
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    const response = await fetch(`/api/admin/equipos/${teamId}/access`, { cache: 'no-store' })
    if (response.ok) setAccess(await response.json())
    setBusy(false)
  }
  async function generate() {
    if (access?.configured && !confirm('La contraseña anterior dejará de funcionar. ¿Continuar?')) return
    setBusy(true)
    const response = await fetch(`/api/admin/equipos/${teamId}/access`, { method: 'POST' })
    if (response.ok) { setAccess(await response.json()); setVisible(true) }
    setBusy(false)
  }
  async function toggle() {
    if (!access?.configured) return
    const response = await fetch(`/api/admin/equipos/${teamId}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !access.enabled }) })
    if (response.ok) setAccess(current => current ? { ...current, enabled: !current.enabled } : current)
  }
  async function copy() {
    if (!access?.password) return
    await navigator.clipboard.writeText(`Equipo: ${teamId}\nContraseña: ${access.password}\nAcceso: ${window.location.origin}/equipo/login`)
    setCopied(true); window.setTimeout(() => setCopied(false), 2000)
  }

  if (!access) return <button onClick={load} disabled={busy} className="text-xs text-[#33b3e8] hover:text-white"><KeyRound size={13} className="inline mr-1" />{busy ? 'Cargando…' : 'Gestionar acceso'}</button>
  if (!access.configured) return <button onClick={generate} disabled={busy} className="rounded-lg border border-[#0097D7]/30 px-3 py-1.5 text-xs text-[#33b3e8]">Generar acceso</button>
  return <div className="rounded-lg border border-white/8 bg-black/15 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <KeyRound size={14} className="text-[#33b3e8]" />
      <code className="min-w-40 text-sm text-white/75">{visible ? access.password : '••••••••••••••••'}</code>
      <button onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="p-1 text-white/40 hover:text-white">{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      <button onClick={copy} aria-label="Copiar credenciales" className="p-1 text-white/40 hover:text-white">{copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}</button>
      <button onClick={generate} aria-label="Regenerar contraseña" className="p-1 text-white/40 hover:text-white"><RefreshCw size={15} /></button>
      <button onClick={toggle} className={`ml-auto rounded-full px-2.5 py-1 text-xs ${access.enabled ? 'bg-green-400/10 text-green-300' : 'bg-red-400/10 text-red-300'}`}>{access.enabled ? 'Acceso activo' : 'Acceso desactivado'}</button>
    </div>
    {access.lastLoginAt && <p className="mt-2 text-xs text-white/25">Último acceso: {new Date(access.lastLoginAt).toLocaleString()}</p>}
  </div>
}
