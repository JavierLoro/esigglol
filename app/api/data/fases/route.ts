import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { getPhases, getMatches } from '@/lib/data'
import { getPublishedTournamentData } from '@/lib/publication'

async function handleGET(_request?: Request) {
  void _request
  const phases = getPhases()
  const allMatches = getMatches()
  const res = NextResponse.json(getPublishedTournamentData(phases, allMatches))
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const GET = competitionRoute(handleGET, 'public')
