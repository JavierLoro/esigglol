import { NextResponse } from 'next/server'
import { getPhases, getMatches } from '@/lib/data'
import { getPublishedTournamentData } from '@/lib/publication'

export async function GET() {
  const phases = getPhases()
  const allMatches = getMatches()
  const res = NextResponse.json(getPublishedTournamentData(phases, allMatches))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
