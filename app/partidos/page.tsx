import MatchCard from '@/components/MatchCard'
import { getTeams, getPhases, getMatches } from '@/lib/data'
import { publicTournament, inTournament, type CompetitionSearch } from '@/lib/public-competition'
import { getPublishedTournamentData } from '@/lib/publication'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<CompetitionSearch> }) {
  const tournament = publicTournament(await searchParams)
  const data = inTournament(tournament.id, () => ({ teams: getTeams(), ...getPublishedTournamentData(getPhases(), getMatches()) }))
  return <div className="max-w-7xl mx-auto p-6"><h1 className="text-2xl font-bold mb-6">Partidos · {tournament.name}</h1><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.matches.sort((a, b) => (a.scheduledAt ?? 'z').localeCompare(b.scheduledAt ?? 'z')).map(match => <MatchCard key={match.id} match={match} phase={data.phases.find(p => p.id === match.phaseId)} teams={data.teams} />)}</div>{!data.matches.length && <p>No hay partidos publicados.</p>}</div>
}
