'use client'
import { useState, useEffect } from 'react'
import { Key, Save, CheckCircle, XCircle } from 'lucide-react'

export default function RiotApiKeySettings() {
  const [maskedKey, setMaskedKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: { riotApiKey: string; hasKey: boolean }) => {
        setMaskedKey(d.riotApiKey)
        setHasKey(d.hasKey)
      })
  }, [])

  function notify(text: string, ok: boolean) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleSave() {
    if (!newKey.startsWith('RGAPI-')) {
      notify('La key debe empezar con RGAPI-', false)
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riotApiKey: newKey }),
    })
    const data = await res.json() as { riotApiKey?: string; hasKey?: boolean; error?: string }
    setSaving(false)
    if (res.ok && data.riotApiKey) {
      setMaskedKey(data.riotApiKey)
      setHasKey(true)
      setNewKey('')
      setEditing(false)
      notify('API key actualizada', true)
    } else {
      notify(data.error ?? 'Error al guardar', false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Key size={18} className="text-[#0097D7]" />
        <h2 className="font-bold text-sm">Riot API Key</h2>
        {msg && (
          <span className={`ml-auto text-xs flex items-center gap-1 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {msg.text}
          </span>
        )}
      </div>

      {!editing ? (
        <div className="flex items-center gap-3">
          <code className="text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-lg flex-1 truncate">
            {hasKey ? maskedKey : 'No configurada'}
          </code>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:border-[#0097D7]/50 transition-colors"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#0097D7]/50"
          />
          <button
            onClick={handleSave}
            disabled={saving || !newKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0097D7] text-white text-sm font-bold hover:bg-[#33b3e8] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={() => { setEditing(false); setNewKey('') }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
