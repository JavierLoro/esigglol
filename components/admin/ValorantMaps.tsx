'use client'
import type { ValorantMapResult } from '@/lib/types'
export default function ValorantMaps({ maps, bo, onChange }: { maps: ValorantMapResult[]; bo: number; onChange: (maps: ValorantMapResult[]) => void }) {
  return <fieldset className="space-y-3"><legend>Detalle por mapa (rondas ganadas, opcional)</legend>{maps.map((map, index) => <div key={index} className="flex flex-wrap gap-2">
    <input aria-label={`Nombre del mapa ${index + 1}`} placeholder={`Mapa ${index + 1}`} value={map.map ?? ''} onChange={e => onChange(maps.map((m, i) => i === index ? { ...m, map: e.target.value } : m))} className="border rounded p-2 max-w-40" />
    {(['team1Rounds', 'team2Rounds'] as const).map((key, team) => <label key={key}>Equipo {team + 1}<input aria-label={`Rondas equipo ${team + 1} mapa ${index + 1}`} type="number" min={0} value={map[key]} onChange={e => onChange(maps.map((m, i) => i === index ? { ...m, [key]: Number(e.target.value) } : m))} className="border rounded p-2 w-20 ml-2" /></label>)}
    <button type="button" onClick={() => onChange(maps.filter((_, i) => i !== index))}>Quitar mapa {index + 1}</button>
  </div>)}{maps.length < bo && <button type="button" className="rounded bg-white/10 p-2" onClick={() => onChange([...maps, { team1Rounds: 13, team2Rounds: 0 }])}>Añadir mapa</button>}</fieldset>
}
