import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminSession } from '@/lib/auth'
import { deleteTournament, getTournaments, saveTournament } from '@/lib/competitions'
import logger from '@/lib/logger'
import { removeUnusedLogo } from '@/lib/logo-cleanup'

const schema = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  game: z.enum(['lol', 'valorant']), platform: z.literal('pc'), region: z.literal('eu'),
  status: z.enum(['draft', 'published', 'archived']),
})
export async function GET() {
  const denied = await requireAdminSession(); if (denied) return denied
  return NextResponse.json(getTournaments(true), { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(req: NextRequest) {
  const denied = await requireAdminSession(); if (denied) return denied
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Torneo inválido' }, { status: 422 })
  try {
    return NextResponse.json(saveTournament({ ...parsed.data, ...(!parsed.data.id ? { status: 'draft' as const } : {}) }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar' }, { status: 409 })
  }
}

const deleteSchema = z.object({ id: z.string().trim().min(1) }).strict()
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminSession(); if (denied) return denied
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Torneo inválido' }, { status: 422 })
  try {
    const logos = deleteTournament(parsed.data.id)
    if (!logos) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
    for (const logo of logos) removeUnusedLogo(logo)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error({ err }, 'Unable to delete tournament')
    return NextResponse.json({ error: 'No se pudo eliminar el torneo' }, { status: 500 })
  }
}
