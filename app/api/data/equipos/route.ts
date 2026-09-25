import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { getTeams } from '@/lib/data'

async function handleGET(_request?: Request) {
  void _request
  const teams = getTeams()
  const res = NextResponse.json(teams)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const GET = competitionRoute(handleGET, 'public')
