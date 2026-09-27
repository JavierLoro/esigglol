import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getTeamChangeRequests } from '@/lib/team-portal-data'

async function handleGET(_request?: Request) {
  void _request
  const deny = await requireAdminSession()
  return deny ?? NextResponse.json(getTeamChangeRequests(), { headers: { 'Cache-Control': 'private, no-store' } })
}

export const GET = competitionRoute(handleGET, 'admin')
