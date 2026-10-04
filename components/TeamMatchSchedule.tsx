'use client'
import { useState } from 'react'
import DateTimePicker from '@/components/admin/DateTimePicker'
import type { TeamPendingMatch } from '@/lib/types'

export default function TeamMatchSchedule({ match, onSaved }: { match: TeamPendingMatch; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(match.scheduledAt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/team/matches/${match.id}/schedule`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: match.version, scheduledAt: date ?? null }),
      })
      if (response.status === 401 || response.status === 403) { window.location.assign('/equipo/login'); return }
      if (!response.ok) { setError((await response.json()).error ?? 'No se pudo guardar la fecha.'); return }
      await onSaved()
    } catch { setError('No se pudo confirmar el guardado. Comprueba tu conexión y actualiza la lista.') }
    finally { setSaving(false) }
  }

  return <form onSubmit={save} aria-label={`Partido contra ${match.opponentName}`} className="py-4">
    <fieldset disabled={saving} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium break-words">Contra {match.opponentName}</h3>
        <p className="mt-1 text-sm text-white/50">{match.phaseName} · {match.round === 98 ? 'Tercer puesto' : match.round === 99 ? 'Gran final' : match.round < 0 ? `Lower · Ronda ${Math.abs(match.round)}` : `Ronda ${match.round}`}</p>
      </div>
      <DateTimePicker value={date} onChange={setDate} label={`Fecha contra ${match.opponentName}`} className="w-full sm:w-72" />
      <button disabled={saving || date === match.scheduledAt} className="rounded-lg bg-[#0097D7] px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">{saving ? 'Guardando…' : 'Guardar fecha'}</button>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
  </form>
}
