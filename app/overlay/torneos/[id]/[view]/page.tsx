import { notFound } from 'next/navigation'
import { publicTournament, inTournament } from '@/lib/public-competition'
import { getMatches, getPhases, getTeams } from '@/lib/data'
import { getOverlayConfig } from '@/lib/overlay-data'
import OverlayScene from '@/components/overlay/OverlayScene'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string; view: string }> }) {
  const { id, view } = await params
  if (view !== 'marcador' && view !== 'previa' && view !== 'fase') notFound()
  const tournament = publicTournament({ tournament: id })
  return inTournament(id, () => <OverlayScene kind={view} tournament={tournament} config={getOverlayConfig()} phases={getPhases()} matches={getMatches()} teams={getTeams()} />)
}
