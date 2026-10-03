import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { requireTeamSession } from '@/lib/auth'
import { getPhases, getTeamById, getTeams } from '@/lib/data'
import { getTeamChangeRequests, getTeamPendingMatches } from '@/lib/team-portal-data'
import type { TeamPendingMatch } from '@/lib/types'

async function handleGET(_request?: Request) {
  void _request
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  const team = getTeamById(session.teamId)
  const teams = getTeams()
  const phases = getPhases()
  // Project only scheduling fields; never expose Riot codes or callback tokens.
  const matches: TeamPendingMatch[] = getTeamPendingMatches(session.teamId).map(match => ({
    id: match.id, version: match.version, round: match.round, scheduledAt: match.scheduledAt,
    phaseName: phases.find(phase => phase.id === match.phaseId)!.name,
    opponentName: teams.find(team => team.id === (match.team1Id === session.teamId ? match.team2Id : match.team1Id))?.name ?? 'Por determinar',
  }))
  return team
    ? NextResponse.json({ team, requests: getTeamChangeRequests(session.teamId), matches }, { headers: { 'Cache-Control': 'private, no-store' } })
    : NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
}

export const GET = competitionRoute(handleGET, 'team')
