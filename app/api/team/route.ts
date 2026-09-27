import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { requireTeamSession } from '@/lib/auth'
import { getTeamById } from '@/lib/data'
import { getTeamChangeRequests } from '@/lib/team-portal-data'

async function handleGET(_request?: Request) {
  void _request
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  const team = getTeamById(session.teamId)
  return team
    ? NextResponse.json({ team, requests: getTeamChangeRequests(session.teamId) }, { headers: { 'Cache-Control': 'private, no-store' } })
    : NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
}

export const GET = competitionRoute(handleGET, 'team')
