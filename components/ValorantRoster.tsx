import { rosterDetails } from '@/lib/game-details'
import type { Player } from '@/lib/types'

export default function ValorantRoster({ players }: { players: Player[] }) {
  return players.map(player => {
    const details = rosterDetails(player, 'valorant')
    if (details.game !== 'valorant') return null
    return <p key={player.id}>{details.riotId} · {details.status === 'substitute' ? 'Suplente' : 'Titular'} · {details.role ?? 'Sin rol'}</p>
  })
}
