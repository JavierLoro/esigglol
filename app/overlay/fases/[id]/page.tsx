import { notFound } from 'next/navigation'
import { getPhaseById, getMatchesByPhase, getTeams } from '@/lib/data'
import GroupsView from '@/components/brackets/GroupsView'
import SwissView from '@/components/brackets/SwissView'
import EliminationBracket from '@/components/brackets/EliminationBracket'
import UpperLowerBracket from '@/components/brackets/UpperLowerBracket'

export const dynamic = 'force-dynamic'

export default async function OverlayFasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const phase = getPhaseById(id)
  if (!phase) notFound()

  const matches = getMatchesByPhase(id)
  const teams = getTeams()

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{phase.name}</h1>
        <span className="text-xs text-white/30">BO{phase.config.bo}</span>
      </div>

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
