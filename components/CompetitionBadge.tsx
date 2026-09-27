import { Swords, Crosshair } from 'lucide-react'
import type { Game } from '@/lib/types'
export default function CompetitionBadge({ game, name }: { game?: Game; name?: string }) {
  const valorant = game === 'valorant'
  const Icon = valorant ? Crosshair : Swords
  return <span className={`inline-flex items-center gap-2 text-xs font-semibold ${valorant ? 'text-rose-300' : 'text-sky-300'}`}><Icon size={14} aria-hidden="true" />{valorant ? 'Valorant' : 'LoL'} · {name ?? 'Torneo LoL'}</span>
}
