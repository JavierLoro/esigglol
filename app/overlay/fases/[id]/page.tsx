import { notFound } from 'next/navigation'
import { publicEntityTournament, inTournament } from '@/lib/public-competition'
import { getMatches, getPhases, getTeams } from '@/lib/data'
import { isPhasePublished } from '@/lib/publication'
import { overlaySections } from '@/lib/overlay'
import OverlayScene from '@/components/overlay/OverlayScene'
import { getOverlayConfig } from '@/lib/overlay-data'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tournament?: string; section?: string; page?: string }> }) {
  const { id } = await params
  const tournament = publicEntityTournament('phases', id)
  const search = await searchParams
  if (search.tournament && search.tournament !== tournament.id) notFound()
  return inTournament(tournament.id, () => {
    const phases = getPhases(), matches = getMatches()
    const phase = phases.find(p => p.id === id)
    if (!phase || !isPhasePublished(phase)) notFound()
    const section = search.section ?? overlaySections(phase, matches)[0]?.id ?? ''
    return <OverlayScene kind="fase" tournament={tournament} config={{ ...getOverlayConfig(), matchId: null, summary: { phaseId: id, section, page: Number(search.page ?? 1) } }} phases={phases} matches={matches} teams={getTeams()} />
  })
}
