import { notFound } from 'next/navigation'
import { getPhaseById, getMatchesByPhase, getTeams } from '@/lib/data'
import GroupsView from '@/components/brackets/GroupsView'
import SwissView from '@/components/brackets/SwissView'
import EliminationBracket from '@/components/brackets/EliminationBracket'
import UpperLowerBracket from '@/components/brackets/UpperLowerBracket'
import AutoRefresh from '@/components/overlay/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function OverlayFasePage({ params }: { params: Promise<{ phaseId: string }> }) {
  const { phaseId } = await params
  const phase = getPhaseById(phaseId)
  if (!phase) notFound()

  const matches = getMatchesByPhase(phase.id)
  const teams = getTeams()

  return (
    <div className="p-4">
      <AutoRefresh interval={30} />

      {phase.type === 'groups' && (
        <GroupsView phase={phase} matches={matches} teams={teams} />
      )}
      {phase.type === 'swiss' && (
        <SwissView phase={phase} matches={matches} teams={teams} />
      )}
      {phase.type === 'elimination' && (
        <EliminationBracket matches={matches} teams={teams} />
      )}
      {phase.type === 'final-four' && (
        <div className="flex flex-col gap-6">
          <EliminationBracket matches={matches.filter(m => m.round !== 98)} teams={teams} />
          {matches.some(m => m.round === 98) && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">3er / 4to puesto</p>
              <EliminationBracket matches={matches.filter(m => m.round === 98)} teams={teams} />
            </div>
          )}
        </div>
      )}
      {phase.type === 'upper-lower' && (
        <UpperLowerBracket matches={matches} teams={teams} />
      )}
    </div>
  )
}
