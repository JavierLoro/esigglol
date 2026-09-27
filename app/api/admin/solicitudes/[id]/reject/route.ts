import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { ResolveTeamRequestSchema } from '@/lib/schemas'
import { getTeamChangeRequest, rejectTeamChangeRequest } from '@/lib/team-portal-data'
import { removeUnusedLogo } from '@/lib/logo-cleanup'

async function handlePOST(req: Request, context: { params: Promise<{ id: string }> }) {
  const deny = await requireAdminSession()
  if (deny) return deny
  let raw: unknown = {}
  try { raw = await req.json() } catch { /* empty reason is valid */ }
  const parsed = ResolveTeamRequestSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { id } = await context.params
  const current = getTeamChangeRequest(id)
  if (!current) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  const rejected = rejectTeamChangeRequest(id, parsed.data.reason)
  if (!rejected) return NextResponse.json({ error: 'La solicitud ya fue resuelta' }, { status: 409 })
  if (current.type === 'team_logo') {
    const logo = typeof current.payload.logo === 'string' ? current.payload.logo : ''
    if (logo) removeUnusedLogo(logo)
  }
  return NextResponse.json(rejected)
}

export const POST = competitionRoute(handlePOST, 'admin')
