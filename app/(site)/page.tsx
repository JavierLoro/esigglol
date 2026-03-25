import TwitchEmbed from '@/components/TwitchEmbed'
import MatchCard from '@/components/MatchCard'
import { getMatches, getTeams, getPhases } from '@/lib/data'
import { TWITCH_CHANNEL } from '@/lib/env'

export const dynamic = 'force-dynamic'

function currentTimestamp() { return Date.now() }

export default function HomePage() {
  const teams = getTeams()
  const matches = getMatches()
  const phases = getPhases()

  const now = currentTimestamp()
  const sortedMatches = [...matches].sort((a, b) => {
    const aPlayed = !!a.result
    const bPlayed = !!b.result
    const aDate = a.scheduledAt ? new Date(a.scheduledAt).getTime() : null
    const bDate = b.scheduledAt ? new Date(b.scheduledAt).getTime() : null

    // Grupo 0: pendientes con fecha (más próxima primero)
    // Grupo 1: pendientes sin fecha
    // Grupo 2: jugados (más reciente primero)
    const group = (played: boolean, date: number | null) => {
      if (!played && date !== null) return 0
      if (!played && date === null) return 1
      return 2
    }
    const ga = group(aPlayed, aDate)
    const gb = group(bPlayed, bDate)
    if (ga !== gb) return ga - gb

    if (ga === 0) {
      // Ambos pendientes con fecha: más próximo primero
      return aDate! - bDate!
    }
    if (ga === 2) {
      // Ambos jugados: el más reciente primero (menor distancia al presente)
      return bDate !== null && aDate !== null
        ? Math.abs(aDate - now) - Math.abs(bDate - now)
        : 0
    }
    return 0
  })

  const channel = TWITCH_CHANNEL

  return (
    <div className="flex flex-col">
      {/* Hero banner */}
      <div className="border-b border-white/8 bg-gradient-to-b from-[#0097D7]/8 to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[#0097D7]">ESI Ciudad Real</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-xs text-white/40 uppercase tracking-widest">Torneo LoL</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Liga ESIgg.lol</h1>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#B30133] animate-pulse" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">En directo</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8 w-full">
        <section>
          <TwitchEmbed channel={channel} />
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">Partidos</h2>
            <div className="flex-1 h-px bg-white/8" />
          </div>
          {sortedMatches.length === 0 ? (
            <p className="text-white/40 text-sm">No hay partidos programados todavía.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teams={teams}
                  phase={phases.find(p => p.id === match.phaseId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
