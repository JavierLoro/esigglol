import LiveSection from '@/components/LiveSection'
import HomeFilters from '@/components/HomeFilters'
import { getSiteBranding } from '@/lib/site-branding'
import MatchCard from '@/components/MatchCard'
import { getMatches, getTeams, getPhases } from '@/lib/data'
import { getTournaments } from '@/lib/competitions'
import { inTournament } from '@/lib/competition-context'
import { TWITCH_CHANNEL } from '@/lib/env'
import { getPublishedTournamentData } from '@/lib/publication'
import type { CompetitionSearch } from '@/lib/public-competition'
export const dynamic = 'force-dynamic'
export default async function HomePage({ searchParams }: { searchParams: Promise<CompetitionSearch> }) {
  const search = await searchParams
  const publishedTournaments = getTournaments().filter(t => t.status === 'published')
  const selectedTournament = publishedTournaments.find(t => t.id === search.tournament)
  const game = selectedTournament?.game ?? (search.game === 'lol' || search.game === 'valorant' ? search.game : 'all')
  const tournaments = selectedTournament ? [selectedTournament] : publishedTournaments.filter(t => game === 'all' || t.game === game)
  const data = tournaments.map(t => inTournament(t.id, () => ({ teams: getTeams(), ...getPublishedTournamentData(getPhases(), getMatches()) })))
  const teams = data.flatMap(d => d.teams)
  const phases = data.flatMap(d => d.phases)
  const matches = data.flatMap(d => d.matches)
  const sections = [
    { name: 'Próximos partidos', items: matches.filter(m => !m.result && m.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)) },
    { name: 'Pendientes sin fecha', items: matches.filter(m => !m.result && !m.scheduledAt) },
    { name: 'Resultados recientes', items: matches.filter(m => m.result).sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? '')) },
  ]
  return <div>
    <LiveSection channel={TWITCH_CHANNEL} {...getSiteBranding()} />
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <HomeFilters tournaments={publishedTournaments.map(({ id, name, game }) => ({ id, name, game }))} game={game} tournamentId={selectedTournament?.id} />
      {sections.map(section => <section key={section.name}>
        <h2 className="font-bold mb-4">{section.name}</h2>
        {section.items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map(match => <MatchCard key={match.id} match={match} teams={teams} phase={phases.find(p => p.id === match.phaseId)} />)}
        </div> : <p className="text-white/60">No hay partidos.</p>}
      </section>)}
    </div>
  </div>
}
