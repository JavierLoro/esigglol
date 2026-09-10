import { NextResponse } from 'next/server'
import { requireTeamSession } from '@/lib/auth'
import { TeamRolesSchema } from '@/lib/schemas'
import { StaleWriteError } from '@/lib/data'
import { updatePlayerRoles } from '@/lib/team-portal-data'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = TeamRolesSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  try {
    const { id } = await context.params
    return NextResponse.json(updatePlayerRoles(session.teamId, id, parsed.data.version, parsed.data.primaryRole, parsed.data.secondaryRole))
  } catch (error) {
    if (error instanceof StaleWriteError) return NextResponse.json({ error: 'El equipo cambió. Recarga antes de guardar.' }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 404 })
  }
}
