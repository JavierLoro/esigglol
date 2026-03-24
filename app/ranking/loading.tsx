export default function RankingLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Ranking de jugadores</h1>
      <div className="rounded-xl border border-white/10 p-8 text-center text-white/40 text-sm">
        <div className="mb-2">Cargando datos desde la Riot API...</div>
        <div className="text-xs text-white/20">Con la key de desarrollo esto puede tardar varios minutos.</div>
      </div>
    </div>
  )
}
