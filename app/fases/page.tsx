import { getPhases, getMatchesByPhase, getTeams } from '@/lib/data'
import GroupsView from '@/components/brackets/GroupsView'
import SwissView from '@/components/brackets/SwissView'
import EliminationBracket from '@/components/brackets/EliminationBracket'
import UpperLowerBracket from '@/components/brackets/UpperLowerBracket'
import { clsx } from 'clsx'

export const revalidate = 60

const statusLabel: Record<string, string> = {
  upcoming: 'Próximamente',
  active: 'En curso',
  completed: 'Finalizado',
}

const statusColor: Record<string, string> = {
  upcoming: 'text-white/40 bg-white/5',
  active: 'text-green-400 bg-green-400/10',
  completed: 'text-white/30 bg-white/5',
}

export default function FasesPage() {
  const phases = getPhases()
  const teams = getTeams()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-10">
      <h1 className="text-2xl font-bold">Fases del torneo</h1>

      {phases.length === 0 && (
        <p className="text-white/40 text-sm">El torneo aún no tiene fases configuradas.</p>
      )}

      {phases.map(phase => {
        const matches = getMatchesByPhase(phase.id)

        return (
          <section key={phase.id} className={clsx(phase.status === 'completed' && 'opacity-60')}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">{phase.name}</h2>
              <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', statusColor[phase.status])}>
                {statusLabel[phase.status]}
              </span>
              {phase.type !== 'swiss' && (
                <span className="text-xs text-white/30 ml-auto">BO{phase.config.bo}</span>
              )}
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
          </section>
        )
      })}
    </div>
  )
}
