import Link from 'next/link'
import { getTeams } from '@/lib/data'
import { publicTournament, inTournament, type CompetitionSearch } from '@/lib/public-competition'
import CompetitionBadge from '@/components/CompetitionBadge'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<CompetitionSearch> }) {
  const tournament = publicTournament(await searchParams)
  const teams = inTournament(tournament.id, getTeams)
  return <div className="max-w-7xl mx-auto p-6 space-y-6"><h1 className="text-2xl font-bold">Equipos</h1><CompetitionBadge game={tournament.game} name={tournament.name} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{teams.map(team => <Link key={team.id} href={`/equipos/${team.id}?tournament=${tournament.id}&game=${tournament.game}`} className="p-5 rounded border border-white/15"><h2>{team.name}</h2><p>{team.players.length} jugadores</p></Link>)}</div>{!teams.length && <p>No hay equipos inscritos.</p>}</div>
}
