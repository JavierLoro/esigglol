import { notFound } from 'next/navigation'
import { publicEntityTournament, inTournament } from '@/lib/public-competition'
import { getMatches, getPhases, getTeams } from '@/lib/data'
import { getPublishedMatch } from '@/lib/publication'
import OverlayScene from '@/components/overlay/OverlayScene'
import { getOverlayConfig } from '@/lib/overlay-data'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tournament?: string }> }) {
  const { id } = await params
  const tournament = publicEntityTournament('matches', id)
  const search = await searchParams
  if (search.tournament && search.tournament !== tournament.id) notFound()
  return inTournament(tournament.id, () => {
    const phases = getPhases(), matches = getMatches()
    if (!getPublishedMatch(id, phases, matches)) notFound()
    return <OverlayScene kind="previa" tournament={tournament} config={{ ...getOverlayConfig(), matchId: id, summary: null }} phases={phases} matches={matches} teams={getTeams()} />
  })
}
