import type { Match, Team } from '@/lib/types'
import EliminationBracket from './EliminationBracket'

interface Props {
  matches: Match[]
  teams: Team[]
}

// Convention: round > 0 = upper bracket, round < 0 = lower bracket, round = 99 = grand final
export default function UpperLowerBracket({ matches, teams }: Props) {
  const upperMatches = matches.filter(m => m.round > 0 && m.round !== 99)
  const lowerMatches = matches
    .filter(m => m.round < 0)
    .map(m => ({ ...m, round: Math.abs(m.round) }))
  const grandFinal = matches.filter(m => m.round === 99)

  return (
    <div className="flex flex-col gap-8">
      {upperMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0097D7]">Upper Bracket</span>
            <div className="flex-1 border-t border-[#0097D7]/20" />
          </div>
          <EliminationBracket matches={upperMatches} teams={teams} />
        </div>
      )}

      {lowerMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Lower Bracket</span>
            <div className="flex-1 border-t border-orange-400/20" />
          </div>
          <EliminationBracket matches={lowerMatches} teams={teams} />
        </div>
      )}

      {grandFinal.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Gran Final</span>
            <div className="flex-1 border-t border-yellow-400/20" />
          </div>
          <EliminationBracket matches={grandFinal} teams={teams} />
        </div>
      )}
    </div>
  )
}
