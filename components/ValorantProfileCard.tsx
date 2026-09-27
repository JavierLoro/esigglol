import type { CompetitiveProfile } from '@/lib/valorant'

export default function ValorantProfileCard({ profile }: { profile?: Partial<CompetitiveProfile> }) {
  return <section className="rounded-xl border border-rose-300/25 p-5 space-y-2">
    <h2 className="font-semibold">Clasificación oficial por acto</h2>
    <p>Origen: Riot Games</p>
    {profile?.actId && <p>Acto: {profile.actId}</p>}
    <p>{profile?.availability === 'available' ? `Posición ${profile.leaderboardRank} · ${profile.rankedRating} RR` : 'No disponible'}</p>
    <p>Fecha de los datos: {profile?.fetchedAt ?? 'Sin consulta disponible'}</p>
  </section>
}
