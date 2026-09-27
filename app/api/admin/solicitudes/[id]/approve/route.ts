import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getTeamById } from '@/lib/data'
import { approveTeamChangeRequest, getTeamChangeRequest } from '@/lib/team-portal-data'
import { removeUnusedLogo } from '@/lib/logo-cleanup'

async function handlePOST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const { id } = await context.params
  const request = getTeamChangeRequest(id)
  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  const previousLogo = request.type === 'team_logo' ? getTeamById(request.teamId)?.logo : undefined
  try {
    const approved = approveTeamChangeRequest(id)
    if (!approved) return NextResponse.json({ error: 'La solicitud ya fue resuelta' }, { status: 409 })
    if (previousLogo) removeUnusedLogo(previousLogo)
    return NextResponse.json(approved.request)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 409 })
  }
}

export const POST = competitionRoute(handlePOST, 'admin')
