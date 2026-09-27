import { publicEntityTournament, inTournament } from '@/lib/public-competition'
import CompetitionBadge from '@/components/CompetitionBadge'
import { notFound } from 'next/navigation'
import { getPhaseById, getMatchesByPhase, getTeams } from '@/lib/data'
import GroupsView from '@/components/brackets/GroupsView'
import SwissView from '@/components/brackets/SwissView'
import EliminationBracket from '@/components/brackets/EliminationBracket'
import UpperLowerBracket from '@/components/brackets/UpperLowerBracket'
import { getPublishedMatches, isPhasePublished } from '@/lib/publication'

export const dynamic = 'force-dynamic'

async function OverlayFasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const phase = getPhaseById(id)
  if (!phase) notFound()
  if (!isPhasePublished(phase)) notFound()

  const matches = getPublishedMatches([phase], getMatchesByPhase(id))
  const teams = getTeams()

  return (
    <div className="p-6">
      {phase.type === 'groups' && (
        <GroupsView phase={phase} matches={matches} teams={teams} />
      )}
      {phase.type === 'swiss' && (
        <SwissView phase={phase} matches={matches} teams={teams} />
      )}
      {phase.type === 'elimination' && (
        <EliminationBracket matches={matches} teams={teams} teamCount={phase.config.bracketTeamIds?.length} />
      )}
      {phase.type === 'final-four' && (
        <>
          <EliminationBracket matches={matches.filter(m => m.round !== 98)} teams={teams} teamCount={4} />
          {matches.some(m => m.round === 98) && (
            <div className="mt-6">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">3er / 4to puesto</p>
              <EliminationBracket matches={matches.filter(m => m.round === 98)} teams={teams} />
            </div>
          )}
        </>
      )}
      {phase.type === 'upper-lower' && (
        <UpperLowerBracket matches={matches} teams={teams} />
      )}
    </div>
  )
}

export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tournament?: string }> }) {
  const { id } = await props.params
  const tournament = publicEntityTournament('phases', id)
  const search = await props.searchParams
  if (search.tournament && search.tournament !== tournament.id) notFound()
  const content = await inTournament(tournament.id, () => OverlayFasePage(props))
  return <><div className="px-6 pt-4"><CompetitionBadge game={tournament.game} name={tournament.name} /></div>{content}</>
}
