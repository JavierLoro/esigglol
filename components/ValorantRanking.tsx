import { loadValorantRanking, valorantRank, visibleLadderPlayer } from '@/lib/valorant-ranking'
import type { Team, Tournament } from '@/lib/types'
import Image from 'next/image'

import { getValorantAssets, valorantAsset } from '@/lib/valorant-assets'

export default async function ValorantRanking({ tournament, teams }: { tournament: Tournament; teams: Team[] }) {
  const snapshot = await loadValorantRanking()
  const assets = getValorantAssets()
  const rows = teams.flatMap(team => team.players.map(player => ({ player, team, entry: visibleLadderPlayer(player.summonerName, snapshot) })))
    .sort((a, b) => {
      const aTier = valorantRank(a.entry?.competitiveTier) !== 'No disponible' ? a.entry!.competitiveTier! : -1
      const bTier = valorantRank(b.entry?.competitiveTier) !== 'No disponible' ? b.entry!.competitiveTier! : -1
      return bTier - aTier || (b.entry?.rankedRating ?? -1) - (a.entry?.rankedRating ?? -1)
    })
  const positions = rows.map((row, index) => {
    if (valorantRank(row.entry?.competitiveTier) === 'No disponible') return null
    return rows.findIndex(other => other.entry?.competitiveTier === row.entry?.competitiveTier && other.entry?.rankedRating === row.entry?.rankedRating) + 1 || index + 1
  })
  return <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
    <h1 className="text-2xl font-bold">Ranking · Valorant · {tournament.name}</h1>
    <p className="text-sm text-white/60">Participantes del torneo · PC · {snapshot.actName ?? 'Acto no disponible'}</p>
    <p className="text-sm text-white/60">Origen: Riot Games · Fecha de los datos: {snapshot.data ? new Date(snapshot.fetchedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'No disponible'}</p>
    {snapshot.availability !== 'available' && <p role="status">{snapshot.data ? 'Actualización no disponible. Se muestran los últimos datos obtenidos con su fecha.' : 'Clasificación oficial no disponible temporalmente.'}</p>}
    <p className="text-sm text-white/60">Posiciones del torneo según rango y RR oficiales del mismo acto. Los empates comparten posición. «No disponible» no significa «sin rango».</p>
    {snapshot.data && !snapshot.complete && <p role="status">Clasificación parcial: {snapshot.data.players.length} de {snapshot.data.totalPlayers} entradas disponibles.</p>}
    {rows.length === 0 ? <p>No hay participantes en este torneo.</p> : <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Participantes del torneo y datos disponibles en la clasificación del mismo acto</caption>
        <thead><tr>{['Posición', 'Jugador', 'Equipo', 'Rango', 'RR', 'Victorias'].map(label => <th key={label} scope="col" className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{rows.map(({ player, team, entry }, index) => {

          const rank = valorantAsset(assets, 'ranks', entry?.competitiveTier)
          return <tr key={player.id} className="border-t border-white/10">
          <td className="p-3">{positions[index] ?? '—'}</td><th scope="row" className="p-3 whitespace-nowrap"><span className="flex items-center gap-3">
            {team.logo ? <Image src={team.logo} alt={`Logo de ${team.name}`} width={40} height={40} unoptimized className="size-10 rounded object-contain" /> : <span className="size-10 rounded bg-white/5 flex items-center justify-center text-xs text-white/60" title={team.name}>{team.name.trim().split(/\s+/).map(word => Array.from(word)[0]).slice(0, 2).join('').toLocaleUpperCase('es-ES') || '—'}</span>}
            {player.summonerName}</span></th><td className="p-3">{team.name}</td>
          <td className="p-3 whitespace-nowrap"><span className="flex items-center gap-2">{rank && <Image src={rank.icon} alt="" width={36} height={36} unoptimized className="size-9 object-contain" />}{valorantRank(entry?.competitiveTier)}</span></td><td className="p-3">{entry?.rankedRating ?? 'No disponible'}</td><td className="p-3">{entry?.numberOfWins ?? 'No disponible'}</td>
        </tr>})}</tbody>
      </table>
    </div>}
  </div>
}
