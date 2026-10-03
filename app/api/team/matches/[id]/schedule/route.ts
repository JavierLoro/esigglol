import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeamSession } from '@/lib/auth'
import { competitionRoute } from '@/lib/competition-route'
import { StaleWriteError, updateMatches } from '@/lib/data'
import db from '@/lib/db'
import { getTeamPendingMatches } from '@/lib/team-portal-data'

const ScheduleSchema = z.object({
  version: z.number().int().positive(),
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
}).strict()

async function handlePATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = ScheduleSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Indica una fecha y hora válidas y la versión del partido.' }, { status: 422 })
  const { id } = await context.params
  try {
    const updated = db.transaction(() => {
      const match = getTeamPendingMatches(session.teamId).find(match => match.id === id)
      if (!match) return undefined
      return updateMatches([{ ...match, version: parsed.data.version, scheduledAt: parsed.data.scheduledAt ?? undefined }])[0]
    }).immediate()
    if (!updated) return NextResponse.json({ error: 'El partido ya no está disponible entre tus partidos pendientes. Actualiza la lista.' }, { status: 404 })
    return NextResponse.json({ id: updated.id, version: updated.version, scheduledAt: updated.scheduledAt }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof StaleWriteError) return NextResponse.json({ error: 'El partido cambió en otra sesión. Actualiza la lista antes de guardar.' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo guardar la fecha. Inténtalo de nuevo.' }, { status: 500 })
  }
}

export const PATCH = competitionRoute(handlePATCH, 'team')
