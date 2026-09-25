import { notFound } from 'next/navigation'
import { getTournaments } from '@/lib/competitions'
import ValorantSandboxKey from '@/components/ValorantSandboxKey'

export const dynamic = 'force-dynamic'
export default function Page() {
  if (process.env.NODE_ENV === 'production' || process.env.VALORANT_SANDBOX !== '1') notFound()
  const tournament = getTournaments().find(t => t.slug === 'valorant-ranking-pruebas')
  if (!tournament) notFound()
  return <ValorantSandboxKey tournamentId={tournament.id} />
}
