'use client'

import { createContext, useContext } from 'react'
import type { Tournament } from '@/lib/types'

const AdminTournamentContext = createContext<Tournament | null>(null)

export function AdminTournamentProvider({ tournament, children }: { tournament: Tournament; children: React.ReactNode }) {
  return <AdminTournamentContext.Provider value={tournament}>{children}</AdminTournamentContext.Provider>
}

export function useAdminTournament() {
  return useContext(AdminTournamentContext)
}
