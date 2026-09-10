import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getTeamChangeRequests } from '@/lib/team-portal-data'

export async function GET() {
  const deny = await requireAdminSession()
  return deny ?? NextResponse.json(getTeamChangeRequests(), { headers: { 'Cache-Control': 'private, no-store' } })
}
