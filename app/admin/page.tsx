import { getTeams, getPhases, getMatches } from '@/lib/data'
import Link from 'next/link'
import { Users, Trophy, Calendar, CheckCircle } from 'lucide-react'
import TournamentSetup from '@/components/admin/TournamentSetup'
import RiotApiKeySettings from '@/components/admin/RiotApiKeySettings'

export const dynamic = 'force-dynamic'

export default function AdminDashboard() {
  const teams = getTeams()
  const phases = getPhases()
  const matches = getMatches()
  const played = matches.filter(m => m.result !== null).length

  const stats = [
    { label: 'Equipos', value: teams.length, icon: Users, href: '/admin/equipos' },
    { label: 'Fases', value: phases.length, icon: Trophy, href: '/admin/fases' },
    { label: 'Partidos', value: matches.length, icon: Calendar, href: '/admin/partidos' },
    { label: 'Jugados', value: played, icon: CheckCircle, href: '/admin/partidos' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-xl border border-white/10 bg-[#0d1321] p-5 flex flex-col gap-2 hover:border-[#0097D7]/30 transition-colors">
            <Icon size={20} className="text-[#0097D7]" />
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-sm text-white/40">{label}</span>
          </Link>
        ))}
      </div>
      <RiotApiKeySettings />
      <TournamentSetup />
      <div className="text-sm text-white/30">
        Accede a cada sección desde el menú lateral para gestionar el torneo.
      </div>
    </div>
  )
}
